'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { createServer, validateBriefing, MAX_BODY_BYTES } = require('./server.cjs');
const { createStore } = require('./store.cjs');

const TODAY = '2035-10-29';
function fixture(overrides = {}) {
  return {
    eventName: 'Encontro de lideranças', destination: 'São Paulo - SP', totalPassengers: '40',
    departureDate: '2035-11-03', returnDate: '2035-11-05',
    companyName: 'Empresa de Teste', requesterName: 'Pessoa de Teste', email: 'cliente@example.test',
    phone: '(11) 99999-9999', svcAereo: true, ...overrides,
  };
}
function localStore(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'paytrack-backend-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  if (t) t.after(cleanup);
  const dbPath = path.join(dir, 'requests.sqlite');
  return { dir, dbPath, cleanup };
}
async function start(t, options = {}) {
  const server = createServer({ dbPath: ':memory:', tokenSecret: randomBytes(32), today: TODAY, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
function post(base, body, key = 'test-idempotency-key-0001') {
  return fetch(base + '/api/requests', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
  });
}

test('validates required minimum data and rejects invalid dates/types', () => {
  assert.deepEqual(validateBriefing(fixture(), TODAY).errors, {});
  for (const field of ['eventName', 'destination', 'companyName', 'requesterName', 'email']) {
    assert.ok(validateBriefing(fixture({ [field]: '' }), TODAY).errors[field], field);
  }
  for (const value of ['0', '-1', '1.5', 'not-a-number', true, []]) {
    assert.ok(validateBriefing(fixture({ totalPassengers: value }), TODAY).errors.totalPassengers);
  }
  assert.ok(validateBriefing(fixture({ departureDate: '2035-02-30' }), TODAY).errors.departureDate);
  assert.ok(validateBriefing(fixture({ departureDate: '2035-10-28' }), TODAY).errors.departureDate);
  assert.ok(validateBriefing(fixture({ returnDate: '2035-11-01' }), TODAY).errors.returnDate);
  assert.ok(validateBriefing(fixture({ datesFlexible: true, departureDate: '', returnDate: '' }), TODAY).errors.departureDate);
  assert.ok(validateBriefing(fixture({ svcAereo: false }), TODAY).errors.services);
  assert.ok(validateBriefing(fixture({ svcAereo: 'true' }), TODAY).errors.svcAereo);
  assert.ok(validateBriefing(fixture({ email: 'invalid' }), TODAY).errors.email);
  assert.ok(validateBriefing(fixture({ phone: '123' }), TODAY).errors.phone);
  assert.ok(validateBriefing(fixture({ cnpj: '123' }), TODAY).errors.cnpj);
  assert.ok(validateBriefing(fixture({ generalNotes: {} }), TODAY).errors.generalNotes);
});

test('unknown participants/dates are allowed; hidden services are removed', () => {
  const result = validateBriefing(fixture({
    totalPassengers: '', participantsUnknown: true, participantsEstimated: true,
    departureDate: '', returnDate: '', datesUnknown: true, datesFlexible: true,
    svcHospedagem: false, roomingList: 'Discard hidden PII', hotelStandard: 'Outdated choice',
  }), TODAY);
  assert.deepEqual(result.errors, {});
  assert.equal(result.payload.totalPassengers, '');
  assert.equal(result.payload.roomingList, '');
  assert.equal(result.payload.hotelStandard, '');
  assert.equal(result.payload.participantsEstimated, false);
  assert.equal(result.payload.datesFlexible, false);
});

test('persists request, outbox and access across restart without plaintext access token', t => {
  const { dbPath } = localStore(t);
  const payload = validateBriefing(fixture(), TODAY).payload;
  const first = createStore({ dbPath });
  const result = first.submit(payload, 'persistent-request-key');
  assert.equal(result.status, 'received');
  assert.equal(result.notificationStatus, 'pending_configuration');
  assert.match(result.protocol, /^PT-\d{4}-[A-F0-9]{16}$/);
  assert.equal(first.getStatus(result.protocol, result.accessToken).protocol, result.protocol);
  first.close();
  const second = createStore({ dbPath });
  const replay = second.submit(payload, 'persistent-request-key');
  assert.equal(replay.protocol, result.protocol);
  assert.equal(replay.accessToken, result.accessToken);
  assert.equal(replay.replayed, true);
  assert.equal(second.getStatus(result.protocol, result.accessToken).status, 'received');
  second.close();
  const db = new DatabaseSync(dbPath);
  const row = db.prepare('SELECT * FROM requests').get();
  const outbox = db.prepare('SELECT * FROM notification_outbox').all();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].status, 'pending_configuration');
  assert.equal(outbox[0].attempts, 0);
  assert.notEqual(row.access_token_hash, result.accessToken);
  assert.equal(JSON.stringify(row).includes(result.accessToken), false);
  db.close();
});

