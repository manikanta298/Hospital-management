const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, round2, int, num } = require('../lib/http');
const D = require('../lib/dates');
const math = require('../support/invoiceMath');

const V = can('doctor_share_view'); const A = can('doctor_share_approve');
async function validRule(req) {
  const d = validate(req.body, { payment_category_id: 'nullable|integer', department: 'nullable|max:100', patient_type_id: 'nullable|integer', doctor_percent: 'required|numeric|min:0|max:100', referral_percent: 'nullable|numeric|min:0|max:100' });
  await assertExists(d, { payment_category_id: 'payment_category', patient_type_id: 'patient_type' });
  return { payment_category_id: d.payment_category_id ?? null, department: d.department && String(d.department).trim() !== '' ? String(d.department).trim() : null, patient_type_id: d.patient_type_id ?? null, doctor_percent: d.doctor_percent, referral_percent: d.referral_percent ?? 0 };
}
router.get('/policies', V, wrap(async (req, res) => {
  const policies = await db.q('SELECT * FROM share_policy ORDER BY name'); for (const p of policies) p.rules = await db.q('SELECT * FROM share_rule WHERE share_policy_id=$1 ORDER BY id', [p.id]);
  res.json({ policies, doctors: await db.q('SELECT id, name, department, share_policy_id FROM doctor ORDER BY name'), services: await db.q('SELECT id, category, department FROM payment_category ORDER BY category'), departments: (await db.q("SELECT DISTINCT department FROM payment_category WHERE department IS NOT NULL AND department<>'' ORDER BY department")).map((r) => r.department), types: await db.q('SELECT id, name FROM patient_type ORDER BY name') });
}));
router.post('/policies', A, wrap(async (req, res) => {
  const d = validate(req.body, { name: 'required|max:100', notes: 'nullable|max:255', doctor_percent: 'nullable|numeric|min:0|max:100' });
  if (await db.one('SELECT 1 FROM share_policy WHERE name=$1', [d.name])) throw new ValidationError({ name: ['The name has already been taken.'] });
  const p = await db.tx(async (c) => { const p = await db.insert('share_policy', { name: d.name, notes: d.notes ?? null, active: true }, c); await db.insert('share_rule', { share_policy_id: p.id, doctor_percent: d.doctor_percent ?? 0, referral_percent: 0 }, c); return p; });
  res.status(201).json({ success: `Policy ${p.name} added.`, policy: p });
}));
router.put('/policies/:id(\\d+)', A, wrap(async (req, res) => {
  const p = notFound(await db.find('share_policy', req.params.id)); const d = validate(req.body, { name: 'required|max:100', notes: 'nullable|max:255' });
  if (await db.one('SELECT 1 FROM share_policy WHERE name=$1 AND id<>$2', [d.name, p.id])) throw new ValidationError({ name: ['The name has already been taken.'] });
  await db.update('share_policy', p.id, { name: d.name, notes: d.notes ?? null }); res.json({ success: `Saved ${d.name}.` });
}));
router.delete('/policies/:id(\\d+)', A, wrap(async (req, res) => {
  const p = notFound(await db.find('share_policy', req.params.id));
  if (await db.one('SELECT 1 FROM doctor WHERE share_policy_id=$1 LIMIT 1', [p.id])) return res.status(409).json({ error: `Doctors are still on ${p.name}. Move them to another policy first.` });
  await db.tx(async (c) => { await db.q('DELETE FROM share_rule WHERE share_policy_id=$1', [p.id], c); await db.remove('share_policy', p.id, c); });
  res.json({ success: 'Policy deleted.' });
}));
router.post('/policies/:id(\\d+)/rules', A, wrap(async (req, res) => { const p = notFound(await db.find('share_policy', req.params.id)); await db.insert('share_rule', { share_policy_id: p.id, ...(await validRule(req)) }); res.status(201).json({ success: `Rule added to ${p.name}.` }); }));
router.post('/policies/:id(\\d+)/assign', A, wrap(async (req, res) => {
  const p = notFound(await db.find('share_policy', req.params.id)); const ids = [].concat(req.body.doctors || []).map((x) => int(x)).filter(Boolean);
  await db.tx(async (c) => { await c.query('UPDATE doctor SET share_policy_id=NULL WHERE share_policy_id=$1 AND NOT (id = ANY($2))', [p.id, ids.length ? ids : [0]]); if (ids.length) await c.query('UPDATE doctor SET share_policy_id=$1 WHERE id = ANY($2)', [p.id, ids]); });
  res.json({ success: `${ids.length} doctor(s) on ${p.name}.` });
}));
router.put('/rules/:id(\\d+)', A, wrap(async (req, res) => { const r = notFound(await db.find('share_rule', req.params.id)); await db.update('share_rule', r.id, await validRule(req)); res.json({ success: 'Rule saved. New invoices use it; shares already worked out are not changed.' }); }));
router.delete('/rules/:id(\\d+)', A, wrap(async (req, res) => { const r = notFound(await db.find('share_rule', req.params.id)); await db.remove('share_rule', r.id); res.json({ success: 'Rule removed.' }); }));

