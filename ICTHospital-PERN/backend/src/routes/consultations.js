const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, int } = require('../lib/http');
const D = require('../lib/dates');
const labOrder = require('../support/labOrder');
const radiology = require('../support/radiologyOrder');

const SYSTEMS = { gpe: 'General physical examination', heent: 'HEENT', cvs: 'Cardiovascular', chest: 'Chest and lungs', abdomen: 'Abdomen', cns: 'Neurological', msk: 'Musculoskeletal', skin: 'Skin' };
const PAST = { diabetes: 'Diabetes', hypertension: 'Hypertension', asthma: 'Asthma', ihd: 'Ischaemic heart disease', epilepsy: 'Epilepsy', bleeding: 'Bleeding disorder', tb: 'Tuberculosis', hepatitis: 'Hepatitis' };
const VACCINES = ['BCG', 'OPV/IPV', 'Pentavalent (DTP-HepB-Hib)', 'PCV', 'Rotavirus', 'Measles/MR', 'Typhoid', 'Td (adult)', 'Hepatitis B', 'Influenza', 'COVID-19'];
const TEMPLATE_FIELDS = ['presenting_complaint', 'history', 'provisional_diagnosis', 'diagnosis', 'plan', 'treatment', 'follow_up_notes'];
const JSON_COLS = ['examination', 'past_history', 'social_history', 'specialty', 'immunizations'];

const parse = (row) => { if (!row) return row; const o = { ...row }; for (const k of JSON_COLS) { if (typeof o[k] === 'string') { try { o[k] = JSON.parse(o[k]); } catch { o[k] = null; } } } return o; };
const enc = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => !isEmpty(v)));
const nonEmpty = (o) => (Object.keys(o).length ? o : null);

// EDD = LMP + 280 days; gestational age in weeks and days as of today.
function obstetricDates(lmp) {
  if (!lmp) return [null, null];
  const l = D.parse(lmp); if (!l) return [null, null];
  const days = D.diffDays(l, new Date());
  return [D.dateStr(D.addDays(l, 280)), days >= 0 ? `${Math.floor(days / 7)}w ${days % 7}d` : null];
}

router.get('/', can('consultation_view'), wrap(async (req, res) => {
  const date = String(req.query.date || db.today()); const doctorId = String(req.query.doctor || '');
  const where = ['date=$1']; const params = [date]; if (doctorId) { params.push(doctorId); where.push('doctor_id=$2'); }
  const rows = (await db.q(`SELECT * FROM consultation WHERE ${where.join(' AND ')} ORDER BY id DESC`, params)).map(parse);
  const ids = [...new Set(rows.map((r) => r.patient_id))];
  res.json({ rows, date, doctorId, doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), doctorNames: Object.fromEntries((await db.q('SELECT id, name FROM doctor')).map((d) => [d.id, d.name])), patients: ids.length ? Object.fromEntries((await db.q('SELECT * FROM patient WHERE id = ANY($1)', [ids])).map((p) => [p.id, p])) : {} });
}));

router.get('/visit/:id(\\d+)', can('consultation_add'), wrap(async (req, res) => {
  const visit = notFound(await db.find('appointment', req.params.id));
  const patient = notFound(await db.find('patient', visit.patient));
  let c = parse(await db.one('SELECT * FROM consultation WHERE appointment_id=$1', [visit.id]));
  if (!c) {
    const last = parse(await db.one('SELECT * FROM consultation WHERE patient_id=$1 ORDER BY date DESC, id DESC LIMIT 1', [patient.id]));
    c = { id: null, appointment_id: visit.id, patient_id: patient.id, doctor_id: visit.doctor, date: visit.date || db.today(), allergies: last ? last.allergies : null, past_history: last ? last.past_history : null, social_history: last ? last.social_history : null, immunizations: last ? last.immunizations : null, status: 'draft' };
  }
  const orders = await db.q('SELECT * FROM lab WHERE patient=$1 AND date=$2', [patient.id, c.date || db.today()]);
  for (const o of orders) o.tests = await db.q('SELECT * FROM lab_test WHERE lab_id=$1 ORDER BY id', [o.id]);
  const templates = (await db.q('SELECT * FROM consult_template WHERE doctor_id IS NULL OR doctor_id=$1 ORDER BY name', [visit.doctor])).map((t) => { try { return { ...t, fields: JSON.parse(t.fields) }; } catch { return { ...t, fields: {} }; } });
  res.json({
    c, visit, patient, doctor: visit.doctor ? await db.find('doctor', visit.doctor) : null, labCatalogue: await db.q('SELECT id, category FROM lab_category ORDER BY category'),
    radiologyCatalogue: await db.q('SELECT id, name, modality FROM radiology_exam WHERE active=TRUE ORDER BY name'),
    templates, previous: (await db.q('SELECT * FROM consultation WHERE patient_id=$1 AND id<>$2 ORDER BY date DESC LIMIT 5', [patient.id, c.id || 0])).map(parse), orders,
    constants: { SYSTEMS, PAST, VACCINES, TEMPLATE_FIELDS },
  });
}));

