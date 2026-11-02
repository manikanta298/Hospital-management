const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, bool } = require('../lib/http');
const billing = require('../support/billing');
const rad = require('../support/radiologyOrder');
const D = require('../lib/dates');

const MODALITIES = { xray: 'X-ray', ultrasound: 'Ultrasound', ct: 'CT', mri: 'MRI', mammography: 'Mammography', fluoroscopy: 'Fluoroscopy', other: 'Other' };

async function billOrders(req, patient, orders, c) {
  const exams = Object.fromEntries((await db.q('SELECT * FROM radiology_exam WHERE id = ANY($1)', [orders.map((o) => o.radiology_exam_id)], c)).map((e) => [e.id, e]));
  const lines = []; const billed = [];
  for (const o of orders) {
    const exam = exams[o.radiology_exam_id]; const service = exam && exam.payment_category_id ? await db.find('payment_category', exam.payment_category_id, c) : null;
    if (service && !o.payment_id) { lines.push({ service, name: o.name }); billed.push(o); }
  }
  if (!lines.length) return null;
  const invoice = await billing.raise(req, patient, orders[0].doctor_id, lines, 'opd', 'Radiology', c);
  for (const o of billed) await db.update('radiology_order', o.id, { payment_id: invoice.id }, c);
  return invoice;
}
const examValid = (req) => {
  const d = validate(req.body, { name: 'required|max:120', modality: `required|in:${Object.keys(MODALITIES).join(',')}`, payment_category_id: 'nullable|integer', report_template: 'nullable|max:10000' });
  return d;
};

