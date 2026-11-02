const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists } = require('../lib/http');
const paginate = require('../lib/paginate');

const itemSummary = (i) => [i.name, i.dosage, i.duration ? `for ${i.duration}` : null].filter(Boolean).join(' ').trim();
const blank = (v) => { v = String(v ?? '').trim(); return v === '' ? null : v; };

async function validated(req) {
  const input = validate(req.body, { patient: 'required|integer', doctor: 'required|integer', date: 'required|date', symptom: 'nullable|max:100', advice: 'nullable|max:1000', note: 'nullable|max:1000', validity: 'nullable|max:100' });
  await assertExists(input, { patient: 'patient', doctor: 'doctor' });
  const rows = Array.isArray(req.body.items) ? req.body.items : [];
  const catalogue = Object.fromEntries((await db.q('SELECT id, name FROM medicine')).map((m) => [m.id, m.name]));
  const items = [];
  for (const row of rows) {
    const id = row.medicine_id ? parseInt(row.medicine_id, 10) : null; let name = String(row.name ?? '').trim();
    if (id && !catalogue[id]) throw new ValidationError({ 'items.medicine_id': ['The selected medicine is invalid.'] });
    if (id && catalogue[id]) name = catalogue[id];
    if (name === '') continue;
    if (name.length > 200) throw new ValidationError({ 'items.name': ['The name may not be greater than 200 characters.'] });
    items.push({ medicine_id: id || null, name, dosage: blank(row.dosage), duration: blank(row.duration), instructions: blank(row.instructions) });
  }
  if (!items.length) throw new ValidationError({ items: ['Add at least one medicine, or this prescription says nothing.'] });
  return [{ patient: input.patient, doctor: input.doctor, date: input.date, symptom: input.symptom ?? null, advice: input.advice ?? null, note: input.note ?? null, validity: input.validity ?? null, state: 'issued', dd: null, medicine: null }, items];
}
async function syncItems(c, id, items) {
  await db.q('DELETE FROM prescription_medicine WHERE prescription_id=$1', [id], c);
  for (const it of items) await db.insert('prescription_medicine', { ...it, prescription_id: id }, c);
  const rows = await db.q('SELECT * FROM prescription_medicine WHERE prescription_id=$1 ORDER BY id', [id], c);
  await db.update('prescription', id, { medicine: rows.map(itemSummary).join(', ').slice(0, 1000) }, c);
}
const withItems = async (rows) => { for (const r of rows) r.items = await db.q('SELECT * FROM prescription_medicine WHERE prescription_id=$1 ORDER BY id', [r.id]); return rows; };
const formData = async () => ({ patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), medicines: await db.q('SELECT id, name, generic FROM medicine ORDER BY name') });

router.get('/', can('prescription_view'), wrap(async (req, res) => {
  const { patient = '', doctor = '', drug = '' } = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v).trim()]));
  const where = []; const params = [];
  if (patient) { params.push(patient); where.push(`patient=$${params.length}`); }
  if (doctor) { params.push(doctor); where.push(`doctor=$${params.length}`); }
  if (drug) { params.push(`%${drug}%`); where.push(`EXISTS (SELECT 1 FROM prescription_medicine pm WHERE pm.prescription_id=prescription.id AND pm.name ILIKE $${params.length})`); }
  const out = await paginate(req, { from: 'prescription', where, params, order: 'id DESC', map: withItems });
  res.json({ ...out, ...(await formData()), patientId: patient, doctorId: doctor, drug });
}));
router.get('/form-data', can('prescription_add'), wrap(async (req, res) => res.json(await formData())));
router.post('/', can('prescription_add'), wrap(async (req, res) => {
  const [fields, items] = await validated(req);
  const p = await db.tx(async (c) => { const p = await db.insert('prescription', fields, c); await syncItems(c, p.id, items); return p; });
  res.status(201).json({ success: 'Prescription saved.', prescription: p });
}));
router.get('/:id(\\d+)', can('prescription_view'), wrap(async (req, res) => {
  const p = notFound(await db.find('prescription', req.params.id)); await withItems([p]);
  res.json({ prescription: p, patient: p.patient ? await db.find('patient', p.patient) : null, doctor: p.doctor ? await db.find('doctor', p.doctor) : null, institute: await db.one('SELECT * FROM institute LIMIT 1') });
}));
router.get('/:id(\\d+)/edit', can('prescription_update'), wrap(async (req, res) => { const p = notFound(await db.find('prescription', req.params.id)); await withItems([p]); res.json({ prescription: p, ...(await formData()) }); }));
router.put('/:id(\\d+)', can('prescription_update'), wrap(async (req, res) => {
  const p = notFound(await db.find('prescription', req.params.id)); const [fields, items] = await validated(req);
  await db.tx(async (c) => { await db.update('prescription', p.id, fields, c); await syncItems(c, p.id, items); });
  res.json({ success: 'Prescription updated.' });
}));
router.delete('/:id(\\d+)', can('prescription_delete'), wrap(async (req, res) => {
  const p = notFound(await db.find('prescription', req.params.id));
  await db.tx(async (c) => { await db.q('DELETE FROM prescription_medicine WHERE prescription_id=$1', [p.id], c); await db.remove('prescription', p.id, c); });
  res.json({ success: 'Prescription removed.' });
}));
module.exports = router;
