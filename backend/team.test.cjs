'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createServer } = require('./server.cjs');

const TODAY = '2035-10-29';
const PASSWORD = 'Ficticia-Equipe-2035!';
function fixture(overrides = {}) {
  return {
    eventName: 'Encontro de teste', destination: 'São Paulo - SP', totalPassengers: '40',
    departureDate: '2035-11-03', returnDate: '2035-11-05', companyName: 'Empresa de Teste',
    requesterName: 'Pessoa de Teste', email: 'cliente@example.test', phone: '(11) 99999-9999', svcAereo: true,
    ...overrides,
  };
}
async function start(t, options = {}) {
  const server = createServer({ dbPath: ':memory:', today: TODAY, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let closed = false;
  const stop = () => {
    if (closed) return Promise.resolve();
    closed = true;
    return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  };
  t.after(stop);
  return { server, base: `http://127.0.0.1:${server.address().port}`, stop };
}
function json(base, route, method = 'GET', body, cookie, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  return fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
function cookieFrom(response) {
  const header = response.headers.get('set-cookie');
  assert.ok(header, 'Authenticated response must set a cookie');
  return header.split(';', 1)[0];
}
async function setup(base) {
  const response = await json(base, '/api/team/setup', 'POST', { password: PASSWORD });
  assert.equal(response.status, 201);
  const cookie = cookieFrom(response);
  assert.deepEqual(await response.json(), { authenticated: true });
  return cookie;
}
async function createRequest(base, key = 'team-test-request-0001', overrides = {}) {
  const response = await json(base, '/api/requests', 'POST', fixture(overrides), null, { 'Idempotency-Key': key });
  assert.equal(response.status, 201);
  return response.json();
}

test('team routes require authentication and setup validates password without configuring invalid input', async t => {
  const { base } = await start(t);
  assert.deepEqual(await (await json(base, '/api/team/setup-status')).json(), { configured: false });
  for (const route of ['/api/team/session', '/api/team/requests', '/api/team/requests/PT-2035-0000000000000000']) {
    assert.equal((await json(base, route)).status, 401, route);
  }
  for (const password of ['short', 'x'.repeat(129), 123456789012]) {
    const response = await json(base, '/api/team/setup', 'POST', { password });
    assert.equal(response.status, 422);
    assert.ok((await response.json()).errors.password);
  }
  assert.deepEqual(await (await json(base, '/api/team/setup-status')).json(), { configured: false });
});

test('setup signs in with scoped HttpOnly Strict cookie; login/logout invalidates the session', async t => {
  const { base } = await start(t);
  const response = await json(base, '/api/team/setup', 'POST', { password: PASSWORD });
  assert.equal(response.status, 201);
  const header = response.headers.get('set-cookie');
  assert.match(header, /(?:^|;\s*)paytrack_team=[A-Za-z0-9_-]+/);
  assert.match(header, /;\s*HttpOnly(?:;|$)/i);
  assert.match(header, /;\s*SameSite=Strict(?:;|$)/i);
  assert.match(header, /;\s*Path=\/api\/team(?:;|$)/i);
  assert.match(header, /;\s*Max-Age=28800(?:;|$)/i);
  assert.equal(/;\s*Secure(?:;|$)/i.test(header), false, 'Loopback HTTP test must not use an unusable Secure cookie');
  const cookie = cookieFrom(response);
  assert.deepEqual(await response.json(), { authenticated: true });
  assert.deepEqual(await (await json(base, '/api/team/setup-status')).json(), { configured: true });
  assert.deepEqual(await (await json(base, '/api/team/session', 'GET', undefined, cookie)).json(), { authenticated: true });
  assert.equal((await json(base, '/api/team/setup', 'POST', { password: PASSWORD })).status, 409);
  assert.equal((await json(base, '/api/team/login', 'POST', { password: 'Wrong-Ficticia-Password' })).status, 401);
  const login = await json(base, '/api/team/login', 'POST', { password: PASSWORD });
  assert.equal(login.status, 200);
  const loginCookie = cookieFrom(login);
  assert.notEqual(loginCookie, cookie);
  const logout = await json(base, '/api/team/logout', 'POST', {}, loginCookie);
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { authenticated: false });
  assert.match(logout.headers.get('set-cookie'), /;\s*Max-Age=0(?:;|$)/i);
  assert.equal((await json(base, '/api/team/session', 'GET', undefined, loginCookie)).status, 401);
});

test('setup/login share a five-attempt minute limit; expired sessions cannot access the panel', async t => {
  let now = Date.UTC(2035, 9, 29, 12);
  const { base } = await start(t, { clock: () => now });
  const cookie = await setup(base);
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal((await json(base, '/api/team/login', 'POST', { password: 'Wrong-Ficticia-Password' })).status, 401);
  }
  const limited = await json(base, '/api/team/login', 'POST', { password: PASSWORD });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  now += 60001;
  assert.equal((await json(base, '/api/team/login', 'POST', { password: PASSWORD })).status, 200);
  now += 8 * 60 * 60 * 1000 + 1;
  assert.equal((await json(base, '/api/team/session', 'GET', undefined, cookie)).status, 401);
});

test('team lists summarize requests; updates retain history and customer status exposes no private fields', async t => {
  const { base } = await start(t);
  const created = await createRequest(base);
  const cookie = await setup(base);
  const list = await (await json(base, '/api/team/requests', 'GET', undefined, cookie)).json();
  assert.equal(list.requests.length, 1);
  assert.deepEqual(Object.keys(list.requests[0]).sort(), ['assignedTo', 'companyName', 'createdAt', 'eventName', 'protocol', 'status', 'updatedAt']);
  assert.equal(list.requests[0].eventName, fixture().eventName);
  assert.equal(list.requests[0].status, 'received');
  const route = '/api/team/requests/' + created.protocol;
  const initial = await (await json(base, route, 'GET', undefined, cookie)).json();
  assert.equal(initial.request.payload.email, fixture().email);
  const update = await json(base, route, 'PATCH', { status: 'quoting', assignedTo: 'Equipe de grupos', note: 'Dados conferidos no teste' }, cookie);
  assert.equal(update.status, 200);
  const detail = await update.json();
  assert.equal(detail.request.status, 'quoting');
  assert.equal(detail.request.assignedTo, 'Equipe de grupos');
  assert.ok(detail.history.some(item => item.status === 'quoting' && item.note === 'Dados conferidos no teste' && item.actor === 'Equipe local'));
  const customer = await json(base, '/api/requests/' + created.protocol, 'GET', undefined, null, { Authorization: 'Bearer ' + created.accessToken });
  assert.equal(customer.status, 200);
  const customerStatus = await customer.json();
  assert.equal(customerStatus.status, 'quoting');
  assert.deepEqual(Object.keys(customerStatus).sort(), ['createdAt', 'notificationStatus', 'protocol', 'status']);
  assert.equal((await json(base, route)).status, 401);
  assert.equal((await json(base, '/api/requests/' + created.protocol)).status, 404);
});

test('workflow validates enum/length/type and stores SQL-like text as data', async t => {
  const { base } = await start(t);
  const created = await createRequest(base);
  const cookie = await setup(base);
  const route = '/api/team/requests/' + created.protocol;
  const invalid = [
    { status: "received'; DROP TABLE requests; --" },
    { status: 'quoting', assignedTo: 'x'.repeat(121) },
    { status: 'quoting', note: 'x'.repeat(2001) },
    { status: 'quoting', assignedTo: {} },
    { status: 'quoting', note: [] },
  ];
  for (const update of invalid) assert.equal((await json(base, route, 'PATCH', update, cookie)).status, 422);
  const assignedTo = "D'Ávila'); DROP TABLE requests; --";
  const note = '<img src=x onerror=alert(1)>';
  const response = await json(base, route, 'PATCH', { status: 'needs_information', assignedTo, note }, cookie);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  const detail = await response.json();
  assert.equal(detail.request.assignedTo, assignedTo);
  assert.ok(detail.history.some(item => item.note === note));
  const list = await (await json(base, '/api/team/requests', 'GET', undefined, cookie)).json();
  assert.equal(list.requests.length, 1);
});

test('account hashes and workflow survive restart; sessions do not survive restart', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'paytrack-team-'));
  let second;
  const dbPath = path.join(dir, 'requests.sqlite');
  const first = await start(t, { dbPath });
  t.after(async () => { await first.stop(); if (second) await second.stop(); rmSync(dir, { recursive: true, force: true }); });
  const created = await createRequest(first.base);
  const cookie = await setup(first.base);
  const route = '/api/team/requests/' + created.protocol;
  const update = await json(first.base, route, 'PATCH', { status: 'proposal_sent', assignedTo: 'Consultor teste', note: 'Proposta registrada no teste' }, cookie);
  assert.equal(update.status, 200);
  await first.stop();
  const db = new DatabaseSync(dbPath);
  const account = db.prepare('SELECT * FROM team_account').get();
  assert.ok(account.salt);
  assert.ok(account.password_hash);
  assert.equal(JSON.stringify(account).includes(PASSWORD), false);
  assert.equal(db.prepare('SELECT count(*) AS n FROM requests').get().n, 1);
  assert.equal(db.prepare('SELECT status FROM requests').get().status, 'received', 'Original immutable request schema is preserved');
  db.close();
  second = await start(t, { dbPath });
  assert.deepEqual(await (await json(second.base, '/api/team/setup-status')).json(), { configured: true });
  assert.equal((await json(second.base, '/api/team/session', 'GET', undefined, cookie)).status, 401);
  const login = await json(second.base, '/api/team/login', 'POST', { password: PASSWORD });
  assert.equal(login.status, 200);
  const newCookie = cookieFrom(login);
  const persisted = await (await json(second.base, route, 'GET', undefined, newCookie)).json();
  assert.equal(persisted.request.status, 'proposal_sent');
  assert.equal(persisted.request.assignedTo, 'Consultor teste');
  assert.ok(persisted.history.some(item => item.note === 'Proposta registrada no teste'));
});

