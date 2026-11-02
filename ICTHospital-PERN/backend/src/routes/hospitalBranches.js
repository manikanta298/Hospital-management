const router = require('express').Router();
const db = require('../db');
const { can, auth } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, bool, int } = require('../lib/http');
const branch = require('../support/branch');
async function valid(req, ignore = null) {
  const d = validate(req.body, { name: 'required|max:100', address: 'nullable|max:255', phone: 'nullable|max:60' });
  if (await db.one('SELECT 1 FROM hospital_branch WHERE name=$1 AND ($2::int IS NULL OR id<>$2)', [d.name, ignore])) throw new ValidationError({ name: ['The name has already been taken.'] });
  return { name: d.name, address: d.address ?? null, phone: d.phone ?? null };
}
router.get('/', can('branch_view'), wrap(async (req, res) => res.json({ branches: await db.q('SELECT * FROM hospital_branch ORDER BY name'), users: await db.q('SELECT id, firstname, lastname, login, "group", branch_id FROM users ORDER BY firstname') })));
router.post('/', can('branch_add'), wrap(async (req, res) => res.status(201).json({ success: 'Branch added.', branch: await db.insert('hospital_branch', { ...(await valid(req)), active: true }) })));
router.put('/:id(\\d+)', can('branch_update'), wrap(async (req, res) => { const b = notFound(await db.find('hospital_branch', req.params.id)); await db.update('hospital_branch', b.id, { ...(await valid(req, b.id)), active: bool(req.body.active) }); res.json({ success: `Saved ${req.body.name}.` }); }));
router.post('/:id(\\d+)/assign', can('branch_update'), wrap(async (req, res) => {
  const b = notFound(await db.find('hospital_branch', req.params.id)); const ids = [].concat(req.body.users || []).map((x) => int(x)).filter(Boolean);
  await db.tx(async (c) => { await c.query('UPDATE users SET branch_id=NULL WHERE branch_id=$1 AND NOT (id = ANY($2))', [b.id, ids.length ? ids : [0]]); if (ids.length) await c.query('UPDATE users SET branch_id=$1 WHERE id = ANY($2)', [b.id, ids]); });
  res.json({ success: `${ids.length} user(s) work at ${b.name}.` });
}));
module.exports = router;
// The switcher in the header (only for users not tied to one branch).
module.exports.switchRouter = require('express').Router().post('/', auth, wrap(async (req, res) => {
  if (!branch.canSwitch(req)) return res.status(403).json({ error: 'You work at one branch only.' });
  const id = int(req.body.branch_id);
  if (id && (await db.one('SELECT 1 FROM hospital_branch WHERE active=TRUE AND id=$1', [id]))) req.session.branch_id = id; else delete req.session.branch_id;
  res.json({ success: true });
}));
