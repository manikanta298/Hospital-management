const { Pool } = require('pg');
const startPg = require('./pg');
async function boot() {
  const pg = await startPg(); process.env.DATABASE_URL = pg.url; process.env.NODE_ENV = 'test'; process.env.SESSION_SECRET = 'test'; delete process.env.CLIENT_ORIGIN;
  const pool = new Pool({ connectionString: pg.url });
  await require('../db/migrate')(pool); await require('../db/seed')(pool, () => {}); await pool.end();
  const db = require('../src/db'); await db.init();
  const server = require('../src/app')().listen(0); const origin = `http://localhost:${server.address().port}`; const base = `${origin}/api`;
  const jar = {};
  const call = async (method, url, body, opts = {}) => {
    const headers = { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') };
    let payload; if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, body: json, headers: r.headers };
  };
  const api = { get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b), del: (u) => call('DELETE', u) };
  return { api, db, jar, origin, stop: async () => { server.close(); await db.pool.end(); await pg.stop(); } };
}
module.exports = { boot };
