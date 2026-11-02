const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists } = require('../lib/http');
const D = require('../lib/dates');

const catMap = async () => Object.fromEntries((await db.q('SELECT id, category FROM bed_category')).map((c) => [c.id, c.category]));

router.get('/', can('admission_view'), wrap(async (req, res) => {
  const show = String(req.query.show || 'current'); const where = show === 'current' ? 'WHERE d_time IS NULL' : show === 'discharged' ? 'WHERE d_time IS NOT NULL' : '';
  const admissions = await db.q(`SELECT * FROM alloted_bed ${where} ORDER BY a_time DESC LIMIT 200`);
  const pids = admissions.map((a) => a.patient).filter(Boolean); const bids = admissions.map((a) => a.bed_id).filter(Boolean);
  res.json({ admissions, show, patients: pids.length ? Object.fromEntries((await db.q('SELECT id, name FROM patient WHERE id = ANY($1)', [pids])).map((p) => [p.id, p.name])) : {}, beds: bids.length ? Object.fromEntries((await db.q('SELECT * FROM bed WHERE id = ANY($1)', [bids])).map((b) => [b.id, b])) : {}, categories: await catMap() });
}));
router.get('/form-data', can('admission_add'), wrap(async (req, res) => {
  res.json({ patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), freeBeds: await db.q('SELECT * FROM bed WHERE id NOT IN (SELECT bed_id FROM alloted_bed WHERE d_time IS NULL AND bed_id IS NOT NULL) ORDER BY category, number'), categories: await catMap(), selectedPatient: req.query.patient || null });
}));
router.post('/', can('admission_add'), wrap(async (req, res) => {
  const data = validate(req.body, { patient: 'required|integer', bed_id: 'required|integer', a_time: 'nullable|date' });
  await assertExists(data, { patient: 'patient', bed_id: 'bed' });
  const bed = notFound(await db.find('bed', data.bed_id)); const admitted = data.a_time ? D.parse(data.a_time) : new Date();
  await db.tx(async (c) => {
    if (await db.one('SELECT 1 FROM alloted_bed WHERE bed_id=$1 AND d_time IS NULL FOR UPDATE', [bed.id], c)) throw new ValidationError({ bed_id: ['That bed is already occupied.'] });
    if (await db.one('SELECT 1 FROM alloted_bed WHERE patient=$1 AND d_time IS NULL FOR UPDATE', [data.patient], c)) throw new ValidationError({ patient: ['That patient is already admitted. Discharge them first.'] });
    await db.insert('alloted_bed', { patient: data.patient, bed_id: bed.id, number: bed.number, category: bed.category, a_time: D.dateTimeStr(admitted), d_time: null, status: 'admitted', x: '' }, c);
    await db.update('bed', bed.id, { status: 'occupied', last_a_time: D.dateTimeStr(admitted) }, c);
  });
  res.status(201).json({ success: 'Patient admitted.' });
}));
router.get('/:id(\\d+)', can('admission_view'), wrap(async (req, res) => {
  const a = notFound(await db.find('alloted_bed', req.params.id));
  res.json({ admission: a, patient: a.patient ? await db.find('patient', a.patient) : null, bed: a.bed_id ? await db.find('bed', a.bed_id) : null, categories: await catMap() });
}));
router.post('/:id(\\d+)/discharge', can('admission_discharge'), wrap(async (req, res) => {
  const a = notFound(await db.find('alloted_bed', req.params.id));
  if (a.d_time) return res.status(409).json({ error: `That admission was already discharged on ${a.d_time}.` });
  const data = validate(req.body, { d_time: 'nullable|date' }); const left = data.d_time ? D.parse(data.d_time) : new Date();
  if (a.a_time && left < D.parse(a.a_time)) throw new ValidationError({ d_time: ['A patient cannot be discharged before they were admitted.'] });
  await db.tx(async (c) => {
    await db.update('alloted_bed', a.id, { d_time: D.dateTimeStr(left), status: 'discharged' }, c);
    if (a.bed_id) await db.update('bed', a.bed_id, { status: 'free', last_d_time: D.dateTimeStr(left) }, c);
  });
  res.json({ success: 'Patient discharged.' });
}));
module.exports = router;
