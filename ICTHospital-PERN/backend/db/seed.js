// Port of UserTableSeeder: default admin, hospital record, permission catalogue (all granted to Admin), notification types.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs'); const { Pool } = require('pg'); const cfg = require('../src/config/permissions');
const key = (l) => l.toLowerCase().replace(/ /g, '_');
async function seed(pool, log = console.log) {
  if (parseInt((await pool.query('SELECT COUNT(*) FROM users')).rows[0].count, 10) === 0) {
    await pool.query('INSERT INTO users (firstname, lastname, login, email, "group", "desc", password, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())', ['Hospital', 'Administrator', 'admin', 'admin@example.com', 'Admin', 'Default administrator created by the installer', bcrypt.hashSync('123456', 10)]);
    log('Created the admin account (login: admin / password: 123456). Change it now.');
  } else log('Users already present, left alone.');
  if (parseInt((await pool.query('SELECT COUNT(*) FROM institute')).rows[0].count, 10) === 0) { await pool.query('INSERT INTO institute (name, establish, email, web, "phoneNo", address) VALUES ($1,$2,$3,$4,$5,$6)', ['ICTHospital', String(new Date().getFullYear()), '', '', '', '']); log('Hospital record created. Set your details in Settings.'); }
  if (parseInt((await pool.query('SELECT COUNT(*) FROM permission')).rows[0].count, 10) === 0) {
    const rows = []; for (const g of Object.keys(cfg.groups)) for (const f of cfg.permissions) rows.push([key(f), g, g === 'admin' ? 'yes' : 'no']);
    for (let i = 0; i < rows.length; i += 500) { const c = rows.slice(i, i + 500); await pool.query(`INSERT INTO permission (permission_name, permission_group, permission_type) VALUES ${c.map((_, j) => `($${j * 3 + 1},$${j * 3 + 2},$${j * 3 + 3})`).join(',')}`, c.flat()); }
    log(`${cfg.permissions.length} permissions seeded across ${Object.keys(cfg.groups).length} roles, all granted to Admin.`);
  }
  for (const n of ['appointment', 'payment']) if (!(await pool.query('SELECT 1 FROM notification_type WHERE notification=$1', [n])).rows.length) await pool.query("INSERT INTO notification_type (notification, type) VALUES ($1,'sms')", [n]);
}
module.exports = seed;
if (require.main === module) { const pool = new Pool({ connectionString: process.env.DATABASE_URL }); seed(pool).then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); }); }
