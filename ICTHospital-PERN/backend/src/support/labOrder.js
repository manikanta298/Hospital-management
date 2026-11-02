const db = require('../db');
const testSummary = (t) => `${t.name}: ${t.result !== null && t.result !== '' ? t.result : 'pending'}`.trim();
// Place a lab request with one lab_test row per catalogue entry.
async function create(req, patient, doctorId, categoryIds, c) {
  const ids = [...new Set(categoryIds.map((x) => parseInt(x, 10)).filter(Boolean))];
  if (!ids.length) return null;
  const cats = await db.q('SELECT * FROM lab_category WHERE id = ANY($1)', [ids], c);
  if (!cats.length) return null;
  const byId = Object.fromEntries(cats.map((x) => [x.id, x]));
  const doctor = doctorId ? await db.find('doctor', doctorId, c) : null;
  const d = db.today();
  let lab = await db.insert('lab', { patient: patient.id, doctor: doctorId || null, date: d, date_string: d, patient_name: patient.name, patient_phone: patient.phone, patient_address: patient.address, doctor_name: doctor ? doctor.name : null, status: 'requested', user: String((req.user && req.user.id) || '') }, c);
  for (const id of ids) if (byId[id]) await db.insert('lab_test', { lab_id: lab.id, lab_category_id: id, name: byId[id].category, reference_value: byId[id].reference_value, result: null, status: 'requested' }, c);
  const tests = await db.q('SELECT * FROM lab_test WHERE lab_id=$1 ORDER BY id', [lab.id], c);
  lab = await db.update('lab', lab.id, { category: tests.map((t) => t.lab_category_id).filter(Boolean).join(','), category_name: tests.map((t) => t.name).join(', ').slice(0, 1000), report: tests.map(testSummary).join('\n').slice(0, 10000) }, c);
  return lab;
}
module.exports = { create, testSummary };
