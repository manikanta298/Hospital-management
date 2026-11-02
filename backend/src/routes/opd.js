// OPD token queue, doctor slots / blocks and visit fees. Mounted at /api (paths are explicit).
const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, assertExists, ValidationError, int, num, bool } = require('../lib/http');
const D = require('../lib/dates');
const branch = require('../support/branch');
const billing = require('../support/billing');
const schedule = require('../support/doctorSchedule');

const TYPES = { first: 'First visit', follow_up: 'Follow-up', emergency: 'Emergency' };
const SHIFTS = { any: 'Any time', morning: 'Morning (before 2 pm)', evening: 'Evening (2 pm on)' };

const nextToken = async (c, doctorId, date) => {
  await db.q('SELECT id FROM appointment WHERE doctor=$1 AND date=$2 FOR UPDATE', [doctorId, date], c);
  return int(await db.val('SELECT COALESCE(MAX(token_no),0) FROM appointment WHERE doctor=$1 AND date=$2', [doctorId, date], c)) + 1;
};
async function resolveFee(doctorId, type, at, c) {
  const shift = at.getHours() < 14 ? 'morning' : 'evening';
  const rows = await db.q("SELECT * FROM visit_fee WHERE active=TRUE AND visit_type=$1 AND (doctor_id=$2 OR doctor_id IS NULL) AND shift IN ($3,'any')", [type, doctorId, shift], c);
  rows.sort((a, b) => ((b.doctor_id ? 2 : 0) + (b.shift !== 'any' ? 1 : 0)) - ((a.doctor_id ? 2 : 0) + (a.shift !== 'any' ? 1 : 0)));
  return rows[0] || null;
}
async function billFor(req, visit, c) {
  if (visit.payment_id) return `The visit fee is already billed on invoice #${visit.payment_id}.`;
  const type = visit.visit_type || 'first';
  const fee = await resolveFee(visit.doctor, type, D.parse(visit.s_time || db.now()), c);
  const service = fee ? await db.find('payment_category', fee.payment_category_id, c) : null;
  if (!fee || !service) return `No visit fee is set up for ${TYPES[type] || type} with this doctor. Set one under OPD, Visit fees.`;
  const patient = notFound(await db.find('patient', visit.patient, c));
  const invoice = await billing.raise(req, patient, visit.doctor, [{ service, price: fee.fee }], 'opd', `OPD visit, token ${visit.token_no}`, c);
  await db.update('appointment', visit.id, { payment_id: invoice.id }, c);
  return `Visit fee billed on invoice #${invoice.id} (${parseFloat(invoice.gross_total).toFixed(2)}).`;
}

