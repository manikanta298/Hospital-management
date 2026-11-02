// Patient types and the per-type price list. Mounted at /api (explicit paths).
const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, bool, round2, int, num } = require('../lib/http');
const patientType = require('../support/patientType');

async function validType(req, ignore = null) {
  const d = validate(req.body, { name: 'required|max:80', kind: `required|in:${Object.keys(patientType.KINDS).join(',')}`, company: 'nullable|max:120' });
  if (await db.one('SELECT 1 FROM patient_type WHERE name=$1 AND ($2::int IS NULL OR id<>$2)', [d.name, ignore])) throw new ValidationError({ name: ['The name has already been taken.'] });
  return { name: d.name, kind: d.kind, company: d.company ?? null, active: bool(req.body.active) };
}
router.get('/patient-types', can('service_view'), wrap(async (req, res) => res.json({ types: await db.q('SELECT * FROM patient_type ORDER BY name'), counts: Object.fromEntries((await db.q('SELECT patient_type_id, COUNT(*)::int n FROM patient GROUP BY patient_type_id')).map((r) => [r.patient_type_id, r.n])), kinds: patientType.KINDS })));
router.post('/patient-types', can('service_update'), wrap(async (req, res) => res.status(201).json({ success: 'Patient type added.', type: await db.insert('patient_type', await validType(req)) })));
router.put('/patient-types/:id(\\d+)', can('service_update'), wrap(async (req, res) => { const t = notFound(await db.find('patient_type', req.params.id)); await db.update('patient_type', t.id, await validType(req, t.id)); res.json({ success: `Saved ${req.body.name}.` }); }));
router.delete('/patient-types/:id(\\d+)', can('service_delete'), wrap(async (req, res) => {
  const t = notFound(await db.find('patient_type', req.params.id));
  if ((await db.one('SELECT 1 FROM patient WHERE patient_type_id=$1 LIMIT 1', [t.id])) || (await db.one('SELECT 1 FROM payment WHERE patient_type_id=$1 LIMIT 1', [t.id]))) { await db.update('patient_type', t.id, { active: false }); return res.json({ success: `${t.name} is in use, so it was switched off instead of deleted.` }); }
  await db.tx(async (c) => { await db.q('DELETE FROM service_price WHERE patient_type_id=$1', [t.id], c); await db.remove('patient_type', t.id, c); });
  res.json({ success: `Deleted ${t.name}.` });
}));