test('rolls back the request if the transactional outbox cannot be inserted', t => {
  const { dbPath } = localStore(t);
  const store = createStore({ dbPath });
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TRIGGER reject_outbox BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
  assert.throws(() => store.submit(validateBriefing(fixture(), TODAY).payload, 'rollback-request-key'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM requests').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM notification_outbox').get().n, 0);
  db.close(); store.close();
});

test('API creates only after persistence, replays same payload, rejects conflicting reuse', async t => {
  const { base } = await start(t);
  const created = await post(base, fixture());
  assert.equal(created.status, 201);
  const first = await created.json();
  const replayResponse = await post(base, { ...fixture(), eventName: ' Encontro de lideranças ' });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(first.protocol, replay.protocol);
  assert.equal(first.accessToken, replay.accessToken);
  assert.equal(replay.replayed, true);
  const conflict = await post(base, fixture({ eventName: 'Another event' }));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, 'idempotency_conflict');
});

test('status endpoint requires valid token and never includes briefing PII', async t => {
  const { base } = await start(t);
  const created = await (await post(base, fixture())).json();
  const route = base + '/api/requests/' + created.protocol;
  assert.equal((await fetch(route)).status, 404);
  assert.equal((await fetch(route, { headers: { Authorization: 'Bearer ' + 'a'.repeat(43) } })).status, 404);
  const response = await fetch(route, { headers: { Authorization: 'Bearer ' + created.accessToken } });
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.deepEqual(Object.keys(status).sort(), ['createdAt', 'notificationStatus', 'protocol', 'status']);
  assert.equal(status.notificationStatus, 'pending_configuration');
  assert.equal((await fetch(base + '/api/requests')).status, 404);
});

test('validation failures and malformed requests do not create requests', async t => {
  const { dbPath, cleanup } = localStore();
  const { base } = await start(t, { dbPath });
  // Close the server and SQLite before removing the temporary folder on Windows.
  t.after(cleanup);
  assert.equal((await post(base, fixture({ eventName: '' }))).status, 422);
  const validation = await post(base, fixture({ email: 'invalid' }));
  assert.ok((await validation.json()).errors.email);
  assert.equal((await fetch(base + '/api/requests', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await fetch(base + '/api/requests', { method: 'POST', headers: { 'Idempotency-Key': 'malformed-json-key', 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(base + '/api/requests', { method: 'POST', headers: { 'Idempotency-Key': 'wrong-content-key' }, body: '{}' })).status, 415);
  assert.equal((await post(base, { ...fixture(), generalNotes: 'x'.repeat(MAX_BODY_BYTES) }, 'oversized-body-key')).status, 413);
  const db = new DatabaseSync(dbPath);
  assert.equal(db.prepare('SELECT count(*) AS n FROM requests').get().n, 0);
  db.close();
});

test('health reports local mode; API rejects foreign origins and host headers', async t => {
  const { base } = await start(t);
  const health = await (await fetch(base + '/api/health')).json();
  assert.deepEqual(health, { status: 'ok', mode: 'local', registration: true, team: true, notificationStatus: 'pending_configuration' });
  assert.equal((await fetch(base + '/api/health', { headers: { Origin: 'https://external.example' } })).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    http.get(base + '/api/health', { headers: { Host: 'external.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(foreignHostStatus, 403);
});

test('static serving only exposes public application assets, never repository/backend/database', async t => {
  const { base } = await start(t);
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/assets/runtime/app.js')).status, 200);
  for (const file of ['/package.json', '/backend/server.cjs', '/.local/requests.sqlite', '/.git/config', '/scripts/build.cjs', '/node_modules/react/package.json']) {
    assert.equal((await fetch(base + file)).status, 404, file);
  }
});
