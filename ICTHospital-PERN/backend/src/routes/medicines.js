const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, int } = require('../lib/http');
const paginate = require('../lib/paginate');

async function validated(req, ignoreId = null) {
  const d = validate(req.body, { name: 'required|max:100', category: 'nullable|integer', generic: 'nullable|max:100', company: 'nullable|max:100', price: 'nullable|numeric|min:0', s_price: 'nullable|numeric|min:0', box: 'nullable|max:100', quantity: 'nullable|integer|min:0', effects: 'nullable|max:100', e_date: 'nullable|date' });
  await assertExists(d, { category: 'medicine_category' });
  const clash = await db.one('SELECT 1 FROM medicine WHERE name=$1 AND box IS NOT DISTINCT FROM $2 AND ($3::int IS NULL OR id<>$3)', [d.name, d.box ?? null, ignoreId]);
  if (clash) throw new ValidationError({ name: ['That medicine is already in the catalogue with the same pack size.'] });
  return { name: d.name, category: d.category ?? null, generic: d.generic ?? null, company: d.company ?? null, price: d.price ?? null, s_price: d.s_price ?? null, box: d.box ?? null, quantity: int(d.quantity), effects: d.effects ?? null, e_date: d.e_date ?? null };
}
const categories = () => db.q('SELECT * FROM medicine_category ORDER BY category');

router.get('/', can('medicine_view'), wrap(async (req, res) => {
  const term = String(req.query.q || '').trim(); const categoryId = String(req.query.category || ''); const where = []; const params = [];
  if (term) { params.push(`%${term}%`); where.push(`(name ILIKE $${params.length} OR generic ILIKE $${params.length} OR company ILIKE $${params.length})`); }
  if (categoryId) { params.push(categoryId); where.push(`category=$${params.length}`); }
  res.json({ ...(await paginate(req, { from: 'medicine', where, params, order: 'name', perPage: 30 })), categories: await categories(), term, categoryId });
}));
router.get('/form-data', can('medicine_add'), wrap(async (req, res) => res.json({ categories: await categories() })));
router.get('/categories', can('medicine_view'), wrap(async (req, res) => res.json({ categories: await categories(), counts: Object.fromEntries((await db.q('SELECT category, COUNT(*)::int n FROM medicine GROUP BY category')).map((r) => [r.category, r.n])) })));
router.post('/categories', can('medicine_add'), wrap(async (req, res) => {
  const d = validate(req.body, { category: 'required|max:100', description: 'nullable|max:100' });
  res.status(201).json({ success: 'Category added.', category: await db.insert('medicine_category', { category: d.category, description: d.description ?? null }) });
}));
router.delete('/categories/:id(\\d+)', can('medicine_delete'), wrap(async (req, res) => {
  const c = notFound(await db.find('medicine_category', req.params.id));
  if (await db.one('SELECT 1 FROM medicine WHERE category=$1 LIMIT 1', [c.id])) return res.status(409).json({ error: 'That category still has medicines in it.' });
  await db.remove('medicine_category', c.id); res.json({ success: 'Category removed.' });
}));
router.post('/', can('medicine_add'), wrap(async (req, res) => {
  const m = await db.insert('medicine', { ...(await validated(req)), add_date: db.today() });
  res.status(201).json({ success: `${m.name} added to the catalogue.`, medicine: m });
}));
router.get('/:id(\\d+)/edit', can('medicine_update'), wrap(async (req, res) => res.json({ medicine: notFound(await db.find('medicine', req.params.id)), categories: await categories() })));
router.put('/:id(\\d+)', can('medicine_update'), wrap(async (req, res) => {
  const m = notFound(await db.find('medicine', req.params.id));
  const u = await db.update('medicine', m.id, await validated(req, m.id)); res.json({ success: `${u.name} updated.`, medicine: u });
}));
router.delete('/:id(\\d+)', can('medicine_delete'), wrap(async (req, res) => {
  const m = notFound(await db.find('medicine', req.params.id));
  if (await db.one('SELECT 1 FROM prescription_medicine WHERE medicine_id=$1 LIMIT 1', [m.id])) return res.status(409).json({ error: `${m.name} has been prescribed, so it stays in the catalogue.` });
  await db.remove('medicine', m.id); res.json({ success: `${m.name} removed.` });
}));
module.exports = router;
