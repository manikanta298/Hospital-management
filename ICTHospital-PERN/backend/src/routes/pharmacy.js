const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, money, num, int } = require('../lib/http');
const paginate = require('../lib/paginate');
const D = require('../lib/dates');

const withItems = async (rows) => { for (const r of rows) r.items = await db.q('SELECT * FROM pharmacy_sale_item WHERE pharmacy_payment_id=$1 ORDER BY id', [r.id]); return rows; };

async function buildLines(c, rows) {
  const lines = []; const wanted = {};
  for (const row of rows) {
    const id = row.medicine_id ? int(row.medicine_id) : null; const quantity = int(row.quantity); let name = String(row.name ?? '').trim();
    if (id && !(await db.find('medicine', id, c))) throw new ValidationError({ 'items.medicine_id': ['The selected medicine is invalid.'] });
    if (row.quantity !== undefined && row.quantity !== '' && (!/^-?\d+$/.test(String(row.quantity)) || quantity < 1)) throw new ValidationError({ 'items.quantity': ['The quantity must be at least 1.'] });
    if (row.unit_price !== undefined && row.unit_price !== '' && row.unit_price !== null && (isNaN(Number(row.unit_price)) || Number(row.unit_price) < 0)) throw new ValidationError({ 'items.unit_price': ['The unit price must be a number of at least 0.'] });
    const medicine = id ? await db.one('SELECT * FROM medicine WHERE id=$1 FOR UPDATE', [id], c) : null;
    if (medicine) name = medicine.name;
    if (name === '' || quantity < 1) continue;
    if (medicine) {
      wanted[medicine.id] = (wanted[medicine.id] || 0) + quantity;
      if (wanted[medicine.id] > int(medicine.quantity)) throw new ValidationError({ items: [`Only ${int(medicine.quantity)} of ${medicine.name} left in stock, and the sale asks for ${wanted[medicine.id]}.`] });
    }
    const given = row.unit_price; const unit = given !== undefined && given !== null && given !== '' ? parseFloat(given) : parseFloat(medicine ? medicine.s_price : 0) || 0;
    lines.push({ medicine, row: { medicine_id: medicine ? medicine.id : null, name, quantity, unit_price: money(unit), line_total: money(unit * quantity) } });
  }
  return lines;
}

router.get('/', can('pharmacy_stock_view'), wrap(async (req, res) => {
  const now = new Date(); const from = String(req.query.from || D.dateStr(new Date(now.getFullYear(), now.getMonth(), 1))); const to = String(req.query.to || db.today());
  const out = await paginate(req, { from: 'pharmacy_payment', where: ['date >= $1', 'date <= $2'], params: [from, to], order: 'id DESC', map: withItems });
  const ids = [...new Set(out.data.map((s) => s.patient).filter(Boolean))];
  res.json({ ...out, from, to, patients: ids.length ? Object.fromEntries((await db.q('SELECT id, name FROM patient WHERE id = ANY($1)', [ids])).map((p) => [p.id, p.name])) : {}, takings: num(await db.val('SELECT COALESCE(SUM(CAST(gross_total AS NUMERIC)),0) FROM pharmacy_payment WHERE date >= $1 AND date <= $2', [from, to])) });
}));
router.get('/form-data', can('pharmacy_sale'), wrap(async (req, res) => {
  let prescription = null;
  if (req.query.prescription) { prescription = await db.find('prescription', req.query.prescription); if (prescription) await withItemsRx(prescription); }
  res.json({ patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), medicines: await db.q('SELECT id, name, generic, quantity, s_price FROM medicine ORDER BY name'), prescription, selectedPatient: (prescription && prescription.patient) || req.query.patient || null });
}));
async function withItemsRx(p) { p.items = await db.q('SELECT * FROM prescription_medicine WHERE prescription_id=$1 ORDER BY id', [p.id]); }

router.post('/', can('pharmacy_sale'), wrap(async (req, res) => {
  const input = validate(req.body, { patient: 'nullable|integer', date: 'required|date', discount: 'nullable|numeric|min:0', vat: 'nullable|numeric|min:0', amount_received: 'nullable|numeric|min:0' });
  await assertExists(input, { patient: 'patient' });
  const sale = await db.tx(async (c) => {
    const lines = await buildLines(c, Array.isArray(req.body.items) ? req.body.items : []);
    if (!lines.length) throw new ValidationError({ items: ['Add at least one medicine to dispense.'] });
    const subtotal = lines.reduce((a, l) => a + parseFloat(l.row.line_total), 0); const discount = num(input.discount); const vat = num(input.vat); const gross = Math.max(0, subtotal - discount + vat);
    const sale = await db.insert('pharmacy_payment', { patient: input.patient ?? null, doctor: null, date: input.date, amount: money(subtotal), discount: money(discount), vat: money(vat), gross_total: money(gross), amount_received: money(input.amount_received !== null && input.amount_received !== undefined ? num(input.amount_received) : gross), status: 'paid' }, c);
    for (const l of lines) {
      await db.insert('pharmacy_sale_item', { ...l.row, pharmacy_payment_id: sale.id }, c);
      if (l.medicine) await db.q('UPDATE medicine SET quantity = quantity - $1 WHERE id=$2', [l.row.quantity, l.medicine.id], c);
    }
    const items = await db.q('SELECT * FROM pharmacy_sale_item WHERE pharmacy_payment_id=$1 ORDER BY id', [sale.id], c);
    return db.update('pharmacy_payment', sale.id, { category_name: items.map((i) => `${i.name} x${i.quantity}`).join(', ').slice(0, 1000), category_amount: items.map((i) => i.line_total).join(', ').slice(0, 1000) }, c);
  });
  res.status(201).json({ success: 'Dispensed and receipted.', sale });
}));
router.get('/:id(\\d+)', can('pharmacy_stock_view'), wrap(async (req, res) => {
  const sale = notFound(await db.find('pharmacy_payment', req.params.id)); await withItems([sale]);
  res.json({ sale, patient: sale.patient ? await db.find('patient', sale.patient) : null, institute: await db.one('SELECT * FROM institute LIMIT 1') });
}));
router.delete('/:id(\\d+)', can('pharmacy_sale'), wrap(async (req, res) => {
  const sale = notFound(await db.find('pharmacy_payment', req.params.id)); await withItems([sale]);
  await db.tx(async (c) => {
    for (const i of sale.items) if (i.medicine_id) await db.q('UPDATE medicine SET quantity = quantity + $1 WHERE id=$2', [i.quantity, i.medicine_id], c);
    await db.q('DELETE FROM pharmacy_sale_item WHERE pharmacy_payment_id=$1', [sale.id], c); await db.remove('pharmacy_payment', sale.id, c);
  });
  res.json({ success: 'Sale reversed and stock returned.' });
}));
module.exports = router;
