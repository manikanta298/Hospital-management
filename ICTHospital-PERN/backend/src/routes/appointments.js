const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, assertExists, int } = require('../lib/http');
const D = require('../lib/dates');
const branch = require('../support/branch');
const schedule = require('../support/doctorSchedule');
const telemedicine = require('../support/telemedicine');

const STATUSES = ['scheduled', 'arrived', 'in consultation', 'completed', 'cancelled', 'no show'];
const DEFAULT_MINUTES = 15;

async function assertNoClash(c, doctorId, start, end, ignoreId) {
  const clash = await db.one("SELECT * FROM appointment WHERE doctor=$1 AND status NOT IN ('cancelled','no show') AND ($2::int IS NULL OR id<>$2) AND s_time < $3 AND e_time > $4 LIMIT 1 FOR UPDATE", [doctorId, ignoreId, D.dateTimeStr(end), D.dateTimeStr(start)], c);
  if (!clash) return;
  const p = clash.patient ? await db.find('patient', clash.patient, c) : null;
  throw new ValidationError({ start: [`That doctor is already booked ${clash.time_slot} with ${p ? p.name : 'another patient'}.`] });
}
async function validated(req, c, ignoreId = null) {
  const b = req.body;
  const input = validate(b, { patient: 'required|integer', doctor: 'required|integer', date: 'required|date', start: 'required|date_format:H:i', minutes: 'nullable|integer|min:5|max:480', status: `required|in:${STATUSES.join(',')}`, remarks: 'nullable|max:500', b_p: 'nullable|max:100', pulse: 'nullable|max:100', temprature: 'nullable|max:100', weight: 'nullable|max:100' });
  await assertExists(input, { patient: 'patient', doctor: 'doctor' });
  const minutes = int(input.minutes) || DEFAULT_MINUTES;
  const start = D.parse(`${input.date} ${input.start}`); const end = D.addMinutes(start, minutes);
  await assertNoClash(c, input.doctor, start, end, ignoreId);
  if (!['cancelled', 'no show', 'completed'].includes(input.status)) await schedule.assertBookable(input.doctor, start, end, c);
  const existing = ignoreId ? await db.find('appointment', ignoreId, c) : null;
  const video = b.video === true || b.video === '1' || b.video === 1 || b.video === 'true' || b.video === 'on';
  return {
    mode: video ? 'video' : 'in_person', video_room: video ? (existing && existing.video_room) || telemedicine.newRoom() : null,
    patient: input.patient, doctor: input.doctor, date: D.dateStr(start), time_slot: `${D.hm(start)} - ${D.hm(end)}`,
    s_time: D.dateTimeStr(start), e_time: D.dateTimeStr(end), s_time_key: D.dateStr(start).replace(/-/g, '') + D.hm(start).replace(':', ''),
    status: input.status, remarks: input.remarks ?? '', b_p: input.b_p ?? null, pulse: input.pulse ?? null, temprature: input.temprature ?? null, weight: input.weight ?? null,
    add_date: db.today(), registration_time: db.now(), user: String(req.user.id), request: '',
  };
}
const doctors = () => db.q('SELECT id, name FROM doctor ORDER BY name');

router.get('/', can('appointment_view'), wrap(async (req, res) => {
  const date = String(req.query.date || db.today()); const doctorId = String(req.query.doctor || ''); const status = String(req.query.status || '');
  const where = []; const params = []; branch.scope(req, where, params);
  if (date) { params.push(date); where.push(`date = $${params.length}`); }
  if (doctorId) { params.push(doctorId); where.push(`doctor = $${params.length}`); }
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  const appointments = await db.q(`SELECT * FROM appointment ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s_time`, params);
  const ids = [...new Set(appointments.map((a) => a.patient).filter(Boolean))];
  const patients = ids.length ? Object.fromEntries((await db.q('SELECT id, name FROM patient WHERE id = ANY($1)', [ids])).map((p) => [p.id, p.name])) : {};
  res.json({ appointments, date, doctorId, status, doctors: await doctors(), patients, statuses: STATUSES });
}));
router.get('/form-data', can('appointment_add'), wrap(async (req, res) => res.json({ doctors: await doctors(), patientList: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), statuses: STATUSES })));
router.post('/', can('appointment_add'), wrap(async (req, res) => {
  const a = await db.tx(async (c) => db.insert('appointment', { ...(await validated(req, c)), branch_id: branch.current(req) }, c));
  res.status(201).json({ success: 'Appointment booked.', appointment: a });
}));
router.get('/:id(\\d+)', can('appointment_view'), wrap(async (req, res) => {
  const a = notFound(await db.find('appointment', req.params.id));
  res.json({ appointment: a, patient: a.patient ? await db.find('patient', a.patient) : null, doctor: a.doctor ? await db.find('doctor', a.doctor) : null, videoUrl: a.video_room ? telemedicine.url(a) : null });
}));
router.get('/:id(\\d+)/edit', can('appointment_update'), wrap(async (req, res) => {
  res.json({ appointment: notFound(await db.find('appointment', req.params.id)), doctors: await doctors(), patientList: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), statuses: STATUSES });
}));
router.put('/:id(\\d+)', can('appointment_update'), wrap(async (req, res) => {
  const a = notFound(await db.find('appointment', req.params.id));
  const updated = await db.tx(async (c) => db.update('appointment', a.id, await validated(req, c, a.id), c));
  res.json({ success: 'Appointment updated.', appointment: updated });
}));
router.delete('/:id(\\d+)', can('appointment_cancel'), wrap(async (req, res) => {
  const a = notFound(await db.find('appointment', req.params.id));
  await db.remove('appointment', a.id);
  res.json({ success: 'Appointment removed.', date: a.date });
}));
module.exports = router;
