// PostgreSQL access. Dates and timestamps are returned as plain strings (like Laravel did)
// so a DATE column never shifts by a timezone, and NUMERIC stays an exact decimal string.
const { Pool, types } = require('pg');
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1114, (v) => v); // timestamp
types.setTypeParser(20, (v) => parseInt(v, 10)); // bigint

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = (c) => c || pool;
const qi = (n) => `"${String(n).replace(/"/g, '""')}"`;

async function q(sql, params = [], c) { return (await run(c).query(sql, params)).rows; }
async function one(sql, params = [], c) { return (await q(sql, params, c))[0] || null; }
async function val(sql, params = [], c) { const r = await one(sql, params, c); return r ? Object.values(r)[0] : null; }

async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

// Column metadata, so insert/update can stamp created_at / updated_at the way Eloquent did.
const cols = {};
async function init() {
  const rows = await q("SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema = current_schema()");
  for (const r of rows) (cols[r.t] = cols[r.t] || new Set()).add(r.c);
}
const has = (table, col) => !!(cols[table] && cols[table].has(col));
const columnsOf = (table) => [...(cols[table] || [])];

async function insert(table, data, c) {
  data = { ...data };
  const stamp = now();
  if (has(table, 'created_at') && data.created_at === undefined) data.created_at = stamp;
  if (has(table, 'updated_at') && data.updated_at === undefined) data.updated_at = stamp;
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (!keys.length) return one(`INSERT INTO ${qi(table)} DEFAULT VALUES RETURNING *`, [], c);
  return one(`INSERT INTO ${qi(table)} (${keys.map(qi).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, keys.map((k) => data[k]), c);
}
async function update(table, id, data, c, idCol = 'id') {
  data = { ...data };
  if (has(table, 'updated_at') && data.updated_at === undefined) data.updated_at = now();
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (!keys.length) return one(`SELECT * FROM ${qi(table)} WHERE ${qi(idCol)}=$1`, [id], c);
  return one(`UPDATE ${qi(table)} SET ${keys.map((k, i) => `${qi(k)}=$${i + 1}`).join(',')} WHERE ${qi(idCol)}=$${keys.length + 1} RETURNING *`, [...keys.map((k) => data[k]), id], c);
}
async function remove(table, id, c, idCol = 'id') { return (await run(c).query(`DELETE FROM ${qi(table)} WHERE ${qi(idCol)}=$1`, [id])).rowCount; }
const find = (table, id, c) => one(`SELECT * FROM ${qi(table)} WHERE id=$1`, [id], c);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = (d = new Date()) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const today = (d = new Date()) => ymd(d);

// SQL fragment: a text-or-numeric column read as a number (blank / junk -> 0). Legacy tables store money as varchar.
const numSql = (col) => `(CASE WHEN ${col}::text ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ${col}::text::numeric ELSE 0 END)`;

module.exports = { numSql, init, has, columnsOf, pool, q, one, val, tx, insert, update, remove, find, qi, now, today };
