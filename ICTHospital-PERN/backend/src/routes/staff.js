const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, HttpError } = require('../lib/http');
const paginate = require('../lib/paginate');
const perms = require('../support/permissions');
const staffLogin = require('../support/staffLogin');
const staffTypes = require('../config/staff');
const upload = require('../lib/upload').make('staff', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 2);

const meta = (req) => { const m = staffTypes[req.params.type]; if (!m) throw new HttpError(404, `Unknown staff type: ${req.params.type}`); return m; };
// Permission is `<permission>_<action>`, e.g. nurse_view, staff_add.
const guard = (action) => async (req, res, next) => {
  try { const m = meta(req); const p = `${m.permission}_${action}`; if (await perms.allows(req, p)) return next(); next(new HttpError(403, 'You do not have permission to do that.', { permission: p })); } catch (e) { next(e); }
};
async function validated(req, m, ignoreId = null) {
  const d = validate(req.body, { name: 'required|max:100', email: 'nullable|email|max:100', phone: 'nullable|max:100', address: 'nullable|max:100' });
  if (d.email && (await db.one(`SELECT 1 FROM "${m.table}" WHERE email=$1 AND ($2::int IS NULL OR id<>$2)`, [d.email, ignoreId]))) throw new ValidationError({ email: ['Someone on this list already has that email address.'] });
  for (const k of ['email', 'phone', 'address']) d[k] = d[k] ?? '';
  d.ion_user_id = '';
  for (const col of ['x', 'y', 'z']) if (db.has(m.table, col)) d[col] = '';
  return d;
}
router.use(auth);
router.get('/:type', guard('view'), wrap(async (req, res) => {
  const m = meta(req); const term = String(req.query.q || '').trim(); const where = []; const params = [];
  if (term) { params.push(`%${term}%`); where.push('(name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)'); }
  res.json({ term, type: req.params.type, staffMeta: m, ...(await paginate(req, { from: `"${m.table}"`, where, params, order: 'name' })) });
}));
router.get('/:type/form-data', guard('add'), wrap(async (req, res) => res.json({ type: req.params.type, staffMeta: meta(req) })));
router.post('/:type', guard('add'), upload.single('photo'), wrap(async (req, res) => {
  const m = meta(req); const data = await validated(req, m); const login = await staffLogin.check(req.body, null);
  data.img_url = req.file ? `staff/${req.file.filename}` : '';
  const person = await db.insert(m.table, data); const note = await staffLogin.apply(person, m.table, m.group, login);
  res.status(201).json({ success: `${person.name} added. ${note || ''}`.trim(), person });
}));
router.get('/:type/:id(\\d+)/edit', guard('update'), wrap(async (req, res) => {
  const m = meta(req); const person = notFound(await db.find(m.table, req.params.id)); const user = await staffLogin.userFor(person);
  res.json({ person, type: req.params.type, staffMeta: m, login: user ? { username: user.login } : null });
}));
router.put('/:type/:id(\\d+)', guard('update'), upload.single('photo'), wrap(async (req, res) => {
  const m = meta(req); const person = notFound(await db.find(m.table, req.params.id));
  const data = await validated(req, m, person.id); const login = await staffLogin.check(req.body, person);
  delete data.ion_user_id; if (req.file) data.img_url = `staff/${req.file.filename}`;
  const u = await db.update(m.table, person.id, data); const note = await staffLogin.apply(u, m.table, m.group, login);
  res.json({ success: `${u.name} updated. ${note || ''}`.trim(), person: u });
}));
router.delete('/:type/:id(\\d+)', guard('delete'), wrap(async (req, res) => {
  const m = meta(req); const person = notFound(await db.find(m.table, req.params.id)); await db.remove(m.table, person.id);
  res.json({ success: `Removed ${person.name}.` });
}));
module.exports = router;