router.get('/pricing', can('service_view'), wrap(async (req, res) => {
  const types = await db.q('SELECT * FROM patient_type ORDER BY name'); const typeId = int(req.query.type) || (await patientType.defaultId()) || (types[0] && types[0].id);
  const term = String(req.query.q || '').trim(); const department = String(req.query.department || ''); const where = []; const params = [];
  if (term) { params.push(`%${term}%`); where.push(`category ILIKE $${params.length}`); } if (department) { params.push(department); where.push(`department=$${params.length}`); }
  const services = await db.q(`SELECT * FROM payment_category ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY category`, params);
  res.json({ types, typeId, type: types.find((t) => t.id === typeId) || null, services, prices: Object.fromEntries((await db.q('SELECT * FROM service_price WHERE patient_type_id=$1', [typeId])).map((p) => [p.payment_category_id, p])), term, department, departments: (await db.q("SELECT DISTINCT department FROM payment_category WHERE department IS NOT NULL AND department<>'' ORDER BY department")).map((r) => r.department) });
}));
router.post('/pricing', can('service_update'), wrap(async (req, res) => {
  const d = validate(req.body, { type: 'required|integer' }); await assertExists(d, { type: 'patient_type' });
  const opd = req.body.opd || {}; const ipd = req.body.ipd || {};
  for (const v of [...Object.values(opd), ...Object.values(ipd)]) if (v !== null && v !== '' && v !== undefined && (isNaN(Number(v)) || Number(v) < 0)) throw new ValidationError({ prices: ['A price must be a number of at least 0.'] });
  const ids = [...new Set([...Object.keys(opd), ...Object.keys(ipd)])];
  await db.tx(async (c) => {
    for (const sid of ids) {
      const o = opd[sid] === undefined || opd[sid] === null || opd[sid] === '' ? null : round2(parseFloat(opd[sid])); const i = ipd[sid] === undefined || ipd[sid] === null || ipd[sid] === '' ? null : round2(parseFloat(ipd[sid]));
      const existing = await db.one('SELECT * FROM service_price WHERE payment_category_id=$1 AND patient_type_id=$2', [sid, d.type], c);
      if (o === null && i === null) { if (existing) await db.remove('service_price', existing.id, c); continue; }
      if (existing) await db.update('service_price', existing.id, { opd_price: o, ipd_price: i }, c); else await db.insert('service_price', { payment_category_id: sid, patient_type_id: d.type, opd_price: o, ipd_price: i }, c);
    }
  });
  res.json({ success: 'Price list saved.', type: d.type });
}));
router.post('/pricing/copy', can('service_update'), wrap(async (req, res) => {
  const d = validate(req.body, { from: 'required|integer', to: ['required', 'integer', (v, b) => (String(v) === String(b.from) ? 'The to and from must be different.' : null)] });
  await assertExists({ from: d.from, to: d.to }, { from: 'patient_type', to: 'patient_type' });
  const count = await db.tx(async (c) => {
    await db.q('DELETE FROM service_price WHERE patient_type_id=$1', [d.to], c); const rows = await db.q('SELECT * FROM service_price WHERE patient_type_id=$1', [d.from], c);
    for (const r of rows) await db.insert('service_price', { payment_category_id: r.payment_category_id, patient_type_id: d.to, opd_price: r.opd_price, ipd_price: r.ipd_price }, c); return rows.length;
  });
  res.json({ success: `Copied ${count} price(s).`, type: d.to });
}));
router.post('/pricing/adjust', can('service_update'), wrap(async (req, res) => {
  const d = validate(req.body, { type: 'required|integer', percent: 'required|numeric|min:-90|max:500', setting: 'required|in:opd,ipd,both' }); await assertExists(d, { type: 'patient_type' });
  const factor = 1 + num(d.percent) / 100; const settings = d.setting === 'both' ? ['opd', 'ipd'] : [d.setting];
  await db.tx(async (c) => {
    for (const s of await db.q('SELECT * FROM payment_category', [], c)) {
      const row = await db.one('SELECT * FROM service_price WHERE payment_category_id=$1 AND patient_type_id=$2', [s.id, d.type], c); const patch = {};
      for (const k of settings) { const cur = row ? row[`${k}_price`] : null; const base = cur !== null && cur !== undefined ? parseFloat(cur) : parseFloat(s.c_price) || 0; patch[`${k}_price`] = round2(base * factor); }
      if (row) await db.update('service_price', row.id, patch, c); else await db.insert('service_price', { payment_category_id: s.id, patient_type_id: d.type, ...patch }, c);
    }
  });
  res.json({ success: `Prices adjusted by ${d.percent}%.`, type: d.type });
}));
router.get('/pricing/export', can('service_view'), wrap(async (req, res) => {
  const type = notFound(await db.find('patient_type', int(req.query.type) || (await patientType.defaultId())));
  const prices = Object.fromEntries((await db.q('SELECT * FROM service_price WHERE patient_type_id=$1', [type.id])).map((p) => [p.payment_category_id, p]));
  const rows = [['Service', 'Department', 'List price', 'OPD price', 'IPD price']];
  for (const s of await db.q('SELECT * FROM payment_category ORDER BY category')) { const p = prices[s.id]; rows.push([s.category, s.department, s.c_price, p && p.opd_price !== null ? p.opd_price : s.c_price, p && p.ipd_price !== null ? p.ipd_price : s.c_price]); }
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="price-list-${type.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv"` }).send(csv);
}));
module.exports = router;
