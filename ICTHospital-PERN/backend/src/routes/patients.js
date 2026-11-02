const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, bool, nullIfBlank, ValidationError } = require('../lib/http');
const paginate = require('../lib/paginate');
const upload = require('../lib/upload').make('patients', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 2);
const { saveDataUrl } = require('../lib/photo');
const patientType = require('../support/patientType');
const D = require('../lib/dates');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ageOf = (b) => { const d = D.parse(b); if (!d) return ''; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--; return String(a); };

async function validated(req) {
  const b = req.body;
  const data = validate(b, {
    name: 'required|max:100', father_name: 'nullable|max:100', email: 'nullable|email|max:190', phone: 'nullable|max:100', address: 'nullable|max:100',
    sex: 'nullable|in:male,female,other',
    birthdate: ['nullable', 'date', (v) => (D.parse(v) > new Date() ? 'The birthdate must be a date before or equal to today.' : null)],
    bloodgroup: `nullable|in:${BLOOD_GROUPS.join(',')}`, doctor: 'nullable|max:100', patient_type_id: 'nullable|integer',
    cnic: ['nullable', (v) => (/^\d{5}-?\d{7}-?\d$/.test(v) ? null : 'A CNIC is 13 digits, written 12345-1234567-1.')],
    guardian_relation: 'nullable|max:40', guardian_mrn: 'nullable|max:20', old_mrn: 'nullable|max:40', employee_no: 'nullable|max:40', alt_phone: 'nullable|max:40', city: 'nullable|max:60',
  });
  if (data.patient_type_id && !(await db.find('patient_type', data.patient_type_id))) throw new ValidationError({ patient_type_id: ['The selected patient type id is invalid.'] });
  for (const k of ['cnic', 'guardian_relation', 'guardian_mrn', 'old_mrn', 'employee_no', 'alt_phone', 'city']) data[k] = nullIfBlank(data[k]);
  if (data.cnic) { const d = data.cnic.replace(/\D/g, ''); data.cnic = `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12, 13)}`; }
  data.mlc = bool(b.mlc);
  data.patient_type_id = data.patient_type_id || (await patientType.defaultId());
  for (const k of ['father_name', 'email', 'phone', 'address', 'sex', 'bloodgroup', 'doctor']) data[k] = data[k] ?? '';
  data.age = data.birthdate ? ageOf(data.birthdate) : '';
  return data;
}
const photoFrom = (req) => (req.file ? `patients/${req.file.filename}` : saveDataUrl(req.body.photo_data, 'patients'));

router.get('/', can('patient_view'), wrap(async (req, res) => {
  const term = String(req.query.q || '').trim(); const where = []; const params = [];
  if (term) { params.push(`%${term}%`); where.push(`(name ILIKE $1 OR patient_id ILIKE $1 OR cnic ILIKE $1 OR old_mrn ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)`); }
  res.json({ term, ...(await paginate(req, { from: 'patient', where, params, order: 'id DESC' })) });
}));

router.get('/form-data', can('patient_add'), wrap(async (req, res) => {
  res.json({
    doctors: (await db.q('SELECT name FROM doctor ORDER BY name')).map((d) => d.name), bloodGroups: BLOOD_GROUPS,
    patientTypes: await db.q('SELECT * FROM patient_type WHERE active=TRUE ORDER BY name'), allPatientTypes: await db.q('SELECT * FROM patient_type ORDER BY name'),
  });
}));

router.post('/', can('patient_add'), upload.single('photo'), wrap(async (req, res) => {
  const data = await validated(req);
  data.add_date = db.today(); data.registration_time = db.now(); data.how_added = 'front desk'; data.img_url = photoFrom(req) || ''; data.ion_user_id = '';
  const patient = await db.tx(async (c) => {
    const hi = await db.val("SELECT MAX(CAST(patient_id AS BIGINT)) FROM patient WHERE patient_id ~ '^[0-9]+$' ", [], c);
    await c.query('LOCK TABLE patient IN SHARE ROW EXCLUSIVE MODE');
    const h2 = await db.val("SELECT MAX(CAST(patient_id AS BIGINT)) FROM patient WHERE patient_id ~ '^[0-9]+$'", [], c);
    data.patient_id = String((parseInt(h2 || hi || 0, 10)) + 1).padStart(6, '0');
    return db.insert('patient', data, c);
  });
  res.status(201).json({ success: `Patient ${patient.patient_id} registered.`, patient });
}));