router.post('/visit/:id(\\d+)', can('consultation_add'), wrap(async (req, res) => {
  const visit = notFound(await db.find('appointment', req.params.id));
  const patient = notFound(await db.find('patient', visit.patient));
  const b = req.body;
  const data = validate(b, {
    presenting_complaint: 'nullable|max:5000', history: 'nullable|max:10000', provisional_diagnosis: 'nullable|max:2000', diagnosis: 'nullable|max:2000', plan: 'nullable|max:5000', treatment: 'nullable|max:5000',
    follow_up_date: ['nullable', 'date', (v) => (v < db.today() ? 'The follow up date must be a date after or equal to today.' : null)], follow_up_notes: 'nullable|max:255', allergies: 'nullable|max:2000',
    b_p: 'nullable|max:100', pulse: 'nullable|max:100', temprature: 'nullable|max:100', weight: 'nullable|max:100', action: 'nullable|in:save,complete', template_name: 'nullable|max:100',
  });
  for (const f of ['exam', 'past', 'social', 'gynae', 'dental', 'eye', 'vaccines']) if (b[f] !== undefined && (typeof b[f] !== 'object' || Array.isArray(b[f]))) throw new ValidationError({ [f]: [`The ${f} must be an array.`] });
  for (const [k, v] of Object.entries(b.exam || {})) if (v.status && !['not_examined', 'normal', 'abnormal'].includes(v.status)) throw new ValidationError({ [`exam.${k}.status`]: ['The selected status is invalid.'] });
  const labTests = [].concat(b.lab_tests || []).map(Number).filter(Boolean); const radExams = [].concat(b.radiology_exams || []).map(Number).filter(Boolean);
  await Promise.all([...labTests.map((id) => assertExists({ lab_tests: id }, { lab_tests: 'lab_category' })), ...radExams.map((id) => assertExists({ radiology_exams: id }, { radiology_exams: 'radiology_exam' }))]);
  for (const v of Object.values(b.vaccines || {})) if (v && isNaN(Date.parse(v))) throw new ValidationError({ vaccines: ['The vaccine date is not a valid date.'] });
  const gynae = clean(b.gynae); if (gynae.lmp) [gynae.edd, gynae.gestational_age] = obstetricDates(gynae.lmp);
  const message = await db.tx(async (c) => {
    let con = await db.one('SELECT * FROM consultation WHERE appointment_id=$1', [visit.id], c);
    const exam = Object.fromEntries(Object.entries(b.exam || {}).map(([k, v]) => [k, clean(v)]).filter(([, v]) => !isEmpty(v)));
    const fields = {
      patient_id: patient.id, doctor_id: visit.doctor, date: (con && con.date) || visit.date || db.today(), presenting_complaint: data.presenting_complaint ?? null, history: data.history ?? null,
      provisional_diagnosis: data.provisional_diagnosis ?? null, diagnosis: data.diagnosis ?? null, plan: data.plan ?? null, treatment: data.treatment ?? null, follow_up_date: data.follow_up_date ?? null,
      follow_up_notes: data.follow_up_notes ?? null, allergies: data.allergies ?? null, examination: enc(nonEmpty(exam)), past_history: enc(nonEmpty(clean(b.past))), social_history: enc(nonEmpty(clean(b.social))),
      specialty: enc(nonEmpty(clean({ gynae, dental: clean(b.dental), eye: clean(b.eye) }))), immunizations: enc(nonEmpty(clean(b.vaccines))), created_by: (con && con.created_by) || req.user.id,
    };
    con = con ? await db.update('consultation', con.id, fields, c) : await db.insert('consultation', { ...fields, appointment_id: visit.id, status: 'draft' }, c);
    let v = await db.update('appointment', visit.id, { b_p: data.b_p ?? visit.b_p, pulse: data.pulse ?? visit.pulse, temprature: data.temprature ?? visit.temprature, weight: data.weight ?? visit.weight }, c);
    let msg = 'Consultation saved.';
    if (labTests.length) { const lab = await labOrder.create(req, patient, visit.doctor, labTests, c); if (lab) msg += ` Lab request #${lab.id} raised.`; }
    if (radExams.length) { const placed = await radiology.place(req, patient, visit.doctor, radExams, !!b.radiology_urgent && b.radiology_urgent !== '0', data.provisional_diagnosis ?? null, visit.id, c); msg += ` ${placed.length} radiology exam(s) ordered.`; }
    if (data.template_name) {
      await db.insert('consult_template', { name: data.template_name, doctor_id: visit.doctor, fields: JSON.stringify(Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, con[f]]))) }, c);
      msg += ` Template "${data.template_name}" saved.`;
    }
    if ((data.action || 'save') === 'complete') {
      await db.update('consultation', con.id, { status: 'completed', completed_at: db.now() }, c);
      await db.update('appointment', visit.id, { status: 'completed', checked_out_at: v.checked_out_at || db.now(), consult_started_at: v.consult_started_at || db.now() }, c);
      msg = msg.replace('Consultation saved.', 'Consultation completed and the patient checked out.');
    } else if (['scheduled', 'arrived'].includes(v.status)) {
      await db.update('appointment', visit.id, { status: 'in consultation', consult_started_at: v.consult_started_at || db.now(), checked_in_at: v.checked_in_at || db.now() }, c);
    }
    return msg;
  });
  res.json({ success: message });
}));

router.get('/:id(\\d+)/print', can('consultation_view'), wrap(async (req, res) => {
  const c = parse(notFound(await db.find('consultation', req.params.id)));
  res.json({ c, patient: await db.find('patient', c.patient_id), doctor: c.doctor_id ? await db.find('doctor', c.doctor_id) : null, visit: c.appointment_id ? await db.find('appointment', c.appointment_id) : null, institute: await db.one('SELECT * FROM institute LIMIT 1'), constants: { SYSTEMS, PAST } });
}));
router.delete('/templates/:id(\\d+)', can('consultation_add'), wrap(async (req, res) => { notFound(await db.find('consult_template', req.params.id)); await db.remove('consult_template', req.params.id); res.json({ success: 'Template removed.' }); }));
module.exports = router;
