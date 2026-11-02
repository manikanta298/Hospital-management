const databaseConfig = require('../src/config/database');
// Applies db/schema.sql (idempotent: CREATE TABLE IF NOT EXISTS).
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs'); const path = require('path'); const { Pool } = require('pg');
module.exports = async function migrate(pool) { await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); };
if (require.main === module) { const pool = new Pool(databaseConfig()); module.exports(pool).then(() => { console.log('Schema applied.'); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); }); }