router.get('/opd/queue', can('appointment_view'), wrap(async (req, res) => {
  const date = String(req.query.date || db.today());
  let doctorId = req.query.doctor !== undefined ? String(req.query.doctor) : String((await db.val('SELECT id FROM doctor WHERE ion_user_id=$1', [String(req.user.id)])) ?? '');
  const where = ['date=$1', "status<>'cancelled'"]; const params = [date]; branch.scope(req, where, params);
  if (doctorId) { params.push(doctorId); where.push(`doctor=$${params.length}`); }
  const visits = await db.q(`SELECT * FROM appointment WHERE ${where.join(' AND ')}`, params);
  visits.sort((a, b) => ((a.token_no === null ? 1 : 0) - (b.token_no === null ? 1 : 0)) || (int(a.token_no) - int(b.token_no)) || String(a.s_time).localeCompare(String(b.s_time)));
  const ids = [...new Set(visits.map((v) => v.patient).filter(Boolean))];
  res.json({
    visits, date, doctorId, doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), doctorNames: Object.fromEntries((await db.q('SELECT id, name FROM doctor')).map((d) => [d.id, d.name])),
    patients: ids.length ? Object.fromEntries((await db.q('SELECT * FROM patient WHERE id = ANY($1)', [ids])).map((p) => [p.id, p])) : {},
    patientList: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'),
    counts: { total: visits.length, waiting: visits.filter((v) => v.status === 'arrived').length, in: visits.filter((v) => v.status === 'in consultation').length, done: visits.filter((v) => v.status === 'completed').length },
    visitTypes: TYPES,
  });
}));
router.post('/opd/:id(\\d+)/check-in', can('appointment_update'), wrap(async (req, res) => {
  await db.tx(async (c) => {
    const a = notFound(await db.one('SELECT * FROM appointment WHERE id=$1 FOR UPDATE', [req.params.id], c)); const patch = {};
    if (a.token_no === null) patch.token_no = await nextToken(c, a.doctor, a.date);
    patch.checked_in_at = a.checked_in_at || db.now();
    if (['scheduled', 'no show'].includes(a.status)) patch.status = 'arrived';
    await db.update('appointment', a.id, patch, c);
  });
  res.json({ success: 'Checked in.' });
}));
router.post('/opd/:id(\\d+)/call-in', can('appointment_update'), wrap(async (req, res) => {
  const a = notFound(await db.find('appointment', req.params.id));
  await db.update('appointment', a.id, { status: 'in consultation', consult_started_at: db.now(), checked_in_at: a.checked_in_at || db.now() });
  res.json({ success: 'Called in.' });
}));
router.post('/opd/:id(\\d+)/done', can('appointment_update'), wrap(async (req, res) => {
  const a = notFound(await db.find('appointment', req.params.id));
  await db.update('appointment', a.id, { status: 'completed', checked_out_at: db.now(), consult_started_at: a.consult_started_at || db.now() });
  res.json({ success: 'Visit completed.' });
}));
router.post('/opd/walk-in', can('appointment_add'), wrap(async (req, res) => {
  const data = validate(req.body, { patient: 'required|integer', doctor: 'required|integer', visit_type: `required|in:${Object.keys(TYPES).join(',')}`, bill: 'nullable|boolean' });
  await assertExists(data, { patient: 'patient', doctor: 'doctor' });
  const out = await db.tx(async (c) => {
    const start = new Date(); start.setSeconds(0, 0); const end = D.addMinutes(start, 15);
    const visit = await db.insert('appointment', {
      patient: data.patient, doctor: data.doctor, date: D.dateStr(start), time_slot: `${D.hm(start)} - ${D.hm(end)}`, s_time: D.dateTimeStr(start), e_time: D.dateTimeStr(end),
      s_time_key: D.dateStr(start).replace(/-/g, '') + D.hm(start).replace(':', ''), status: 'arrived', remarks: 'Walk-in', add_date: db.today(), registration_time: db.now(), user: String(req.user.id),
      request: '', visit_type: data.visit_type, token_no: await nextToken(c, data.doctor, D.dateStr(start)), checked_in_at: db.now(), branch_id: branch.current(req),
    }, c);
    let msg = `Token ${visit.token_no} issued.`;
    if (bool(data.bill)) msg += ` ${await billFor(req, visit, c)}`;
    return { visit, msg };
  });
  res.status(201).json({ success: out.msg, visit: out.visit });
}));
router.post('/opd/:id(\\d+)/bill', can('payment_add'), wrap(async (req, res) => {
  let visit = notFound(await db.find('appointment', req.params.id));
  if (req.body.visit_type && TYPES[req.body.visit_type]) visit = await db.update('appointment', visit.id, { visit_type: req.body.visit_type });
  const msg = await db.tx((c) => billFor(req, visit, c));
  res.json({ success: msg });
}));
router.get('/opd/:id(\\d+)/token', can('appointment_view'), wrap(async (req, res) => {
  const visit = notFound(await db.find('appointment', req.params.id));
  const ahead = int(await db.val("SELECT COUNT(*) FROM appointment WHERE doctor=$1 AND date=$2 AND status='arrived' AND token_no < $3", [visit.doctor, visit.date, int(visit.token_no)]));
  res.json({ visit, patient: await db.find('patient', visit.patient), doctor: await db.find('doctor', visit.doctor), ahead, institute: await db.one('SELECT * FROM institute LIMIT 1') });
}));
router.get('/opd/history', can('appointment_view'), wrap(async (req, res) => {
  const from = String(req.query.from || db.today()); const to = String(req.query.to || from); const doctorId = String(req.query.doctor || ''); const status = String(req.query.status || '');
  const where = ['date >= $1', 'date <= $2']; const params = [from, to]; branch.scope(req, where, params);
  if (doctorId) { params.push(doctorId); where.push(`doctor=$${params.length}`); }
  if (status === 'active') where.push("status<>'cancelled'"); else if (status === 'cancelled') where.push("status='cancelled'");
  const visits = await db.q(`SELECT * FROM appointment WHERE ${where.join(' AND ')} ORDER BY date, token_no, s_time`, params);
  const pids = [...new Set(visits.map((v) => v.patient).filter(Boolean))]; const inv = [...new Set(visits.map((v) => v.payment_id).filter(Boolean))];
  const invoices = {};
  if (inv.length) for (const i of await db.q('SELECT * FROM payment WHERE id = ANY($1)', [inv])) { i.payments = await db.q('SELECT * FROM invoice_payment WHERE payment_id=$1', [i.id]); invoices[i.id] = i; }
  res.json({ visits, patients: pids.length ? Object.fromEntries((await db.q('SELECT * FROM patient WHERE id = ANY($1)', [pids])).map((p) => [p.id, p])) : {}, doctorNames: Object.fromEntries((await db.q('SELECT id, name FROM doctor')).map((d) => [d.id, d.name])), doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), invoices, filters: { from, to, doctorId, status } });
}));

