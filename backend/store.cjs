'use strict';
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableJSON(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
const hash = value => createHash('sha256').update(value).digest('hex');

function loadTokenSecret(filename) {
  try {
    const value = fs.readFileSync(filename);
    if (value.length !== 32) throw new Error('Invalid local token key');
    return value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const value = randomBytes(32);
    try { fs.writeFileSync(filename, value, { flag: 'wx', mode: 0o600 }); }
    catch (writeError) {
      if (writeError.code === 'EEXIST') return loadTokenSecret(filename);
      throw writeError;
    }
    return value;
  }
}

function createStore(options = {}) {
  const dbPath = options.dbPath || path.resolve(__dirname, '../.local/requests.sqlite');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const tokenSecret = options.tokenSecret || (dbPath === ':memory:' ? randomBytes(32) : loadTokenSecret(options.tokenKeyPath || dbPath + '.token-key'));
  if (!Buffer.isBuffer(tokenSecret) || tokenSecret.length !== 32) throw new Error('Token secret must contain 32 bytes');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      protocol TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      access_token_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status = 'received'),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_account (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS request_workflow (
      request_id TEXT PRIMARY KEY REFERENCES requests(id),
      status TEXT NOT NULL CHECK(status IN ('received', 'needs_information', 'quoting', 'proposal_sent', 'completed')),
      assigned_to TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS request_history (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id),
      status TEXT NOT NULL CHECK(status IN ('received', 'needs_information', 'quoting', 'proposal_sent', 'completed')),
      assigned_to TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT 'Equipe local',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS request_history_request ON request_history(request_id, created_at);
    CREATE TABLE IF NOT EXISTS notification_outbox (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id),
      channel TEXT NOT NULL CHECK(channel = 'email'),
      status TEXT NOT NULL CHECK(status IN ('pending_configuration', 'queued', 'sent', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(request_id, channel)
    );
  `);
  // Add workflow metadata to previously registered requests without changing their original table.
  db.exec(`INSERT OR IGNORE INTO request_workflow(request_id, status, assigned_to, updated_at)
    SELECT id, 'received', '', created_at FROM requests`);
  for (const row of db.prepare(`SELECT id, created_at FROM requests
      WHERE NOT EXISTS (SELECT 1 FROM request_history h WHERE h.request_id = requests.id)`).all()) {
    db.prepare(`INSERT INTO request_history(id, request_id, status, assigned_to, note, created_at)
      VALUES (?, ?, 'received', '', 'Solicitação registrada localmente.', ?)`)
      .run(randomUUID(), row.id, row.created_at);
  }
  const byKey = db.prepare('SELECT * FROM requests WHERE idempotency_key = ?');
  const byProtocol = db.prepare(`SELECT r.protocol, r.access_token_hash, COALESCE(w.status, r.status) AS status, r.created_at,
    o.status AS notification_status FROM requests r
    JOIN notification_outbox o ON o.request_id = r.id
    LEFT JOIN request_workflow w ON w.request_id = r.id WHERE r.protocol = ?`);
  function tokenFor(protocol) {
    return createHmac('sha256', tokenSecret).update('paytrack-request-access:v1:' + protocol).digest('base64url');
  }
  function publicResult(row, replayed) {
    const current = byProtocol.get(row.protocol);
    return {
      protocol: row.protocol, status: current?.status || row.status, createdAt: row.created_at,
      accessToken: tokenFor(row.protocol), notificationStatus: current?.notification_status || 'pending_configuration', replayed,
    };
  }
  function submit(payload, idempotencyKey, now = new Date()) {
    const payloadJSON = stableJSON(payload);
    const payloadHash = hash(payloadJSON);
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = byKey.get(idempotencyKey);
      if (existing) {
        if (existing.payload_hash !== payloadHash) {
          const error = new Error('Idempotency key reused for different payload');
          error.code = 'IDEMPOTENCY_CONFLICT';
          throw error;
        }
        db.exec('COMMIT');
        return publicResult(existing, true);
      }
      const createdAt = now.toISOString();
      const protocol = `PT-${createdAt.slice(0, 4)}-${randomBytes(8).toString('hex').toUpperCase()}`;
      const id = randomUUID();
      db.prepare(`INSERT INTO requests
        (id, protocol, idempotency_key, payload_hash, payload_json, access_token_hash, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'received', ?)`)
        .run(id, protocol, idempotencyKey, payloadHash, payloadJSON, hash(tokenFor(protocol)), createdAt);
      // An outbox item is durable intent to notify, not an email delivery receipt.
      // No provider is configured or contacted by this local MVP.
      db.prepare(`INSERT INTO notification_outbox (id, request_id, channel, status, created_at)
        VALUES (?, ?, 'email', 'pending_configuration', ?)`)
        .run(randomUUID(), id, createdAt);
      db.prepare(`INSERT INTO request_workflow(request_id, status, assigned_to, updated_at)
        VALUES (?, 'received', '', ?)`).run(id, createdAt);
      db.prepare(`INSERT INTO request_history(id, request_id, status, assigned_to, note, created_at)
        VALUES (?, ?, 'received', '', 'Solicitação registrada localmente.', ?)`).run(randomUUID(), id, createdAt);
      db.exec('COMMIT');
      return publicResult({ protocol, status: 'received', created_at: createdAt }, false);
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  }
  function getStatus(protocol, token) {
    if (typeof token !== 'string' || token.length > 200) return null;
    const row = byProtocol.get(protocol);
    if (!row) return null;
    const expected = Buffer.from(row.access_token_hash, 'hex');
    const actual = Buffer.from(hash(token), 'hex');
    if (!timingSafeEqual(expected, actual)) return null;
    return { protocol: row.protocol, status: row.status, createdAt: row.created_at, notificationStatus: row.notification_status };
  }
  const getAccount = db.prepare('SELECT salt, password_hash FROM team_account WHERE id = 1');
  function teamConfigured() { return !!getAccount.get(); }
  function getTeamCredentials() { return getAccount.get() || null; }
  function createTeamAccount(salt, passwordHash) {
    const result = db.prepare(`INSERT OR IGNORE INTO team_account(id, salt, password_hash, created_at)
      VALUES (1, ?, ?, ?)`).run(salt, passwordHash, new Date().toISOString());
    return result.changes === 1;
  }
  const teamQuery = `SELECT r.id, r.protocol, r.payload_json, r.created_at,
    COALESCE(w.status, r.status) AS status, COALESCE(w.assigned_to, '') AS assigned_to,
    COALESCE(w.updated_at, r.created_at) AS updated_at
    FROM requests r LEFT JOIN request_workflow w ON w.request_id = r.id`;
  function teamSummary(row) {
    const payload = JSON.parse(row.payload_json);
    return { protocol: row.protocol, eventName: payload.eventName, companyName: payload.companyName,
      status: row.status, assignedTo: row.assigned_to, createdAt: row.created_at, updatedAt: row.updated_at };
  }
  function listTeamRequests() {
    return db.prepare(teamQuery + ' ORDER BY r.created_at DESC, r.id').all().map(teamSummary);
  }
  function getTeamRequest(protocol) {
    const row = db.prepare(teamQuery + ' WHERE r.protocol = ?').get(protocol);
    if (!row) return null;
    const history = db.prepare(`SELECT status, assigned_to, note, actor, created_at
      FROM request_history WHERE request_id = ? ORDER BY created_at, rowid`).all(row.id)
      .map(item => ({status: item.status, assignedTo: item.assigned_to, note: item.note,
        actor: item.actor, createdAt: item.created_at}));
    return { request: { ...teamSummary(row), payload: JSON.parse(row.payload_json) }, history };
  }
  function updateTeamRequest(protocol, changes, now = new Date()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare(teamQuery + ' WHERE r.protocol = ?').get(protocol);
      if (!row) { db.exec('COMMIT'); return null; }
      const status = changes.status === undefined ? row.status : changes.status;
      const assignedTo = changes.assignedTo === undefined ? row.assigned_to : changes.assignedTo;
      const note = changes.note || '';
      if (status !== row.status || assignedTo !== row.assigned_to || note) {
        const updatedAt = now.toISOString();
        db.prepare(`INSERT INTO request_workflow(request_id, status, assigned_to, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(request_id) DO UPDATE SET status=excluded.status, assigned_to=excluded.assigned_to, updated_at=excluded.updated_at`)
          .run(row.id, status, assignedTo, updatedAt);
        db.prepare(`INSERT INTO request_history(id, request_id, status, assigned_to, note, actor, created_at)
          VALUES (?, ?, ?, ?, ?, 'Equipe local', ?)`)
          .run(randomUUID(), row.id, status, assignedTo, note, updatedAt);
      }
      db.exec('COMMIT');
      return getTeamRequest(protocol);
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  }
  return { submit, getStatus, teamConfigured, getTeamCredentials, createTeamAccount,
    listTeamRequests, getTeamRequest, updateTeamRequest, close: () => db.close() };
}
module.exports = { createStore, stableJSON };