router.get('/', can('diagnostic_report_view'), wrap(async (req, res) => {
  const status = String(req.query.status ?? 'open'); const modality = String(req.query.modality || ''); const from = String(req.query.from || ''); const to = String(req.query.to || '');
  const where = []; const params = [];
  if (status === 'open') where.push("status IN ('ordered','scheduled','done')"); else if (status) { params.push(status); where.push(`status=$${params.length}`); }
  if (modality) { params.push(modality); where.push(`modality=$${params.length}`); }
  if (from) { params.push(from); where.push(`created_at::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`created_at::date <= $${params.length}`); }
  const orders = await db.q(`SELECT * FROM radiology_order ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY urgent DESC, created_at LIMIT 300`, params);
  const ids = [...new Set(orders.map((o) => o.patient_id))];
  res.json({ orders, patients: ids.length ? Object.fromEntries((await db.q('SELECT * FROM patient WHERE id = ANY($1)', [ids])).map((p) => [p.id, p])) : {}, doctorNames: Object.fromEntries((await db.q('SELECT id, name FROM doctor')).map((d) => [d.id, d.name])), filters: { status, modality, from, to }, modalities: MODALITIES, statuses: rad.STATUSES });
}));
router.get('/form-data', can('diagnostic_report_add'), wrap(async (req, res) => res.json({ patientId: req.query.patient || null, patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), exams: await db.q('SELECT * FROM radiology_exam WHERE active=TRUE ORDER BY modality, name'), modalities: MODALITIES })));
router.post('/', can('diagnostic_report_add'), wrap(async (req, res) => {
  const data = validate(req.body, { patient: 'required|integer', doctor: 'nullable|integer', urgent: 'nullable|boolean', clinical_notes: 'nullable|max:1000', bill: 'nullable|boolean' });
  await assertExists(data, { patient: 'patient', doctor: 'doctor' });
  const exams = [...new Set([].concat(req.body.exams || []).map(Number).filter(Boolean))];
  if (!exams.length) throw new ValidationError({ exams: ['Choose at least one exam.'] });
  for (const e of exams) await assertExists({ exams: e }, { exams: 'radiology_exam' });
  const patient = notFound(await db.find('patient', data.patient));
  const orders = await db.tx(async (c) => {
    const orders = await rad.place(req, patient, data.doctor ?? null, exams, bool(data.urgent), data.clinical_notes ?? null, null, c);
    if (bool(data.bill)) await billOrders(req, patient, orders, c);
    return orders;
  });
  res.status(201).json({ success: `${orders.length} exam(s) ordered for ${patient.name}.` });
}));
router.get('/catalogue', can('diagnostic_report_view'), wrap(async (req, res) => res.json({ exams: await db.q('SELECT * FROM radiology_exam ORDER BY modality, name'), services: await db.q('SELECT id, category, c_price FROM payment_category ORDER BY category'), modalities: MODALITIES })));
router.post('/catalogue', can('diagnostic_report_add'), wrap(async (req, res) => {
  const d = examValid(req); await assertExists(d, { payment_category_id: 'payment_category' });
  res.status(201).json({ success: 'Exam added.', exam: await db.insert('radiology_exam', { name: d.name, modality: d.modality, payment_category_id: d.payment_category_id ?? null, report_template: d.report_template ?? null, active: true }) });
}));
router.put('/catalogue/:id(\\d+)', can('diagnostic_report_add'), wrap(async (req, res) => {
  const exam = notFound(await db.find('radiology_exam', req.params.id)); const d = examValid(req); await assertExists(d, { payment_category_id: 'payment_category' });
  await db.update('radiology_exam', exam.id, { name: d.name, modality: d.modality, payment_category_id: d.payment_category_id ?? null, report_template: d.report_template ?? null, active: bool(req.body.active) });
  res.json({ success: `Saved ${d.name}.` });
}));
const detail = async (id) => {
  const order = notFound(await db.find('radiology_order', id));
  return { order, patient: await db.find('patient', order.patient_id), doctor: order.doctor_id ? await db.find('doctor', order.doctor_id) : null, reporter: order.reported_by ? await db.one('SELECT id, firstname, lastname FROM users WHERE id=$1', [order.reported_by]) : null };
};
router.get('/:id(\\d+)', can('diagnostic_report_view'), wrap(async (req, res) => {
  const d = await detail(req.params.id);
  res.json({ ...d, history: await db.q('SELECT * FROM radiology_order WHERE patient_id=$1 AND id<>$2 ORDER BY created_at DESC LIMIT 10', [d.order.patient_id, d.order.id]), statuses: rad.STATUSES });
}));
router.put('/:id(\\d+)', can('diagnostic_report_add'), wrap(async (req, res) => {
  const order = notFound(await db.find('radiology_order', req.params.id));
  const d = validate(req.body, { action: 'required|in:schedule,done,report,cancel', scheduled_at: 'nullable|date', findings: 'nullable|max:20000', impression: 'nullable|max:5000' });
  if (order.status === 'cancelled') throw new ValidationError({ action: ['This order was cancelled.'] });
  const now = db.now();
  switch (d.action) {
    case 'schedule': await db.update('radiology_order', order.id, { status: 'scheduled', scheduled_at: d.scheduled_at || now }); break;
    case 'done': await db.update('radiology_order', order.id, { status: order.status === 'reported' ? 'reported' : 'done', performed_at: order.performed_at || now }); break;
    case 'report':
      if (!String(d.impression ?? '').trim()) throw new ValidationError({ impression: ['A report needs an impression.'] });
      await db.update('radiology_order', order.id, { status: 'reported', findings: d.findings ?? null, impression: d.impression, performed_at: order.performed_at || now, reported_by: req.user.id, reported_at: now }); break;
    case 'cancel':
      if (order.status === 'reported') throw new ValidationError({ action: ['A reported exam cannot be cancelled.'] });
      await db.update('radiology_order', order.id, { status: 'cancelled' }); break;
    default: break;
  }
  res.json({ success: 'Saved.' });
}));
router.post('/:id(\\d+)/bill', can('payment_add'), wrap(async (req, res) => {
  const order = notFound(await db.find('radiology_order', req.params.id));
  if (order.payment_id) return res.status(409).json({ error: `Already billed on invoice #${order.payment_id}.` });
  const invoice = await db.tx(async (c) => billOrders(req, notFound(await db.find('patient', order.patient_id, c)), [order], c));
  if (!invoice) return res.status(409).json({ error: 'This exam has no service on the price list. Link one under Radiology, Exam catalogue.' });
  res.json({ success: `Billed on invoice #${invoice.id}.` });
}));
router.get('/:id(\\d+)/print', can('diagnostic_report_view'), wrap(async (req, res) => res.json({ ...(await detail(req.params.id)), institute: await db.one('SELECT * FROM institute LIMIT 1') })));
module.exports = router;