router.get('/:id(\\d+)', can('patient_view'), wrap(async (req, res) => {
  const patient = notFound(await db.find('patient', req.params.id)); const id = patient.id;
  const doctorNames = Object.fromEntries((await db.q('SELECT id, name FROM doctor')).map((d) => [d.id, d.name]));
  const appointments = await db.q('SELECT * FROM appointment WHERE patient=$1 ORDER BY date DESC, s_time DESC', [id]);
  const prescriptions = await db.q('SELECT * FROM prescription WHERE patient=$1 ORDER BY date DESC, id DESC', [id]);
  for (const p of prescriptions) p.items = await db.q('SELECT * FROM prescription_medicine WHERE prescription_id=$1 ORDER BY id', [p.id]);
  const labs = await db.q('SELECT * FROM lab WHERE patient=$1 ORDER BY date DESC, id DESC', [id]);
  for (const l of labs) l.tests = await db.q('SELECT * FROM lab_test WHERE lab_id=$1 ORDER BY id', [l.id]);
  const admissions = await db.q('SELECT * FROM alloted_bed WHERE patient=$1 ORDER BY a_time DESC, id DESC', [id]);
  const bedIds = admissions.map((a) => a.bed_id).filter(Boolean);
  const beds = bedIds.length ? Object.fromEntries((await db.q('SELECT * FROM bed WHERE id = ANY($1)', [bedIds])).map((b) => [b.id, b])) : {};
  const bedCategories = Object.fromEntries((await db.q('SELECT id, category FROM bed_category')).map((b) => [b.id, b.category]));
  const history = await db.q('SELECT * FROM medical_history WHERE patient_id=$1 ORDER BY date DESC, id DESC', [id]);
  const invoices = await db.q('SELECT * FROM payment WHERE patient=$1 ORDER BY date DESC, id DESC', [id]);
  for (const i of invoices) i.payments = await db.q('SELECT * FROM invoice_payment WHERE payment_id=$1 ORDER BY id', [i.id]);
  const billed = Math.round(invoices.reduce((a, i) => a + parseFloat(i.gross_total || 0), 0) * 100) / 100;
  const paid = Math.round(invoices.reduce((a, i) => a + i.payments.reduce((x, p) => x + parseFloat(p.amount || 0), 0), 0) * 100) / 100;
  res.json({ patient, doctorNames, appointments, prescriptions, labs, admissions, beds, bedCategories, history, invoices, billed, paid, outstanding: Math.round((billed - paid) * 100) / 100 });
}));

router.get('/:id(\\d+)/edit', can('patient_update'), wrap(async (req, res) => {
  res.json({ patient: notFound(await db.find('patient', req.params.id)), doctors: (await db.q('SELECT name FROM doctor ORDER BY name')).map((d) => d.name), bloodGroups: BLOOD_GROUPS, patientTypes: await db.q('SELECT * FROM patient_type ORDER BY name') });
}));

router.put('/:id(\\d+)', can('patient_update'), upload.single('photo'), wrap(async (req, res) => {
  const patient = notFound(await db.find('patient', req.params.id));
  const data = await validated(req); const photo = photoFrom(req); if (photo) data.img_url = photo;
  res.json({ success: 'Patient record updated.', patient: await db.update('patient', patient.id, data) });
}));

router.delete('/:id(\\d+)', can('patient_delete'), wrap(async (req, res) => {
  const patient = notFound(await db.find('patient', req.params.id));
  await db.remove('patient', patient.id);
  res.json({ success: `Deleted patient ${patient.patient_id} ${patient.name}.` });
}));

// Card / wristband data; the browser draws the CODE 128 barcode.
const card = (wristband) => wrap(async (req, res) => {
  const patient = notFound(await db.find('patient', req.params.id));
  res.json({ patient, wristband, type: patient.patient_type_id ? await db.find('patient_type', patient.patient_type_id) : null, institute: await db.one('SELECT * FROM institute LIMIT 1') });
});
router.get('/:id(\\d+)/card', can('patient_view'), card(false));
router.get('/:id(\\d+)/wristband', can('patient_view'), card(true));
module.exports = router;
