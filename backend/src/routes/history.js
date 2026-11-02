const router = require('express').Router();
const path = require('path'); const fs = require('fs');
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, assertExists, abort } = require('../lib/http');
const paginate = require('../lib/paginate');
const { root } = require('../lib/upload');
const upload = require('../lib/upload').make('private/history', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 4);
const P = can('patient_medical_history');

async function validated(req) {
  const d = validate(req.body, { patient_id: 'required|integer', title: 'required|max:100', description: 'required|max:10000', date: 'nullable|date' });
  await assertExists(d, { patient_id: 'patient' });
  d.date = d.date ?? db.today(); const p = await db.find('patient', d.patient_id);
  d.patient_name = (p && p.name) || ''; d.patient_address = (p && p.address) || ''; d.patient_phone = (p && p.phone) || '';
  return d;
}
const patients = () => db.q('SELECT id, name, patient_id FROM patient ORDER BY name');
router.get('/', P, wrap(async (req, res) => {
  const patientId = req.query.patient ? String(req.query.patient) : ''; const term = String(req.query.q || '').trim(); const where = []; const params = [];
  if (patientId) { params.push(patientId); where.push(`patient_id=$${params.length}`); }
  if (term) { params.push(`%${term}%`); where.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length} OR patient_name ILIKE $${params.length})`); }
  res.json({ ...(await paginate(req, { from: 'medical_history', where, params, order: 'date DESC, id DESC' })), term, patientId, patient: patientId ? await db.find('patient', patientId) : null, patients: await patients() });
}));
router.get('/form-data', P, wrap(async (req, res) => res.json({ patients: await patients(), patientId: req.query.patient || null })));
router.post('/', P, upload.single('attachment'), wrap(async (req, res) => {
  const d = await validated(req); d.img_url = req.file ? `private/history/${req.file.filename}` : ''; d.registration_time = db.now();
  const e = await db.insert('medical_history', d); res.status(201).json({ success: `Added "${e.title}" to the history.`, entry: e });
}));
router.get('/:id(\\d+)/edit', P, wrap(async (req, res) => res.json({ entry: notFound(await db.find('medical_history', req.params.id)), patients: await patients() })));
router.put('/:id(\\d+)', P, upload.single('attachment'), wrap(async (req, res) => {
  const e = notFound(await db.find('medical_history', req.params.id)); const d = await validated(req); if (req.file) d.img_url = `private/history/${req.file.filename}`;
  res.json({ success: 'History entry updated.', entry: await db.update('medical_history', e.id, d) });
}));
router.delete('/:id(\\d+)', P, wrap(async (req, res) => { const e = notFound(await db.find('medical_history', req.params.id)); await db.remove('medical_history', e.id); res.json({ success: `Removed "${e.title}".`, patient_id: e.patient_id }); }));
// Attachments are private: only served through this permission-checked route.
router.get('/:id(\\d+)/attachment', P, wrap(async (req, res) => {
  const e = notFound(await db.find('medical_history', req.params.id)); const rel = String(e.img_url || ''); if (!rel) abort(404);
  const file = path.resolve(root, rel); if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) abort(404);
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); res.sendFile(file);
}));
module.exports = router;
