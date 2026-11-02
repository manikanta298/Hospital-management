const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');
const { wrap, validate, abort, HttpError, ValidationError } = require('../lib/http');
const perms = require('../support/permissions');
const branch = require('../support/branch');
const sms = require('../support/sms');

const check = (plain, hash) => bcrypt.compareSync(plain, String(hash || '').replace(/^\$2y\$/, '$2a$')); // Laravel writes $2y$
const hash = (plain) => bcrypt.hashSync(plain, 10);
const fullName = (u) => `${u.firstname} ${u.lastname}`;
const institute = () => db.one('SELECT * FROM institute LIMIT 1');
const regenerate = (req) => new Promise((ok, no) => req.session.regenerate((e) => (e ? no(e) : ok())));
const save = (req) => new Promise((ok, no) => req.session.save((e) => (e ? no(e) : ok())));

async function signIn(req, user) {
  await regenerate(req);
  req.session.userId = user.id; req.session.name = fullName(user); req.session.userRole = user.group;
  const inst = await institute(); req.session.inName = inst ? inst.name : 'IctVission';
  await save(req);
  return inst;
}
const landing = (user, inst) => (!inst ? (user.group === 'Admin' ? { redirect: '/institute', error: 'Please provide institute information!' } : { error: 'Institute Information not setup yet!Please contact administrator.', logout: true }) : { redirect: '/dashboard', success: 'You are now logged in.' });

// Public: the login page needs the hospital name.
router.get('/public', wrap(async (req, res) => { const i = await institute(); res.json({ institute: { name: i ? i.name : 'ictvission' }, otp: process.env.OTP === 'Yes' }); }));

router.post('/login', wrap(async (req, res) => {
  const d = validate(req.body, { login: 'required', password: 'required' });
  const user = await db.one('SELECT * FROM users WHERE login=$1', [d.login]);
  if (!user || !check(d.password, user.password)) return res.status(401).json({ error: 'Your username/password combination was incorrect' });
  if (process.env.OTP === 'Yes') {
    const known = await db.one('SELECT * FROM verification_codes WHERE user_id=$1 AND ip_address=$2', [user.id, req.ip]);
    if (!known) {
      const row = await db.insert('verification_codes', { user_id: user.id, status: 1, ip_address: req.ip, code: String(10000 + Math.floor(Math.random() * 90000)) });
      await sms.bizSms({ numbers: sms.localToIntl(user.phone), message: `Your verification code is ${row.code}` });
      return res.json({ verify: true, id: row.id });
    }
  }
  const inst = await signIn(req, user); const next = landing(user, inst);
  if (next.logout) { await regenerate(req); return res.status(403).json({ error: next.error }); }
  res.json({ success: next.success || null, redirect: next.redirect, error: next.error || null });
}));
router.post('/verify-code', wrap(async (req, res) => {
  const row = await db.find('verification_codes', req.body.id);
  if (!row || String(row.code) !== String(req.body.code)) return res.status(401).json({ error: 'Your code was incorrect' });
  const age = (Date.now() - new Date(String(row.created_at).replace(' ', 'T')).getTime()) / 60000;
  if (age > 15) return res.status(401).json({ error: 'That code has expired.' });
  const user = await db.find('users', row.user_id); if (!user) abort(404);
  const inst = await signIn(req, user); res.json({ redirect: landing(user, inst).redirect || '/dashboard' });
}));
router.post('/logout', wrap(async (req, res) => {
  if (req.session.isAdmin && req.session.adminID) { // leaving an impersonated account returns to the admin
    const adm = await db.find('users', req.session.adminID);
    if (adm) { req.session.userId = adm.id; req.session.name = fullName(adm); req.session.userRole = adm.group; delete req.session.isAdmin; delete req.session.adminID; await save(req); return res.json({ redirect: '/dashboard' }); }
  }
  await new Promise((ok) => req.session.destroy(ok)); res.clearCookie('connect.sid'); res.json({ redirect: '/', message: 'Your are now logged out!' });
}));
router.post('/impersonate/:id(\\d+)', auth, admin, wrap(async (req, res) => {
  const user = await db.find('users', req.params.id); if (!user) abort(404);
  const adminId = req.user.id; req.session.isAdmin = 1; req.session.adminID = adminId; req.session.userId = user.id; req.session.name = fullName(user); req.session.userRole = user.group; await save(req);
  res.json({ redirect: '/dashboard' });
}));

// Everything the shell needs: who am I, what may I do, which branch.
router.get('/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const { password, remember_token, ...user } = req.user;
  const g = await perms.grants(req);
  const branches = branch.canSwitch(req) ? await db.q('SELECT id, name FROM hospital_branch WHERE active=TRUE ORDER BY name') : [];
  res.json({ user, name: req.session.name, role: req.user.group, inName: req.session.inName, permissions: Object.keys(g), impersonating: !!req.session.isAdmin, isSuperAdmin: req.user.group === 'Admin' && req.user.login === 'ictkashif', branch: { current: branch.current(req), name: await branch.name(branch.current(req)), canSwitch: branch.canSwitch(req), list: branches } });
}));
module.exports = router;
module.exports.hash = hash; module.exports.check = check;
