const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { wrap } = require('../lib/http');
async function lookup(table, searchable, term, select) {
  const cols = searchable.filter((c) => db.has(table, c)); if (!cols.length) return [];
  const sel = select.filter((c) => db.has(table, c)).map((c) => `"${c}"`).join(', ');
  return db.q(`SELECT ${sel} FROM "${table}" WHERE ${cols.map((c) => `"${c}" ILIKE $1`).join(' OR ')} LIMIT 25`, [`%${term}%`]);
}
router.get('/', auth, wrap(async (req, res) => {
  const term = String(req.query.search || '').trim();
  if ([...term].length < 2) return res.json({ term, patients: [], doctors: [], message: 'Enter at least two characters.' });
  const patients = await lookup('patient', ['name', 'patient_id', 'phone', 'email', 'address', 'bloodgroup'], term, ['id', 'name', 'patient_id', 'phone', 'sex', 'age', 'bloodgroup']);
  const doctors = await lookup('doctor', ['name', 'phone', 'email', 'department', 'specialist'], term, ['id', 'name', 'phone', 'email']);
  res.json({ term, patients, doctors, count: patients.length + doctors.length });
}));
module.exports = router;
