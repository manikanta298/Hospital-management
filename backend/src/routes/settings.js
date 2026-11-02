// "My settings" (change own name/password) and the notification cron schedule.
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { wrap, validate, ValidationError } = require('../lib/http');
router.use(auth);
router.get('/', wrap(async (req, res) => { const { password, remember_token, ...set } = req.user; res.json({ set }); }));
router.post('/', wrap(async (req, res) => {
  const d = validate(req.body, { firstname: 'required', lastname: 'required', login: 'required', desc: 'required', cpassword: 'required', npassword: 'required', cnpassword: 'required' });
  if (d.npassword !== d.cnpassword) throw new ValidationError({ notmatch: ['New Password and confirm password did not match!'] });
  await db.update('users', req.user.id, { firstname: d.firstname, lastname: d.lastname, password: bcrypt.hashSync(d.npassword, 10) });
  res.json({ success: 'Settings is changed please relogin the site.' });
}));
router.get('/schedule', wrap(async (req, res) => res.json({ schedule: (await db.one('SELECT date, time FROM cronschedule LIMIT 1')) || { date: '', time: '' }, month: new Date().toLocaleString('en', { month: 'long' }), year: new Date().getFullYear() })));
router.post('/schedule', wrap(async (req, res) => {
  const d = validate(req.body, { time: 'required', date: 'required' });
  const t = new Date(`1970-01-01 ${d.time}`); const time = isNaN(t) ? d.time : `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  await db.tx(async (c) => { await db.q('DELETE FROM cronschedule', [], c); await db.insert('cronschedule', { date: d.date, time }, c); });
  res.json({ success: 'Schedule Created Succesfully.' });
}));
module.exports = router;
