// Price list (payment_category) and service packages. Mounted at /api/services.
const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, int, money } = require('../lib/http');
const kinds = require('../support/serviceKinds');

async function validated(req, ignoreId = null) {
  const d = validate(req.body, { category: 'required|max:100', description: 'nullable|max:100', c_price: 'nullable|numeric|min:0', type: 'nullable|max:100', department: 'nullable|max:100', service_kind: `nullable|in:${Object.keys(kinds.KINDS).join(',')}`, d_commission: 'nullable|integer|min:0|max:100', h_commission: 'nullable|integer|min:0|max:100' });
  if (await db.one('SELECT 1 FROM payment_category WHERE category=$1 AND ($2::int IS NULL OR id<>$2)', [d.category, ignoreId])) throw new ValidationError({ category: ['That service is already on the price list.'] });
  return { category: d.category, description: d.description ?? null, c_price: d.c_price === null || d.c_price === undefined || d.c_price === '' ? null : money(d.c_price), type: d.type ?? null, department: d.department ?? null, service_kind: d.service_kind ?? null, d_commission: d.d_commission ?? null, h_commission: d.h_commission ?? null };
}
router.get('/', can('service_view'), wrap(async (req, res) => {
  const services = await db.q('SELECT * FROM payment_category ORDER BY type, category');
  const deps = (await db.q('SELECT name FROM department')).map((d) => d.name);
  res.json({ services, types: [...new Set(services.map((s) => s.type).filter(Boolean))].sort(), departments: [...new Set([...services.map((s) => s.department), ...deps].filter(Boolean))].sort(), usage: Object.fromEntries((await db.q('SELECT payment_category_id, COUNT(*)::int n FROM invoice_item WHERE payment_category_id IS NOT NULL GROUP BY payment_category_id')).map((r) => [r.payment_category_id, r.n])), kinds: kinds.KINDS });
}));
router.post('/', can('service_add'), wrap(async (req, res) => { const d = await validated(req); res.status(201).json({ success: `${d.category} added to the price list.`, service: await db.insert('payment_category', d) }); }));

// ---- packages (declared before /:id)
router.get('/:id(\\d+)/package', can('service_view'), wrap(async (req, res) => {
  const pkg = notFound(await db.find('payment_category', req.params.id)); const items = await db.q('SELECT * FROM service_package_item WHERE package_id=$1 ORDER BY id', [pkg.id]);
  const ids = items.map((i) => i.component_id); const names = ids.length ? Object.fromEntries((await db.q('SELECT * FROM payment_category WHERE id = ANY($1)', [ids])).map((s) => [s.id, s])) : {};
  res.json({ package: pkg, items, names, services: await db.q('SELECT id, category, c_price FROM payment_category WHERE id<>$1 ORDER BY category', [pkg.id]), componentValue: items.reduce((a, i) => a + (parseFloat((names[i.component_id] || {}).c_price) || 0) * i.quantity, 0) });
}));
router.post('/:id(\\d+)/package', can('service_update'), wrap(async (req, res) => {
  const pkg = notFound(await db.find('payment_category', req.params.id)); const d = validate(req.body, { component_id: 'required|integer', quantity: 'nullable|integer|min:1|max:999' });
  await assertExists(d, { component_id: 'payment_category' });
  if (int(d.component_id) === pkg.id) throw new ValidationError({ component_id: ['A package cannot contain itself.'] });
  if (pkg.service_kind !== 'package') await db.update('payment_category', pkg.id, { service_kind: 'package' });
  await db.insert('service_package_item', { package_id: pkg.id, component_id: d.component_id, quantity: d.quantity ?? 1 });
  res.status(201).json({ success: 'Added to the package.' });
}));
router.put('/:id(\\d+)', can('service_update'), wrap(async (req, res) => { const s = notFound(await db.find('payment_category', req.params.id)); const u = await db.update('payment_category', s.id, await validated(req, s.id)); res.json({ success: `${u.category} updated.` }); }));
router.delete('/:id(\\d+)', can('service_delete'), wrap(async (req, res) => {
  const s = notFound(await db.find('payment_category', req.params.id));
  if (await db.one('SELECT 1 FROM invoice_item WHERE payment_category_id=$1 LIMIT 1', [s.id])) return res.status(409).json({ error: `${s.category} has been invoiced, so it stays on the price list.` });
  await db.remove('payment_category', s.id); res.json({ success: `${s.category} removed.` });
}));
module.exports = router;
