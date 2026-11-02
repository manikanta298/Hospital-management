const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists } = require('../lib/http');

async function validated(req, ignoreId = null) {
  const d = validate(req.body, { category: 'required|integer', number: 'required|max:100', description: 'nullable|max:100' });
  await assertExists(d, { category: 'bed_category' });
  if (await db.one('SELECT 1 FROM bed WHERE category=$1 AND number=$2 AND ($3::int IS NULL OR id<>$3)', [d.category, d.number, ignoreId])) throw new ValidationError({ number: [`That ward already has a bed numbered ${d.number}.`] });
  return { category: d.category, number: d.number, description: d.description ?? '', status: 'free' };
}
const categories = () => db.q('SELECT * FROM bed_category ORDER BY category');

router.get('/', can('bed_view'), wrap(async (req, res) => {
  const categoryId = String(req.query.category || ''); const params = []; let w = '';
  if (categoryId) { params.push(categoryId); w = 'WHERE category=$1'; }
  const beds = await db.q(`SELECT * FROM bed ${w} ORDER BY category, number`, params);
  const occ = await db.q('SELECT * FROM alloted_bed WHERE d_time IS NULL'); const occupants = Object.fromEntries(occ.map((o) => [o.bed_id, o]));
  const pids = occ.map((o) => o.patient).filter(Boolean);
  res.json({ beds, categories: await categories(), categoryId, occupants, patients: pids.length ? Object.fromEntries((await db.q('SELECT id, name FROM patient WHERE id = ANY($1)', [pids])).map((p) => [p.id, p.name])) : {}, free: beds.filter((b) => !occupants[b.id]).length });
}));
router.get('/form-data', can('ward_add'), wrap(async (req, res) => res.json({ categories: await categories() })));
router.get('/categories', can('ward_view'), wrap(async (req, res) => res.json({ categories: await categories(), counts: Object.fromEntries((await db.q('SELECT category, COUNT(*)::int n FROM bed GROUP BY category')).map((r) => [r.category, r.n])) })));
router.post('/categories', can('ward_add'), wrap(async (req, res) => {
  const d = validate(req.body, { category: 'required|max:100', description: 'nullable|max:100' });
  res.status(201).json({ success: 'Ward type added.', category: await db.insert('bed_category', { category: d.category, description: d.description ?? '' }) });
}));
router.delete('/categories/:id(\\d+)', can('ward_delete'), wrap(async (req, res) => {
  const c = notFound(await db.find('bed_category', req.params.id));
  if (await db.one('SELECT 1 FROM bed WHERE category=$1 LIMIT 1', [c.id])) return res.status(409).json({ error: 'That ward type still has beds in it.' });
  await db.remove('bed_category', c.id); res.json({ success: 'Ward type removed.' });
}));
router.post('/', can('ward_add'), wrap(async (req, res) => {
  const bed = await db.insert('bed', { ...(await validated(req)), bed_id: '', last_a_time: null, last_d_time: null });
  res.status(201).json({ success: `Bed ${bed.number} added.`, bed });
}));
router.get('/:id(\\d+)/edit', can('ward_update'), wrap(async (req, res) => res.json({ bed: notFound(await db.find('bed', req.params.id)), categories: await categories() })));
router.put('/:id(\\d+)', can('ward_update'), wrap(async (req, res) => {
  const bed = notFound(await db.find('bed', req.params.id)); const u = await db.update('bed', bed.id, await validated(req, bed.id));
  res.json({ success: `Bed ${u.number} updated.`, bed: u });
}));
router.delete('/:id(\\d+)', can('ward_delete'), wrap(async (req, res) => {
  const bed = notFound(await db.find('bed', req.params.id));
  if (await db.one('SELECT 1 FROM alloted_bed WHERE bed_id=$1 AND d_time IS NULL LIMIT 1', [bed.id])) return res.status(409).json({ error: `Bed ${bed.number} is occupied. Discharge the patient first.` });
  await db.remove('bed', bed.id); res.json({ success: `Bed ${bed.number} removed.` });
}));
module.exports = router;
