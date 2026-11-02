const db = require('../db');
const { round2 } = require('../lib/http');
// Score a rule against a line: most specific match wins (service 4, department 2, patient type 1), -1 = no match.
function score(rule, serviceId, department, patientTypeId) {
  if (rule.payment_category_id && Number(rule.payment_category_id) !== Number(serviceId)) return -1;
  if (rule.department && String(rule.department).trim().toLowerCase() !== String(department ?? '').trim().toLowerCase()) return -1;
  if (rule.patient_type_id && Number(rule.patient_type_id) !== Number(patientTypeId)) return -1;
  return (rule.payment_category_id ? 4 : 0) + (rule.department ? 2 : 0) + (rule.patient_type_id ? 1 : 0);
}
async function ruleFor(doctorId, serviceId, department, patientTypeId, c) {
  const policyId = await db.val('SELECT share_policy_id FROM doctor WHERE id=$1', [doctorId], c);
  if (!policyId) return null;
  let best = null, bestScore = -1;
  for (const rule of await db.q('SELECT * FROM share_rule WHERE share_policy_id=$1 ORDER BY id', [policyId], c)) {
    const s = score(rule, serviceId, department, patientTypeId);
    if (s > bestScore) { best = rule; bestScore = s; }
  }
  return best;
}
async function write(invoice, item, doctorId, role, base, serviceId, department, c) {
  const rule = await ruleFor(doctorId, serviceId, department, invoice.patient_type_id, c);
  if (!rule) return;
  const percent = parseFloat(role === 'performing' ? rule.doctor_percent : rule.referral_percent) || 0;
  if (percent <= 0) return;
  await db.insert('doctor_share', { payment_id: invoice.id, invoice_item_id: item.id, doctor_id: doctorId, role, share_rule_id: rule.id, base_amount: base, percent, amount: round2((base * percent) / 100), status: 'pending' }, c);
}
// Rebuild the pending doctor shares for an invoice (shares already approved or paid freeze the invoice).
async function forInvoice(invoice, c) {
  if (await db.one("SELECT 1 FROM doctor_share WHERE payment_id=$1 AND status<>'pending' LIMIT 1", [invoice.id], c)) return;
  await db.q('DELETE FROM doctor_share WHERE payment_id=$1', [invoice.id], c);
  const items = await db.q('SELECT * FROM invoice_item WHERE payment_id=$1 ORDER BY id', [invoice.id], c);
  const subtotal = items.reduce((a, i) => a + parseFloat(i.line_total || 0), 0);
  const discount = Math.min(parseFloat(invoice.discount) || 0, subtotal);
  const ids = items.map((i) => i.payment_category_id).filter(Boolean);
  const services = ids.length ? Object.fromEntries((await db.q('SELECT * FROM payment_category WHERE id = ANY($1)', [ids], c)).map((s) => [s.id, s])) : {};
  for (const item of items) {
    const line = parseFloat(item.line_total) || 0;
    const base = subtotal > 0 ? round2(line - discount * (line / subtotal)) : 0;
    if (base <= 0) continue;
    const service = item.payment_category_id ? services[item.payment_category_id] : null;
    const department = service ? service.department : null;
    const performer = item.doctor_id || invoice.doctor;
    if (performer) await write(invoice, item, Number(performer), 'performing', base, item.payment_category_id, department, c);
    if (invoice.referring_doctor && Number(invoice.referring_doctor) !== Number(performer)) await write(invoice, item, Number(invoice.referring_doctor), 'referring', base, item.payment_category_id, department, c);
  }
}
module.exports = { forInvoice, ruleFor, score };