test('workflow/history changes roll back together when history insertion fails', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'paytrack-team-rollback-'));
  const dbPath = path.join(dir, 'requests.sqlite');
  const instance = await start(t, { dbPath });
  t.after(async () => { await instance.stop(); rmSync(dir, { recursive: true, force: true }); });
  const created = await createRequest(instance.base);
  const cookie = await setup(instance.base);
  const route = '/api/team/requests/' + created.protocol;
  const before = await (await json(instance.base, route, 'GET', undefined, cookie)).json();
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TRIGGER reject_team_history BEFORE INSERT ON request_history BEGIN SELECT RAISE(ABORT, 'test history failure'); END`);
  db.close();
  const response = await json(instance.base, route, 'PATCH', { status: 'completed', assignedTo: 'Equipe teste', note: 'Esta mudança deve falhar por completo' }, cookie);
  assert.equal(response.status, 500);
  const after = await (await json(instance.base, route, 'GET', undefined, cookie)).json();
  assert.equal(after.request.status, before.request.status);
  assert.equal(after.request.assignedTo, before.request.assignedTo);
  assert.deepEqual(after.history, before.history);
});


test('idempotent receipt replay reflects the current workflow without exposing private notes', async t => {
  const {base} = await start(t);
  const receipt = await createRequest(base, 'workflow-replay-000001');
  const cookie = await setup(base);
  const updated = await json(base, '/api/team/requests/' + receipt.protocol, 'PATCH', {status:'quoting', assignedTo:'Equipe teste', note:'Nota privada de teste'}, cookie);
  assert.equal(updated.status, 200);
  const replay = await json(base, '/api/requests', 'POST', fixture(), null, {'Idempotency-Key':'workflow-replay-000001'});
  assert.equal(replay.status, 200);
  const result = await replay.json();
  assert.equal(result.status, 'quoting');
  assert.equal(result.protocol, receipt.protocol);
  assert.equal(result.accessToken, receipt.accessToken);
  assert.equal(result.replayed, true);
  assert.equal(Object.hasOwn(result,'assignedTo'), false);
  assert.equal(Object.hasOwn(result,'note'), false);
});
