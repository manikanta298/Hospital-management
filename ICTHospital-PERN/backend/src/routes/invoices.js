const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, money, round2, num, int } = require('../lib/http');
const branch = require('../support/branch');
const share = require('../support/shareCalculator');
const priceList = require('../support/priceList');
const patientType = require('../support/patientType');
const { itemSummary } = require('../support/billing');

const paidOf = (inv) => inv.payments.reduce((a, p) => a + parseFloat(p.amount || 0), 0);
const balanceOf = (inv) => round2(parseFloat(inv.gross_total || 0) - paidOf(inv));
const settlementOf = (inv) => { const p = paidOf(inv); if (p <= 0) return 'unpaid'; return balanceOf(inv) > 0.004 ? 'part paid' : 'paid'; };
async function hydrate(rows, c) { for (const r of rows) { r.items = await db.q('SELECT * FROM invoice_item WHERE payment_id=$1 ORDER BY id', [r.id], c); r.payments = await db.q('SELECT * FROM invoice_payment WHERE payment_id=$1 ORDER BY id', [r.id], c); r.paid = round2(paidOf(r)); r.balance = balanceOf(r); r.settlement = settlementOf(r); } return rows; }

async function buildItems(rows, typeId, setting) {
  const services = Object.fromEntries((await db.q('SELECT * FROM payment_category')).map((s) => [s.id, s]));
  const items = [];
  for (const row of rows) {
    const id = row.payment_category_id ? int(row.payment_category_id) : null; const service = id ? services[id] : null;
    if (id && !service) throw new ValidationError({ 'items.payment_category_id': ['The selected service is invalid.'] });
    if (row.doctor_id && !(await db.find('doctor', row.doctor_id))) throw new ValidationError({ 'items.doctor_id': ['The selected doctor is invalid.'] });
    if (row.quantity !== undefined && row.quantity !== '' && (!/^-?\d+$/.test(String(row.quantity)))) throw new ValidationError({ 'items.quantity': ['The quantity must be an integer.'] });
    if (row.unit_price !== undefined && row.unit_price !== '' && row.unit_price !== null && (isNaN(Number(row.unit_price)) || Number(row.unit_price) < 0)) throw new ValidationError({ 'items.unit_price': ['The unit price must be a number of at least 0.'] });
    let name = String(row.name ?? '').trim(); const quantity = row.quantity === undefined || row.quantity === '' ? 1 : int(row.quantity);
    if (service) name = service.category;
    if (name === '' || quantity < 1) continue;
    const given = row.unit_price; const unit = given !== undefined && given !== null && given !== '' ? parseFloat(given) : service ? await priceList.priceFor(service, typeId, setting) : 0;
    items.push({ payment_category_id: service ? service.id : null, name, quantity, unit_price: money(unit), line_total: money(unit * quantity), doctor_id: row.doctor_id ? int(row.doctor_id) : null });
  }
  return items;
}
async function validated(req) {
  const input = validate(req.body, { patient: 'required|integer', doctor: 'nullable|integer', referring_doctor: 'nullable|integer', date: 'required|date', discount: 'nullable|numeric|min:0', vat: 'nullable|numeric|min:0', remarks: 'nullable|max:500', patient_type_id: 'nullable|integer', care_setting: 'nullable|in:opd,ipd' });
  await assertExists(input, { patient: 'patient', doctor: 'doctor', referring_doctor: 'doctor', patient_type_id: 'patient_type' });
  const patient = await db.find('patient', input.patient);
  const typeId = input.patient_type_id || (patient && patient.patient_type_id) || (await patientType.defaultId()); const setting = input.care_setting || 'opd';
  const items = await buildItems(Array.isArray(req.body.items) ? req.body.items : [], typeId, setting);
  if (!items.length) throw new ValidationError({ items: ['Add at least one charge, or the invoice is for nothing.'] });
  const subtotal = items.reduce((a, i) => a + parseFloat(i.line_total), 0); const discount = num(input.discount); const vat = num(input.vat);
  if (discount > subtotal) throw new ValidationError({ discount: ['The discount is larger than the invoice.'] });
  const gross = round2(subtotal - discount + vat); const doctor = input.doctor ? await db.find('doctor', input.doctor) : null;
  return [{
    patient: input.patient, doctor: input.doctor ?? null, date: input.date, date_string: input.date, amount: money(subtotal), discount: money(discount), vat: money(vat), gross_total: money(gross), amount_received: '0.00',
    remarks: input.remarks ?? null, status: 'unpaid', user: String(req.user.id), patient_name: patient ? patient.name : null, patient_phone: patient ? patient.phone : null, patient_address: patient ? patient.address : null,
    doctor_name: doctor ? doctor.name : null, deposit_type: null, patient_type_id: typeId, care_setting: setting, referring_doctor: input.referring_doctor ?? null, branch_id: branch.current(req),
  }, items];
}

