const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists } = require('../lib/http');
const paginate = require('../lib/paginate');
const { testSummary } = require('../support/labOrder');

const reported = (t) => t.result !== null && t.result !== '';
async function refreshSummary(c, labId) {
  const tests = await db.q('SELECT * FROM lab_test WHERE lab_id=$1 ORDER BY id', [labId], c); const n = tests.filter(reported).length;
  const status = n === 0 ? 'requested' : n === tests.length ? 'reported' : 'partial';
  await db.update('lab', labId, { category: tests.map((t) => t.lab_category_id).filter(Boolean).join(','), category_name: tests.map((t) => t.name).join(', ').slice(0, 1000), report: tests.map(testSummary).join('\n').slice(0, 10000), status, report_date: status === 'reported' ? db.now() : null }, c);
}
const withTests = async (rows) => { for (const r of rows) r.tests = await db.q('SELECT * FROM lab_test WHERE lab_id=$1 ORDER BY id', [r.id]); return rows; };

// ---- catalogue (must be declared before /:id)
async function validCat(req, ignoreId = null) {
  const d = validate(req.body, { category: 'required|max:100', description: 'nullable|max:100', reference_value: 'nullable|max:1000', procedure_id: 'nullable|max:100' });
  if (await db.one('SELECT 1 FROM lab_category WHERE category=$1 AND ($2::int IS NULL OR id<>$2)', [d.category, ignoreId])) throw new ValidationError({ category: ['That test is already in the catalogue.'] });
  return { category: d.category, description: d.description ?? null, reference_value: d.reference_value ?? null, procedure_id: d.procedure_id ?? null };
}
router.get('/catalogue', can('lab_test_view'), wrap(async (req, res) => res.json({ catalogue: await db.q('SELECT * FROM lab_category ORDER BY category'), usage: Object.fromEntries((await db.q('SELECT lab_category_id, COUNT(*)::int n FROM lab_test GROUP BY lab_category_id')).map((r) => [r.lab_category_id, r.n])) })));
router.post('/catalogue', can('lab_test_add'), wrap(async (req, res) => { const d = await validCat(req); res.status(201).json({ success: `${d.category} added.`, category: await db.insert('lab_category', d) }); }));
router.put('/catalogue/:id(\\d+)', can('lab_test_update'), wrap(async (req, res) => { const c = notFound(await db.find('lab_category', req.params.id)); await db.update('lab_category', c.id, await validCat(req, c.id)); res.json({ success: 'Test updated.' }); }));
router.delete('/catalogue/:id(\\d+)', can('lab_test_delete'), wrap(async (req, res) => {
  const c = notFound(await db.find('lab_category', req.params.id));
  if (await db.one('SELECT 1 FROM lab_test WHERE lab_category_id=$1 LIMIT 1', [c.id])) return res.status(409).json({ error: `${c.category} has been requested, so it stays in the catalogue.` });
  await db.remove('lab_category', c.id); res.json({ success: `${c.category} removed.` });
}));

router.get('/', can('lab_test_view'), wrap(async (req, res) => {
  const status = String(req.query.status || 'pending'); const patientId = String(req.query.patient || ''); const where = []; const params = [];
  if (patientId) { params.push(patientId); where.push(`patient=$${params.length}`); }
  const open = "EXISTS (SELECT 1 FROM lab_test t WHERE t.lab_id=lab.id AND (t.result IS NULL OR t.result=''))";
  if (status === 'pending') where.push(open); else if (status === 'reported') where.push(`NOT ${open}`);
  const out = await paginate(req, { from: 'lab', where, params, order: 'id DESC', map: withTests });
  res.json({ ...out, status, patientId, patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name') });
}));
router.get('/form-data', can('lab_test_add'), wrap(async (req, res) => res.json({ patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), catalogue: await db.q('SELECT * FROM lab_category ORDER BY category') })));
router.post('/', can('lab_test_add'), wrap(async (req, res) => {
  const input = validate(req.body, { patient: 'required|integer', doctor: 'nullable|integer', date: 'required|date' });
  await assertExists(input, { patient: 'patient', doctor: 'doctor' });
  const tests = [...new Set([].concat(req.body.tests || []).map(Number).filter(Boolean))];
  for (const t of tests) await assertExists({ tests: t }, { tests: 'lab_category' });
  if (!tests.length) throw new ValidationError({ tests: ['Choose at least one test, or the request asks for nothing.'] });
  const lab = await db.tx(async (c) => {
    const patient = await db.find('patient', input.patient, c); const doctor = input.doctor ? await db.find('doctor', input.doctor, c) : null;
    const lab = await db.insert('lab', { patient: input.patient, doctor: input.doctor ?? null, date: input.date, date_string: input.date, patient_name: patient.name, patient_phone: patient.phone, patient_address: patient.address, doctor_name: doctor ? doctor.name : null, status: 'requested', user: String(req.user.id) }, c);
    const cats = Object.fromEntries((await db.q('SELECT * FROM lab_category WHERE id = ANY($1)', [tests], c)).map((x) => [x.id, x]));
    for (const id of tests) if (cats[id]) await db.insert('lab_test', { lab_id: lab.id, lab_category_id: id, name: cats[id].category, reference_value: cats[id].reference_value, result: null, status: 'requested' }, c);
    await refreshSummary(c, lab.id); return lab;
  });
  res.status(201).json({ success: 'Lab request raised.', lab });
}));
router.get('/:id(\\d+)', can('lab_test_view'), wrap(async (req, res) => {
  const lab = notFound(await db.find('lab', req.params.id)); await withTests([lab]);
  res.json({ request: lab, patient: lab.patient ? await db.find('patient', lab.patient) : null, doctor: lab.doctor ? await db.find('doctor', lab.doctor) : null, institute: await db.one('SELECT * FROM institute LIMIT 1') });
}));
router.post('/:id(\\d+)/results', can('lab_test_update'), wrap(async (req, res) => {
  const lab = notFound(await db.find('lab', req.params.id)); const results = req.body.results || {};
  for (const v of Object.values(results)) if (v !== null && v !== undefined && String(v).length > 1000) throw new ValidationError({ results: ['A result may not be greater than 1000 characters.'] });
  await db.tx(async (c) => {
    for (const t of await db.q('SELECT * FROM lab_test WHERE lab_id=$1', [lab.id], c)) {
      const v = String(results[t.id] ?? '').trim();
      if (v === '' && reported(t)) continue;
      await db.update('lab_test', t.id, { result: v === '' ? null : v, status: v === '' ? 'requested' : 'reported', reported_at: v === '' ? null : db.now() }, c);
    }
    await refreshSummary(c, lab.id);
  });
  res.json({ success: 'Results saved.' });
}));
router.delete('/:id(\\d+)', can('lab_test_delete'), wrap(async (req, res) => {
  const lab = notFound(await db.find('lab', req.params.id));
  await db.tx(async (c) => { await db.q('DELETE FROM lab_test WHERE lab_id=$1', [lab.id], c); await db.remove('lab', lab.id, c); });
  res.json({ success: 'Lab request removed.' });
}));
module.exports = router;
