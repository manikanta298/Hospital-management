const router = require('express').Router();
const db = require('../db');
const { admin, auth } = require('../middleware/auth');
const { wrap } = require('../lib/http');
const cfg = require('../config/permissions');
const key = (f) => f.toLowerCase().replace(/ /g, '_');
router.use(auth, admin);
router.get('/', wrap(async (req, res) => res.json({ permissions: await db.q('SELECT * FROM permission'), permission_fields: cfg.permissions, groups: cfg.groups })));
// body: { admin: {patient_view:true, ...}, doctor: {...} }
router.post('/', wrap(async (req, res) => {
  const rows = [];
  for (const group of Object.keys(cfg.groups)) { const granted = req.body[group] || {}; for (const f of cfg.permissions) { const name = key(f); rows.push([name, group, granted[name] ? 'yes' : 'no']); } }
  await db.tx(async (c) => {
    await c.query('DELETE FROM permission');
    for (let i = 0; i < rows.length; i += 500) { const chunk = rows.slice(i, i + 500); await c.query(`INSERT INTO permission (permission_name, permission_group, permission_type) VALUES ${chunk.map((_, j) => `($${j * 3 + 1},$${j * 3 + 2},$${j * 3 + 3})`).join(',')}`, chunk.flat()); }
  });
  res.json({ success: 'Permissions saved.' });
}));
module.exports = router;
