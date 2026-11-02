// Port of `php artisan permissions:sync`: adds permission rows missing for any role. Flags: --dry-run --prune
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg'); const cfg = require('../src/config/permissions'); const key = (l) => l.toLowerCase().replace(/ /g, '_');
(async () => {
  const dry = process.argv.includes('--dry-run'); const prune = process.argv.includes('--prune'); const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const wanted = cfg.permissions.map(key); const have = (await pool.query('SELECT permission_name n, permission_group g FROM permission')).rows; let added = 0;
  for (const g of Object.keys(cfg.groups)) for (const k of wanted) { if (have.some((r) => r.g === g && r.n === k)) continue; added++; if (!dry) await pool.query('INSERT INTO permission (permission_name, permission_group, permission_type) VALUES ($1,$2,$3)', [k, g, g === 'admin' ? 'yes' : '']); }
  const stale = (await pool.query('SELECT COUNT(*)::int c FROM permission WHERE NOT (permission_name = ANY($1))', [wanted])).rows[0].c;
  if (prune && stale && !dry) { await pool.query('DELETE FROM permission WHERE NOT (permission_name = ANY($1))', [wanted]); console.log(`Removed ${stale} permission(s) that are no longer in the catalogue.`); }
  console.log(`${dry ? 'Would add' : 'Added'} ${added} permission row(s) across ${Object.keys(cfg.groups).length} role(s).`); await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