router.get('/', V, wrap(async (req, res) => {
  const now = new Date(); const q = req.query;
  const from = String(q.from || D.dateStr(new Date(now.getFullYear(), now.getMonth(), 1))); const to = String(q.to || db.today()); const doctor = String(q.doctor || ''); const role = String(q.role || ''); const status = String(q.status || ''); const paid = String(q.paid || '');
  const where = ['p.date >= $1', 'p.date <= $2']; const params = [from, to];
  if (doctor) { params.push(doctor); where.push(`s.doctor_id=$${params.length}`); } if (role) { params.push(role); where.push(`s.role=$${params.length}`); } if (status) { params.push(status); where.push(`s.status=$${params.length}`); }
  let shares = await db.q(`SELECT s.* FROM doctor_share s JOIN payment p ON p.id=s.payment_id WHERE ${where.join(' AND ')} ORDER BY s.doctor_id, s.payment_id`, params);
  const invIds = [...new Set(shares.map((s) => s.payment_id))]; const invoices = invIds.length ? await math.hydratePayments(await db.q('SELECT * FROM payment WHERE id = ANY($1)', [invIds])) : []; const invMap = Object.fromEntries(invoices.map((i) => [i.id, i]));
  const items = shares.length ? Object.fromEntries((await db.q('SELECT * FROM invoice_item WHERE id = ANY($1)', [shares.map((s) => s.invoice_item_id)])).map((i) => [i.id, i])) : {};
  for (const s of shares) { const inv = invMap[s.payment_id]; s.invoice = inv ? { id: inv.id, date: inv.date, patient_name: inv.patient_name, gross_total: inv.gross_total, balance: math.balance(inv) } : null; s.item = items[s.invoice_item_id] || null; }
  if (paid === 'paid') shares = shares.filter((s) => s.invoice && s.invoice.balance <= 0.004); else if (paid === 'unpaid') shares = shares.filter((s) => s.invoice && s.invoice.balance > 0.004);
  const doctors = await db.q('SELECT id, name FROM doctor ORDER BY name'); const byDoctor = {};
  for (const s of shares) { const g = (byDoctor[s.doctor_id] = byDoctor[s.doctor_id] || { pending: 0, approved: 0, paid: 0, hospital: 0 }); const a = parseFloat(s.amount); if (g[s.status] !== undefined) g[s.status] += a; if (s.role === 'performing') g.hospital += parseFloat(s.base_amount) - a; }
  for (const g of Object.values(byDoctor)) for (const k of Object.keys(g)) g[k] = round2(g[k]);
  res.json({ shares, doctorNames: Object.fromEntries(doctors.map((d) => [d.id, d.name])), doctors, byDoctor, filters: { from, to, doctor, role, status, paid } });
}));
router.post('/approve', A, wrap(async (req, res) => {
  const ids = [].concat(req.body.ids || []).map((x) => int(x)).filter(Boolean); let approved = 0, skipped = 0;
  await db.tx(async (c) => {
    for (const s of await db.q("SELECT * FROM doctor_share WHERE id = ANY($1) AND status='pending' FOR UPDATE", [ids.length ? ids : [0]], c)) {
      const [inv] = await math.hydratePayments([await db.find('payment', s.payment_id, c)], c);
      if (!inv || math.balance(inv) > 0.004) { skipped++; continue; }
      await db.update('doctor_share', s.id, { status: 'approved', approved_by: req.user.id, approved_at: db.now() }, c); approved++;
    }
  });
  const msg = `${approved} share(s) approved.${skipped ? ` ${skipped} skipped because the invoice is not paid in full yet.` : ''}`;
  res.status(approved ? 200 : 409).json(approved ? { success: msg } : { error: msg });
}));
router.post('/pay', A, wrap(async (req, res) => {
  const d = validate(req.body, { reference: 'nullable|max:60' }); const ids = [].concat(req.body.ids || []).map((x) => int(x)).filter(Boolean);
  if (!ids.length) throw new ValidationError({ ids: ['The ids field is required.'] });
  const ref = d.reference || `PAYOUT-${db.now().replace(/[-: ]/g, '').slice(0, 12)}`; let count = 0;
  await db.tx(async (c) => {
    const shares = await db.q("SELECT * FROM doctor_share WHERE id = ANY($1) AND status='approved' FOR UPDATE", [ids], c); if (!shares.length) return;
    if (!(await db.one("SELECT 1 FROM accounting_sector WHERE name='Doctor share' AND type='Expence'", [], c))) await db.insert('accounting_sector', { name: 'Doctor share', type: 'Expence' }, c);
    const names = Object.fromEntries((await db.q('SELECT id, name FROM doctor WHERE id = ANY($1)', [[...new Set(shares.map((s) => s.doctor_id))]], c)).map((x) => [x.id, x.name]));
    const groups = {}; for (const s of shares) (groups[s.doctor_id] = groups[s.doctor_id] || []).push(s);
    for (const [did, g] of Object.entries(groups)) await db.insert('accounting', { name: 'Doctor share', type: 'Expence', amount: round2(g.reduce((a, s) => a + parseFloat(s.amount), 0)), date: db.today(), description: `${names[did] || `Doctor ${did}`}: ${g.length} line(s), ${ref}` }, c);
    await c.query("UPDATE doctor_share SET status='paid', paid_at=$1, payout_ref=$2 WHERE id = ANY($3)", [db.now(), ref, shares.map((s) => s.id)]); count = shares.length;
  });
  res.status(count ? 200 : 409).json(count ? { success: `${count} share(s) paid, reference ${ref}.` } : { error: 'Only approved shares can be paid.' });
}));
module.exports = router;
