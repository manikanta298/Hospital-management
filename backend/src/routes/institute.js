const router = require('express').Router();
const fs = require('fs'); const path = require('path');
const db = require('../db');
const { can, auth } = require('../middleware/auth');
const { wrap, validate } = require('../lib/http');
const { root } = require('../lib/upload');
const upload = require('../lib/upload').make('branding', ['png'], 2);
const flagFile = (n) => path.join(root, `${n}.txt`);
const flag = (n, d = '') => { try { return fs.readFileSync(flagFile(n), 'utf8').split('<br>')[0]; } catch { return d; } };

router.get('/', auth, wrap(async (req, res) => res.json({ institute: (await db.one('SELECT * FROM institute LIMIT 1')) || { name: '', establish: '', web: '', email: '', phoneNo: '', address: '' }, gradsystem: flag('grad_system'), family: flag('family'), accounting: flag('accounting') })));
router.post('/', can('hospital_information_add'), upload.single('logo'), wrap(async (req, res) => {
  const d = validate(req.body, { name: 'required', establish: 'required', web: 'required', email: 'required', phoneNo: 'required', address: 'required' });
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(flagFile('grad_system'), req.body.grade_system ? 'auto' : 'manual'); fs.writeFileSync(flagFile('family'), req.body.family ? 'on' : 'off'); fs.writeFileSync(flagFile('accounting'), req.body.accounting ? 'no' : 'yes');
  await db.tx(async (c) => { await db.q('DELETE FROM institute', [], c); await db.insert('institute', d, c); });
  if (req.file) fs.renameSync(req.file.path, path.join(root, 'branding', 'logo.png'));
  res.json({ success: 'Institute  Information saved.' });
}));
module.exports = router;
