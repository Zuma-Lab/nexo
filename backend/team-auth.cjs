'use strict';
const { randomBytes, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scryptAsync = promisify(scrypt);
const SESSION_TTL = 8 * 60 * 60 * 1000;
const PASSWORD_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const hash = value => createHash('sha256').update(value).digest('hex');

async function hashPassword(password, salt = randomBytes(24).toString('base64url')) {
  const result = await scryptAsync(password, salt, 64, PASSWORD_OPTIONS);
  return {salt, passwordHash: result.toString('hex')};
}
async function verifyPassword(password, credentials) {
  // Equal-cost derivation also when there is no configured account.
  const salt = credentials?.salt || 'not-configured-local-account';
  const result = await hashPassword(password, salt);
  const expected = credentials?.password_hash ? Buffer.from(credentials.password_hash, 'hex') : Buffer.alloc(64);
  const actual = Buffer.from(result.passwordHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual) && !!credentials;
}
function createTeamAuth(options = {}) {
  const clock = options.clock || Date.now;
  const sessions = new Map();
  const attempts = new Map();
  const cookieName = 'paytrack_team';
  function clean() {
    const now = clock();
    for (const [key, expiresAt] of sessions) if (expiresAt <= now) sessions.delete(key);
    for (const [key, value] of attempts) if (value.resetsAt <= now) attempts.delete(key);
  }
  function rateLimit(address) {
    clean();
    const now = clock();
    const entry = attempts.get(address) || {count: 0, resetsAt: now + 60 * 1000};
    if (entry.count >= 5) return Math.max(1, Math.ceil((entry.resetsAt - now) / 1000));
    entry.count++;
    attempts.set(address, entry);
    return 0;
  }
  function rawCookie(req) {
    const match = (req.headers.cookie || '').split(';').map(item => item.trim())
      .find(item => item.startsWith(cookieName + '='));
    const token = match?.slice(cookieName.length + 1);
    return typeof token === 'string' && /^[A-Za-z0-9_-]{64}$/.test(token) ? token : null;
  }
  function authenticated(req) {
    clean();
    const token = rawCookie(req);
    return !!token && sessions.has(hash(token));
  }
  function signIn(res) {
    clean();
    const token = randomBytes(48).toString('base64url');
    sessions.set(hash(token), clock() + SESSION_TTL);
    res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/team; Max-Age=28800`);
  }
  function signOut(req, res) {
    const token = rawCookie(req);
    if (token) sessions.delete(hash(token));
    res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/team; Max-Age=0`);
  }
  return {rateLimit, authenticated, signIn, signOut};
}
module.exports = {createTeamAuth, hashPassword, verifyPassword};
