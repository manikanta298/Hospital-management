const db = require('../db');
// Place one radiology order per exam id, pre-filling findings from the exam's report template.
async function place(req, patient, doctorId, examIds, urgent = false, notes = null, appointmentId = null, c) {
  const ids = [...new Set(examIds.map((x) => parseInt(x, 10)).filter(Boolean))];
  if (!ids.length) return [];
  const out = [];
  for (const exam of await db.q('SELECT * FROM radiology_exam WHERE id = ANY($1) ORDER BY id', [ids], c)) {
    out.push(await db.insert('radiology_order', { patient_id: patient.id, doctor_id: doctorId || null, appointment_id: appointmentId, radiology_exam_id: exam.id, name: exam.name, modality: exam.modality, urgent: !!urgent, clinical_notes: notes, status: 'ordered', created_by: req.user ? req.user.id : null, findings: exam.report_template }, c));
  }
  return out;
}
module.exports = { place, STATUSES: { ordered: 'Ordered', scheduled: 'Scheduled', done: 'Done, awaiting report', reported: 'Reported', cancelled: 'Cancelled' } };