router.get('/', can('invoice_view'), wrap(async (req, res) => {
  const show = String(req.query.show || 'outstanding'); const patientId = String(req.query.patient || ''); const where = []; const params = []; branch.scope(req, where, params);
  if (patientId) { params.push(patientId); where.push(`patient=$${params.length}`); }
  let invoices = await hydrate(await db.q(`SELECT * FROM payment ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params));
  if (show === 'outstanding') invoices = invoices.filter((i) => i.balance > 0.004); else if (show === 'settled') invoices = invoices.filter((i) => i.balance <= 0.004);
  res.json({ invoices: invoices.slice(0, 200), show, patientId, patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), owed: invoices.reduce((a, i) => a + Math.max(0, i.balance), 0) });
}));
router.get('/form-data', can('payment_add'), wrap(async (req, res) => res.json({
  defaults: { date: db.today(), patient: req.query.patient || null, care_setting: req.query.setting || 'opd' }, patients: await db.q('SELECT id, name, patient_id, patient_type_id FROM patient ORDER BY name'),
  doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), services: await db.q('SELECT * FROM payment_category ORDER BY category'), patientTypes: await db.q('SELECT * FROM patient_type ORDER BY name'), priceMatrix: await priceList.matrix(), defaultType: await patientType.defaultId(),
})));
router.post('/', can('payment_add'), wrap(async (req, res) => {
  const [header, items] = await validated(req);
  const invoice = await db.tx(async (c) => {
    let inv = await db.insert('payment', header, c);
    for (const it of items) await db.insert('invoice_item', { ...it, payment_id: inv.id }, c);
    const rows = await db.q('SELECT * FROM invoice_item WHERE payment_id=$1 ORDER BY id', [inv.id], c);
    inv = await db.update('payment', inv.id, { category_name: rows.map(itemSummary).join(', ').slice(0, 1000), category_amount: rows.map((i) => i.line_total).join(', ').slice(0, 1000), category: rows.map((i) => i.payment_category_id).filter(Boolean).join(',') }, c);
    await share.forInvoice(inv, c); return inv;
  });
  res.status(201).json({ success: 'Invoice raised.', invoice });
}));
router.get('/:id(\\d+)', can('invoice_view'), wrap(async (req, res) => {
  const [inv] = await hydrate([notFound(await db.find('payment', req.params.id))]);
  res.json({ invoice: inv, patient: inv.patient ? await db.find('patient', inv.patient) : null, doctor: inv.doctor ? await db.find('doctor', inv.doctor) : null, institute: await db.one('SELECT * FROM institute LIMIT 1') });
}));
router.delete('/:id(\\d+)', can('payment_delete'), wrap(async (req, res) => {
  const [inv] = await hydrate([notFound(await db.find('payment', req.params.id))]);
  if (inv.paid > 0) return res.status(409).json({ error: 'Money has been taken against this invoice, so it cannot be deleted.' });
  if (await db.one("SELECT 1 FROM doctor_share WHERE payment_id=$1 AND status<>'pending' LIMIT 1", [inv.id])) return res.status(409).json({ error: 'A doctor share on this invoice is already approved or paid, so it cannot be deleted.' });
  await db.tx(async (c) => { await db.q('DELETE FROM doctor_share WHERE payment_id=$1', [inv.id], c); await db.q('DELETE FROM invoice_item WHERE payment_id=$1', [inv.id], c); await db.remove('payment', inv.id, c); });
  res.json({ success: 'Invoice removed.' });
}));
router.post('/:id(\\d+)/pay', can('payment_add'), wrap(async (req, res) => {
  notFound(await db.find('payment', req.params.id));
  const data = validate(req.body, { amount: 'required|numeric|min:0.01', method: 'nullable|max:60', reference: 'nullable|max:120' });
  const amount = round2(parseFloat(data.amount));
  await db.tx(async (c) => {
    await db.one('SELECT id FROM payment WHERE id=$1 FOR UPDATE', [req.params.id], c);
    const [cur] = await hydrate([await db.find('payment', req.params.id, c)], c);
    if (amount > cur.balance + 0.004) throw new ValidationError({ amount: [`Only ${cur.balance.toFixed(2)} is outstanding on this invoice.`] });
    await db.insert('invoice_payment', { payment_id: cur.id, amount: money(amount), method: data.method ?? null, reference: data.reference ?? null, paid_at: db.now(), received_by: req.user.id }, c);
    const [fresh] = await hydrate([await db.find('payment', cur.id, c)], c);
    await db.update('payment', cur.id, { amount_received: money(fresh.paid), status: fresh.settlement }, c);
  });
  res.json({ success: 'Payment recorded.' });
}));
module.exports = router;
