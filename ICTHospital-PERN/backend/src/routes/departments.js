const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError } = require('../lib/http');

async function validated(req, ignoreId = null) {
  const d = validate(req.body, { name: 'required|max:100', description: 'nullable|max:1000' });
  if (await db.one('SELECT 1 FROM department WHERE name=$1 AND ($2::int IS NULL OR id<>$2)', [d.name, ignoreId])) throw new ValidationError({ name: ['That department is already on the list.'] });
  return { name: d.name, description: d.description ?? '', x: '', y: '' };
}
router.get('/', can('department_view'), wrap(async (req, res) => {
  const departments = await db.q('SELECT * FROM department ORDER BY name');
  const usage = Object.fromEntries((await db.q("SELECT department, COUNT(*)::int n FROM doctor WHERE department IS NOT NULL AND department<>'' GROUP BY department")).map((r) => [r.department, r.n]));
  const listed = new Set(departments.map((d) => d.name));
  res.json({ departments, usage, unlisted: Object.keys(usage).filter((n) => !listed.has(n)) });
}));
router.post('/', can('department_add'), wrap(async (req, res) => { const d = await validated(req); res.status(201).json({ success: `${d.name} added.`, department: await db.insert('department', d) }); }));
router.post('/adopt', can('department_add'), wrap(async (req, res) => {
  const existing = new Set((await db.q('SELECT name FROM department')).map((d) => d.name));
  const missing = (await db.q("SELECT DISTINCT department FROM doctor WHERE department IS NOT NULL AND department<>''")).map((r) => r.department).filter((n) => !existing.has(n));
  for (const name of missing) await db.insert('department', { name, description: '', x: '', y: '' });
  res.json({ success: missing.length === 0 ? 'Nothing to adopt, every department in use is already on the list.' : `Added ${missing.length} department(s) already in use by doctors.` });
}));
router.put('/:id(\\d+)', can('department_update'), wrap(async (req, res) => {
  const dep = notFound(await db.find('department', req.params.id)); const d = await validated(req, dep.id);
  const moved = await db.tx(async (c) => { await db.update('department', dep.id, d, c); return dep.name !== d.name ? (await c.query('UPDATE doctor SET department=$1 WHERE department=$2', [d.name, dep.name])).rowCount : 0; });
  res.json({ success: `${d.name} updated.${moved > 0 ? ` ${moved} doctor record(s) moved with it.` : ''}` });
}));
router.delete('/:id(\\d+)', can('department_delete'), wrap(async (req, res) => {
  const dep = notFound(await db.find('department', req.params.id)); const n = parseInt(await db.val('SELECT COUNT(*) FROM doctor WHERE department=$1', [dep.name]), 10);
  if (n > 0) return res.status(409).json({ error: `${dep.name} has ${n} doctor(s) in it. Move them first, or rename it instead.` });
  await db.remove('department', dep.id); res.json({ success: `${dep.name} removed.` });
}));
module.exports = router;