// ---- visit fees
router.get('/opd/visit-fees', can('service_view'), wrap(async (req, res) => {
  res.json({
    fees: await db.q('SELECT * FROM visit_fee ORDER BY doctor_id, visit_type'), doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), doctorNames: Object.fromEntries((await db.q('SELECT id, name FROM doctor')).map((d) => [d.id, d.name])),
    services: await db.q('SELECT id, category, c_price FROM payment_category ORDER BY category'), serviceNames: Object.fromEntries((await db.q('SELECT id, category FROM payment_category')).map((s) => [s.id, s.category])), types: TYPES, shifts: SHIFTS,
  });
}));
router.post('/opd/visit-fees', can('service_update'), wrap(async (req, res) => {
  const data = validate(req.body, { doctor_id: 'nullable|integer', visit_type: `required|in:${Object.keys(TYPES).join(',')}`, shift: `required|in:${Object.keys(SHIFTS).join(',')}`, payment_category_id: 'required|integer', fee: 'nullable|numeric|min:0' });
  await assertExists(data, { doctor_id: 'doctor', payment_category_id: 'payment_category' });
  data.doctor_id = data.doctor_id ?? null; data.fee = data.fee !== null && data.fee !== undefined && data.fee !== '' ? data.fee : null;
  res.status(201).json({ success: 'Visit fee added.', fee: await db.insert('visit_fee', { ...data, active: true }) });
}));
router.delete('/opd/visit-fees/:id(\\d+)', can('service_update'), wrap(async (req, res) => { notFound(await db.find('visit_fee', req.params.id)); await db.remove('visit_fee', req.params.id); res.json({ success: 'Visit fee removed.' }); }));
router.get('/opd/free-slots', can('appointment_add'), wrap(async (req, res) => {
  const d = validate(req.query, { doctor: 'required|integer', date: 'required|date' });
  res.json(await schedule.freeSlots(int(d.doctor), d.date));
}));

// ---- doctor slots and blocks
router.get('/doctors/:id(\\d+)/slots', can('doctor_schedule'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  res.json({ doctor, doctors: await db.q('SELECT id, name FROM doctor ORDER BY name'), slots: await db.q('SELECT * FROM doctor_slot WHERE doctor_id=$1 ORDER BY weekday, start_time', [doctor.id]), blocks: await db.q('SELECT * FROM slot_block WHERE doctor_id=$1 AND date >= $2 ORDER BY date', [doctor.id, db.today()]), preview: await schedule.freeSlots(doctor.id, db.today()) });
}));
router.post('/doctors/:id(\\d+)/slots', can('doctor_schedule'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  const data = validate(req.body, { start_time: 'required|date_format:H:i', end_time: ['required', 'date_format:H:i', (v, b) => (b.start_time && v <= b.start_time ? 'The end time must be a time after start time.' : null)], slot_minutes: 'required|integer|min:5|max:240' });
  const days = [...new Set([].concat(req.body.weekdays ?? []).map((x) => int(x, -1)))].filter((x) => x >= 0 && x <= 6);
  if (!days.length) throw new ValidationError({ weekdays: ['The weekdays field is required.'] });
  for (const day of days) await db.insert('doctor_slot', { doctor_id: doctor.id, weekday: day, start_time: data.start_time, end_time: data.end_time, slot_minutes: data.slot_minutes, active: true });
  res.status(201).json({ success: 'Slots created.' });
}));
router.post('/slots/:id(\\d+)/toggle', can('doctor_schedule'), wrap(async (req, res) => {
  const s = notFound(await db.find('doctor_slot', req.params.id)); const u = await db.update('doctor_slot', s.id, { active: !s.active });
  res.json({ success: u.active ? 'Slots enabled.' : 'Slots disabled.' });
}));
router.delete('/slots/:id(\\d+)', can('doctor_schedule'), wrap(async (req, res) => { notFound(await db.find('doctor_slot', req.params.id)); await db.remove('doctor_slot', req.params.id); res.json({ success: 'Slots deleted.' }); }));
router.post('/doctors/:id(\\d+)/blocks', can('doctor_schedule'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  const data = validate(req.body, {
    date: ['required', 'date', (v) => (v < db.today() ? 'The date must be a date after or equal to today.' : null)], start_time: 'nullable|date_format:H:i',
    end_time: ['nullable', 'required_with:start_time', 'date_format:H:i', (v, b) => (b.start_time && v <= b.start_time ? 'The end time must be a time after start time.' : null)], reason: 'nullable|max:120',
  });
  res.status(201).json({ success: 'Time blocked.', block: await db.insert('slot_block', { doctor_id: doctor.id, date: data.date, start_time: data.start_time ?? null, end_time: data.end_time ?? null, reason: data.reason ?? null }) });
}));
router.delete('/blocks/:id(\\d+)', can('doctor_schedule'), wrap(async (req, res) => { notFound(await db.find('slot_block', req.params.id)); await db.remove('slot_block', req.params.id); res.json({ success: 'Block removed.' }); }));
module.exports = router;
