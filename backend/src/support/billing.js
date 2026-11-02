const db = require('../db');
const { round2, money } = require('../lib/http');
const priceList = require('./priceList');
const patientType = require('./patientType');
const share = require('./shareCalculator');
const branch = require('./branch');
const itemSummary = (i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name);
// Raise an unpaid invoice for a patient from service lines [{service, quantity?, price?, name?}].
async function raise(req, patient, doctorId, lines, setting = 'opd', remarks = null, c) {
  const typeId = patient.patient_type_id || (await patientType.defaultId(c));
  const items = [];
  for (const l of lines) {
    const qty = Math.max(1, parseInt(l.quantity ?? 1, 10) || 1);
    const unit = l.price !== undefined && l.price !== null ? round2(parseFloat(l.price)) : await priceList.priceFor(l.service, typeId, setting, c);
    items.push({ payment_category_id: l.service.id, name: l.name ?? l.service.category, quantity: qty, unit_price: money(unit), line_total: money(unit * qty) });
  }
  const subtotal = items.reduce((a, i) => a + parseFloat(i.line_total), 0);
  const doctor = doctorId ? await db.find('doctor', doctorId, c) : null;
  const d = db.today();
  let invoice = await db.insert('payment', {
    patient: patient.id, doctor: doctorId || null, date: d, date_string: d, amount: money(subtotal), discount: '0.00', vat: '0.00',
    gross_total: money(subtotal), amount_received: '0.00', remarks, status: 'unpaid', user: String((req.user && req.user.id) || ''),
    patient_name: patient.name, patient_phone: patient.phone, patient_address: patient.address, doctor_name: doctor ? doctor.name : null,
    patient_type_id: typeId, care_setting: setting, branch_id: branch.current(req),
  }, c);
  for (const it of items) await db.insert('invoice_item', { ...it, payment_id: invoice.id }, c);
  const rows = await db.q('SELECT * FROM invoice_item WHERE payment_id=$1 ORDER BY id', [invoice.id], c);
  invoice = await db.update('payment', invoice.id, {
    category_name: rows.map(itemSummary).join(', ').slice(0, 1000),
    category_amount: rows.map((i) => i.line_total).join(', ').slice(0, 1000),
    category: rows.map((i) => i.payment_category_id).filter(Boolean).join(','),
  }, c);
  await share.forInvoice(invoice, c);
  return invoice;
}
module.exports = { raise, itemSummary };
