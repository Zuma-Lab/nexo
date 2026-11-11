'use strict';
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createStore } = require('./store.cjs');
const { createTeamAuth, hashPassword, verifyPassword } = require('./team-auth.cjs');

const MAX_BODY_BYTES = 128 * 1024;
const SERVICE_FIELDS = ['svcAereo', 'svcHospedagem', 'svcEspacoAlimentacao', 'svcTransfers'];
const BOOLEAN_FIELDS = [...SERVICE_FIELDS, 'costCenterNotApplicable', 'participantsUnknown', 'datesUnknown', 'datesFlexible', 'participantsEstimated', 'aereoGuidance', 'hospedagemGuidance', 'espacoGuidance', 'transfersGuidance'];
const ARRAY_FIELDS = ['departureTimes', 'returnTimes', 'avServices', 'cateringServices', 'transferTypes'];
const TEXT_FIELDS = [
  'companyName', 'cnpj', 'requesterName', 'requesterRole', 'email', 'phone', 'costCenter', 'extraBillingType',
  'eventName', 'destination', 'departureDate', 'returnDate', 'airlinePreference', 'specificAirline', 'restrictedAirline',
  'cabinClass', 'cabinClassNotes', 'flightConnection', 'maxLayoverHours', 'baggageType', 'aereoNotes',
  'hotelStandard', 'hotelLocationPref', 'eventAddress', 'hotelLocationOther', 'roomsSingle', 'roomsDoubleTwin',
  'roomsDoubleCasal', 'roomsTriple', 'mealRegime', 'roomingList', 'hospedagemNotes', 'plenaryCapacity',
  'roomLayout', 'roomLayoutOther', 'breakoutRoomsCount', 'avOtherNotes', 'coffeeBreakPerDay',
  'espacoAlimentacaoNotes', 'vehicleType', 'dedicatedVehicleHoursDays', 'transfersNotes', 'desiredBudget','generalNotes',
];
function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validateBriefing(input, today = todayInSaoPaulo()) {
  const errors = {};
  const payload = {};
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: { form: 'Envie um objeto JSON com os dados do briefing.' }, payload: null };
  }
  for (const field of BOOLEAN_FIELDS) {
    if (input[field] !== undefined && typeof input[field] !== 'boolean') errors[field] = 'Use verdadeiro ou falso.';
    payload[field] = input[field] === true;
  }
  for (const field of TEXT_FIELDS) {
    const value = input[field];
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') {
      errors[field] = 'Informe um texto válido.'; payload[field] = ''; continue;
    }
    payload[field] = value == null ? '' : String(value).trim();
    if (payload[field].length > 10000) errors[field] = 'O texto excede 10.000 caracteres.';
  }
  for (const field of ARRAY_FIELDS) {
    const value = input[field] === undefined ? [] : input[field];
    if (!Array.isArray(value) || value.length > 50 || value.some(item => typeof item !== 'string' || item.length > 500)) {
      errors[field] = 'Envie uma lista válida de opções.'; payload[field] = [];
    } else payload[field] = value.map(item => item.trim());
  }
  const count = input.totalPassengers;
  const number = typeof count === 'number' ? count : typeof count === 'string' && /^\d+$/.test(count.trim()) ? Number(count.trim()) : NaN;
  payload.totalPassengers = payload.participantsUnknown ? '' : Number.isSafeInteger(number) && number >= 1 ? number : '';
  if (!payload.participantsUnknown && payload.totalPassengers === '') errors.totalPassengers = 'Informe ao menos 1 participante ou marque quantidade a definir.';
  if (payload.datesUnknown) { payload.departureDate = ''; payload.returnDate = ''; }
  if (!payload.datesUnknown) {
    if (!validDate(payload.departureDate) || payload.departureDate < today) errors.departureDate = 'Informe uma data de início válida, hoje ou no futuro.';
    if (!validDate(payload.returnDate) || payload.returnDate < today || (validDate(payload.departureDate) && payload.returnDate < payload.departureDate)) errors.returnDate = 'Informe uma data de término válida, igual ou posterior ao início.';
  }
  // Keep business rules shared with the browser. Shape checks above remain server-only.
  const { collectIssues, prepareSubmission } = require('../briefing-rules.js');
  for (const issue of collectIssues(input, today)) {
    if (!errors[issue.field]) errors[issue.field] = issue.message;
  }
  return { payload: Object.keys(errors).length ? payload : prepareSubmission(payload), errors };
}
function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function readJSON(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    req.resume();
    throw Object.assign(new Error('JSON required'), { statusCode: 415, publicCode: 'json_required' });
  }
  const raw = await new Promise((resolve, reject) => {
    const chunks = []; let length = 0; let finished = false;
    req.on('data', chunk => {
      if (finished) return;
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        finished = true;
        chunks.length = 0;
        reject(Object.assign(new Error('Body too large'), { statusCode: 413, publicCode: 'payload_too_large' }));
      } else chunks.push(chunk);
    });
    req.on('end', () => { if (!finished) { finished = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', () => { if (!finished) { finished = true; reject(Object.assign(new Error('Body interrupted'), {statusCode: 400, publicCode: 'invalid_body'})); } });
    req.on('aborted', () => { if (!finished) { finished = true; reject(Object.assign(new Error('Body interrupted'), {statusCode: 400, publicCode: 'invalid_body'})); } });
  });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400, publicCode: 'invalid_json' }); }
}

