// Returns 3 columns of 14 consecutive codes; the browser draws each CODE 128 barcode.
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { wrap, validate } = require('../lib/http');
router.post('/', auth, wrap(async (req, res) => {
  const d = validate(req.body, { code: ['required', 'min:10', 'max:10', (v) => (/^\d+$/.test(v) ? null : 'Please give valid number.')] });
  let code = BigInt(d.code); const cols = [];
  for (let c = 0; c < 3; c++) { const col = []; for (let i = 0; i < 14; i++) { col.push(String(code)); code += 1n; } cols.push(col); }
  res.json({ barcodesc1: cols[0], barcodesc2: cols[1], barcodesc3: cols[2] });
}));
module.exports = router;
