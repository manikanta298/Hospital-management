const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError } = require('../lib/http');
const paginate = require('../lib/paginate');
const upload = require('../lib/upload').make('doctors', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 2);
const staffLogin = require('../support/staffLogin');

async function validated(req, ignoreId = null) {
  const data = validate(req.body, { name: 'required|max:100', email: 'nullable|email|max:100', phone: 'nullable|max:100', address: 'nullable|max:100', department: 'nullable|max:100', profile: 'nullable|max:100', procedure_id: 'nullable|max:100' });
  if (data.email) {
    const clash = await db.one('SELECT 1 FROM doctor WHERE email=$1 AND ($2::int IS NULL OR id<>$2)', [data.email, ignoreId]);
    if (clash) throw new ValidationError({ email: ['Another doctor is already on file with that email address.'] });
  }
  for (const k of ['email', 'phone', 'address', 'department', 'profile']) data[k] = data[k] ?? '';
  data.procedure_id = data.procedure_id ?? null; data.x = ''; data.y = '';
  return data;
}
const departments = async () => {
  const names = [...(await db.q('SELECT name FROM department ORDER BY name')).map((r) => r.name), ...(await db.q("SELECT DISTINCT department AS name FROM doctor WHERE department IS NOT NULL AND department<>''")).map((r) => r.name)];
  return [...new Set(names)].sort();
};

router.get('/', can('doctor_view'), wrap(async (req, res) => {
  const term = String(req.query.q || '').trim(); const where = []; const params = [];
  if (term) { params.push(`%${term}%`); where.push('(name ILIKE $1 OR department ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)'); }
  const out = await paginate(req, { from: 'doctor', where, params, order: 'name' });
  const upcoming = Object.fromEntries((await db.q("SELECT doctor, COUNT(*)::int n FROM appointment WHERE date >= $1 AND status NOT IN ('cancelled','no show') GROUP BY doctor", [db.today()])).map((r) => [r.doctor, r.n]));
  res.json({ term, upcoming, ...out });
}));
router.get('/form-data', can('doctor_add'), wrap(async (req, res) => res.json({ departments: await departments() })));
router.post('/', can('doctor_add'), upload.single('photo'), wrap(async (req, res) => {
  const data = await validated(req); const login = await staffLogin.check(req.body, null);
  data.ion_user_id = ''; data.img_url = req.file ? `doctors/${req.file.filename}` : '';
  const doctor = await db.insert('doctor', data);
  const note = await staffLogin.apply(doctor, 'doctor', 'Doctor', login);
  res.status(201).json({ success: `${doctor.name} added to the register. ${note || ''}`.trim(), doctor });
}));
router.get('/:id(\\d+)', can('doctor_view'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  const appointments = await db.q('SELECT * FROM appointment WHERE doctor=$1 ORDER BY date DESC, s_time DESC LIMIT 20', [doctor.id]);
  const ids = [...new Set(appointments.map((a) => a.patient).filter(Boolean))];
  const patients = ids.length ? Object.fromEntries((await db.q('SELECT id, name, patient_id FROM patient WHERE id = ANY($1)', [ids])).map((p) => [p.id, p])) : {};
  res.json({ doctor, appointments, patients });
}));
router.get('/:id(\\d+)/edit', can('doctor_update'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  const user = await staffLogin.userFor(doctor);
  res.json({ doctor, departments: await departments(), login: user ? { username: user.login } : null });
}));
router.put('/:id(\\d+)', can('doctor_update'), upload.single('photo'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  const data = await validated(req, doctor.id); const login = await staffLogin.check(req.body, doctor);
  if (req.file) data.img_url = `doctors/${req.file.filename}`;
  const updated = await db.update('doctor', doctor.id, data);
  const note = await staffLogin.apply(updated, 'doctor', 'Doctor', login);
  res.json({ success: `Doctor record updated. ${note || ''}`.trim(), doctor: updated });
}));
router.delete('/:id(\\d+)', can('doctor_delete'), wrap(async (req, res) => {
  const doctor = notFound(await db.find('doctor', req.params.id));
  if (await db.one('SELECT 1 FROM appointment WHERE doctor=$1 LIMIT 1', [doctor.id])) return res.status(409).json({ error: `${doctor.name} has appointments on file, so the record stays.` });
  await db.remove('doctor', doctor.id);
  res.json({ success: `Removed ${doctor.name}.` });
}));
module.exports = router;