function createServer(options = {}) {
  const store = options.store || createStore(options);
  const teamAuth = createTeamAuth({clock: options.clock});
  const frontendRoot = path.resolve(options.frontendRoot || path.join(__dirname, '..'));
  const realFrontendRoot = fs.realpathSync(frontendRoot);
  const server = http.createServer(async (req, res) => {
    try {
      // This server is a local development target. Reject foreign Host/Origin values.
      const port = server.address()?.port;
      const permittedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
      if (!permittedHosts.has(req.headers.host)) return sendJSON(res, 403, { error: 'host_not_allowed' });
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) return sendJSON(res, 403, { error: 'origin_not_allowed' });
      const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJSON(res, 200, { status: 'ok', mode: 'local', registration: true, team: true, notificationStatus: 'pending_configuration' });
      }
      if (pathname === '/api/team/setup-status' && req.method === 'GET') {
        return sendJSON(res, 200, {configured: store.teamConfigured()});
      }
      if (['/api/team/setup', '/api/team/login'].includes(pathname) && req.method === 'POST') {
        const retryAfter = teamAuth.rateLimit(req.socket.remoteAddress || 'loopback');
        if (retryAfter) {
          req.resume();
          res.setHeader('Retry-After', String(retryAfter));
          return sendJSON(res, 429, {error: 'rate_limited'});
        }
        const data = await readJSON(req);
        if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.password !== 'string' ||
            data.password.length < 12 || data.password.length > 128 || !data.password.trim()) {
          return sendJSON(res, 422, {error: 'validation_error', errors: {password: 'Use uma senha entre 12 e 128 caracteres.'}});
        }
        if (pathname.endsWith('/setup')) {
          if (store.teamConfigured()) return sendJSON(res, 409, {error: 'already_configured'});
          const credentials = await hashPassword(data.password);
          if (!store.createTeamAccount(credentials.salt, credentials.passwordHash)) return sendJSON(res, 409, {error: 'already_configured'});
          teamAuth.signIn(res);
          return sendJSON(res, 201, {authenticated: true});
        }
        if (!await verifyPassword(data.password, store.getTeamCredentials())) return sendJSON(res, 401, {error: 'invalid_credentials'});
        teamAuth.signIn(res);
        return sendJSON(res, 200, {authenticated: true});
      }
      if (pathname === '/api/team/logout' && req.method === 'POST') {
        teamAuth.signOut(req, res);
        return sendJSON(res, 200, {authenticated: false});
      }
      if (pathname === '/api/team' || pathname.startsWith('/api/team/')) {
        if (!teamAuth.authenticated(req)) return sendJSON(res, 401, {error: 'authentication_required'});
        if (pathname === '/api/team/session' && req.method === 'GET') return sendJSON(res, 200, {authenticated: true});
        if (pathname === '/api/team/requests' && req.method === 'GET') return sendJSON(res, 200, {requests: store.listTeamRequests()});
        const teamRequestMatch = /^\/api\/team\/requests\/(PT-\d{4}-[A-F0-9]{16})$/.exec(pathname);
        if (teamRequestMatch && req.method === 'GET') {
          const detail = store.getTeamRequest(teamRequestMatch[1]);
          return sendJSON(res, detail ? 200 : 404, detail || {error: 'not_found'});
        }
        if (teamRequestMatch && req.method === 'PATCH') {
          const input = await readJSON(req);
          const errors = {}, changes = {};
          const allowed = ['status', 'assignedTo', 'note'];
          if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length || Object.keys(input).some(key => !allowed.includes(key))) {
            errors.form = 'Informe situação, responsável ou observação.';
          } else {
            if (input.status !== undefined) {
              if (!['received', 'needs_information', 'quoting', 'proposal_sent', 'completed'].includes(input.status)) errors.status = 'Selecione uma situação válida.';
              else changes.status = input.status;
            }
            for (const [field, maxLength] of [['assignedTo',120], ['note',2000]]) {
              if (input[field] === undefined) continue;
              if (typeof input[field] !== 'string' || input[field].length > maxLength) errors[field] = `Informe um texto com até ${maxLength} caracteres.`;
              else changes[field] = input[field].trim();
            }
          }
          if (Object.keys(errors).length) return sendJSON(res, 422, {error: 'validation_error', errors});
          const detail = store.updateTeamRequest(teamRequestMatch[1], changes);
          return sendJSON(res, detail ? 200 : 404, detail || {error: 'not_found'});
        }
        return sendJSON(res, 404, {error: 'not_found'});
      }
      if (pathname === '/api/requests' && req.method === 'POST') {
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(key)) return sendJSON(res, 400, { error: 'idempotency_key_required' });
        const input = await readJSON(req);
        const { payload, errors } = validateBriefing(input, options.today || todayInSaoPaulo());
        if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'validation_error', errors });
        const result = store.submit(payload, key);
        return sendJSON(res, result.replayed ? 200 : 201, result);
      }
      const statusMatch = /^\/api\/requests\/(PT-\d{4}-[A-F0-9]{16})$/.exec(pathname);
      if (statusMatch && req.method === 'GET') {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '')?.[1];
        const status = token && store.getStatus(statusMatch[1], token);
        // Identical response for unknown protocol and missing/invalid token.
        return sendJSON(res, status ? 200 : 404, status || { error: 'not_found' });
      }
      if (pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'not_found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { error: 'method_not_allowed' });
      const decoded = decodeURIComponent(pathname);
      const publicPath = decoded === '/' ? '/index.html' : decoded;
      if (!(/^\/(index\.html|system-config\.js|design\.css|cities\.js|briefing-rules\.js|team\.html|team\.css|team\.js)$/.test(publicPath) || /^\/(assets|fonts)\//.test(publicPath))) {
        return sendJSON(res, 404, { error: 'not_found' });
      }
      const candidate = path.resolve(frontendRoot, '.' + publicPath);
      const realPath = await fsp.realpath(candidate);
      if (!realPath.startsWith(realFrontendRoot + path.sep)) return sendJSON(res, 404, { error: 'not_found' });
      const stat = await fsp.stat(realPath);
      if (!stat.isFile()) return sendJSON(res, 404, { error: 'not_found' });
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
      const type = types[path.extname(realPath)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type + (/^(text\/)/.test(type) ? '; charset=utf-8' : ''), 'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(realPath).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      if (error.code === 'IDEMPOTENCY_CONFLICT') return sendJSON(res, 409, { error: 'idempotency_conflict' });
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return sendJSON(res, 404, { error: 'not_found' });
      if (error instanceof URIError) return sendJSON(res, 400, { error: 'invalid_path' });
      return sendJSON(res, error.statusCode || 500, { error: error.publicCode || 'internal_error' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close', () => { if (!options.store) store.close(); });
  return server;
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  const host = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('This local MVP only accepts loopback HOST values');
  const server = createServer({ dbPath: process.env.PAYTRACK_DB_PATH });
  server.listen(port, host, () => {
    const url = `http://${host === '::1' ? '[::1]' : host}:${port}`;
    console.log(`Paytrack local: ${url} — e-mail pendente de configuração`);
    if (process.argv.includes('--open')) {
      const { spawn } = require('node:child_process');
      const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      const args = process.platform === 'win32' ? ['/c','start','',url] : [url];
      const child = spawn(command,args,{stdio:'ignore',detached:true});
      child.on('error',()=>console.log('Abra o endereço local acima no navegador.'));
      child.unref();
    }
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = { createServer, validateBriefing, todayInSaoPaulo, MAX_BODY_BYTES };
