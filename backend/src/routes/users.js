const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError } = require('../lib/http');
const hash = (p) => bcrypt.hashSync(p, 10);
const safe = ({ password, remember_token, ...u }) => u;
const R = { firstname: 'required', lastname: 'required', email: 'required|email', group: 'required', desc: 'required', login: 'required', password: 'required' };

router.use(auth);
router.get('/', wrap(async (req, res) => res.json({ users: (await db.q('SELECT * FROM users ORDER BY id')).map(safe) })));
router.get('/:id(\\d+)', wrap(async (req, res) => res.json({ user: safe(notFound(await db.find('users', req.params.id))), users: (await db.q('SELECT * FROM users ORDER BY id')).map(safe) })));
router.post('/', wrap(async (req, res) => {
  const d = validate(req.body, R);
  if (await db.one('SELECT 1 FROM users WHERE email=$1 AND login=$2', [d.email, d.login])) throw new ValidationError({ deplicate: ['User all ready exists with this email or login'] });
  const u = await db.insert('users', { firstname: d.firstname, lastname: d.lastname, login: d.login, desc: d.desc, email: d.email, group: d.group, password: hash(d.password) });
  res.status(201).json({ success: 'User Created Succesfully.', user: safe(u) });
}));
router.put('/:id(\\d+)', wrap(async (req, res) => {
  const user = notFound(await db.find('users', req.params.id)); const d = validate(req.body, R);
  const clash = await db.one('SELECT id FROM users WHERE email=$1 AND id<>$2', [d.email, user.id]);
  if (clash) throw new ValidationError({ deplicate: ['User all ready exists with this email'] });
  await db.update('users', user.id, { firstname: d.firstname, lastname: d.lastname, login: d.login, desc: d.desc, email: d.email, group: d.group, password: hash(d.password) });
  res.json({ success: 'User Updated Succesfully.' });
}));
router.delete('/:id(\\d+)', wrap(async (req, res) => { const u = notFound(await db.find('users', req.params.id)); await db.remove('users', u.id); res.json({ success: 'User Deleted Succesfully.' }); }));
module.exports = router;
