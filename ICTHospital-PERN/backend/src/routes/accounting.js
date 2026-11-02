// Accounting: external settings, sectors, income, expense, reports. Mounted at /api/accounting.
const router = require('express').Router();
const db = require('../db');
const { auth, can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, round2, num } = require('../lib/http');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthNo = (m) => { const i = MONTHS.indexOf(String(m).trim().toLowerCase()); if (i >= 0) return i + 1; const n = parseInt(m, 10); return n >= 1 && n <= 12 ? n : null; };
// The app's date inputs are dd/mm/yyyy; ISO dates pass through unchanged.
const parseAppDate = (s) => { const p = String(s).split('/'); return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : String(s); };
const appDate = (s) => { const p = String(s).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(s); };
router.use(auth);

router.get('/', wrap(async (req, res) => res.json({ accounting: (await db.one('SELECT * FROM accounting_settings LIMIT 1')) || { company_id: '', api_link: '', username: '', password: '' } })));
router.post('/', wrap(async (req, res) => {
  const d = validate(req.body, { company_id: 'required', api_link: 'required', username: 'required', password: 'required' });
  await db.tx(async (c) => { await db.q('DELETE FROM accounting_settings', [], c); await db.insert('accounting_settings', d, c); });
  res.json({ success: 'Accounting Setting Saved successfully.' });
}));

// ---- sectors
router.get('/sectors', wrap(async (req, res) => res.json({ sectors: await db.q('SELECT * FROM accounting_sector ORDER BY id') })));
router.post('/sectors', wrap(async (req, res) => { const d = validate(req.body, { name: 'required', type: 'required' }); res.status(201).json({ success: 'Accounting Sector Created successfully.', sector: await db.insert('accounting_sector', d) }); }));
router.put('/sectors/:id(\\d+)', wrap(async (req, res) => { const s = notFound(await db.find('accounting_sector', req.params.id)); await db.update('accounting_sector', s.id, validate(req.body, { name: 'required', type: 'required' })); res.json({ success: 'Accounting Sector Updated successfully.' }); }));
router.delete('/sectors/:id(\\d+)', can('accounting'), wrap(async (req, res) => { const s = notFound(await db.find('accounting_sector', req.params.id)); await db.remove('accounting_sector', s.id); res.json({ success: 'Accounting Sector Deleted successfully.' }); }));

// ---- income / expense share one implementation
function entries(kind, label, plural) {
  const base = kind.toLowerCase();
  router.get(`/${base}-sectors`, wrap(async (req, res) => res.json({ sectors: await db.q('SELECT id, name FROM accounting_sector WHERE type=$1 ORDER BY id', [kind]) })));
  // body: { entries: [{ name, amount, date, description }] } - rows with no amount or date are skipped
  router.post(`/${base}`, wrap(async (req, res) => {
    const rows = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!rows.length) throw new ValidationError({ name: ['The name field is required.'] });
    let counter = 0;
    await db.tx(async (c) => {
      for (const r of rows) {
        if (r.amount === undefined || r.amount === '' || r.date === undefined || r.date === '') continue;
        if (isNaN(Number(r.amount))) throw new ValidationError({ Invalid: ['Amount must be a number.'] });
        await db.insert('accounting', { name: r.name, type: kind, amount: r.amount, description: r.description || '', date: parseAppDate(r.date) }, c); counter++;
      }
    });
    res.status(201).json({ success: `${counter}${counter === 1 ? ` ${label} entry` : ` ${plural} entries`} saved.`, saved: counter });
  }));
  router.get(`/${base}-list`, wrap(async (req, res) => {
    const year = String(req.query.year || ''); const mn = String(req.query.month || ''); let list = [];
    if (mn && year) { const m = monthNo(mn); if (m) list = await db.q('SELECT * FROM accounting WHERE type=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3 ORDER BY date, id', [kind, year, m]); }
    res.json({ entries: list, year, month: mn });
  }));
  router.get(`/${base}/:id(\\d+)`, wrap(async (req, res) => res.json({ entry: notFound(await db.one('SELECT * FROM accounting WHERE id=$1 AND type=$2', [req.params.id, kind])) })));
  router.put(`/${base}/:id(\\d+)`, wrap(async (req, res) => {
    const e = notFound(await db.one('SELECT * FROM accounting WHERE id=$1 AND type=$2', [req.params.id, kind])); const d = validate(req.body, { name: 'required', amount: 'required|numeric', date: 'required' });
    await db.update('accounting', e.id, { amount: d.amount, description: req.body.description || '', date: parseAppDate(d.date) }); res.json({ success: `${kind === 'Income' ? 'Income' : 'Expence'} Updated successfully.` });
  }));
  router.delete(`/${base}/:id(\\d+)`, can('accounting'), wrap(async (req, res) => { const e = notFound(await db.one('SELECT * FROM accounting WHERE id=$1 AND type=$2', [req.params.id, kind])); await db.remove('accounting', e.id); res.json({ success: `${kind === 'Income' ? 'Income' : 'Expence'} Deleted successfully.` }); }));
}
entries('Income', 'income', 'income'); entries('Expence', 'expense', 'expense');

// Patient payments in a period, split into ordinary invoices and deposit-type invoices.
async function paymentTotals(from, to, deposits) {
  const cond = deposits ? "COALESCE(deposit_type,'') <> ''" : "COALESCE(deposit_type,'') = ''";
  const r = await db.one(`SELECT COALESCE(SUM(${db.numSql('gross_total')}),0) AS "payTotal", COALESCE(SUM(${db.numSql('amount_received')}),0) AS "paiTotal" FROM payment WHERE date >= $1 AND date <= $2 AND ${cond}`, [from, to]);
  const payTotal = num(r.payTotal), paiTotal = num(r.paiTotal); return { payTotal, paiTotal, dueamount: round2(payTotal - paiTotal) };
}
const sumType = async (type, from, to) => num(await db.val('SELECT COALESCE(SUM(amount),0) FROM accounting WHERE type=$1 AND date >= $2 AND date <= $3', [type, from, to]));
router.get('/report/:rtype/:fdate/:tdate', can('view_payment_reports'), wrap(async (req, res) => {
  const { rtype, fdate, tdate } = req.params; if (!['Income', 'Expence'].includes(rtype)) throw new ValidationError({ rtype: ['Invalid report type.'] });
  const datas = await db.q('SELECT name, amount, date, description FROM accounting WHERE type=$1 AND date >= $2 AND date <= $3 ORDER BY date, id', [rtype, fdate, tdate]);
  if (!datas.length) return res.status(404).json({ error: 'Data Not Found!' });
  res.json({ datas, formdata: [appDate(fdate), appDate(tdate), rtype], total: await sumType(rtype, fdate, tdate), institute: await db.one('SELECT * FROM institute LIMIT 1'), tutionfees: rtype === 'Income' ? await paymentTotals(fdate, tdate, false) : null, otherfees: rtype === 'Income' ? await paymentTotals(fdate, tdate, true) : null, rtype });
}));
router.get('/report-summary/:fdate/:tdate', can('view_payment_reports'), wrap(async (req, res) => {
  const { fdate, tdate } = req.params;
  const incomes = await db.q("SELECT name, amount, description, date FROM accounting WHERE type='Income' AND date >= $1 AND date <= $2 ORDER BY date, id", [fdate, tdate]);
  const expences = await db.q("SELECT name, amount, description, date FROM accounting WHERE type='Expence' AND date >= $1 AND date <= $2 ORDER BY date, id", [fdate, tdate]);
  const intotal = await sumType('Income', fdate, tdate); const extotal = await sumType('Expence', fdate, tdate); const tutionfees = await paymentTotals(fdate, tdate, false); const otherfees = await paymentTotals(fdate, tdate, true);
  const intotals = intotal + tutionfees.paiTotal + otherfees.paiTotal;
  res.json({ formdata: [appDate(fdate), appDate(tdate)], incomes, expences, intotal, extotal, balance: [round2(intotals - extotal)], institute: await db.one('SELECT * FROM institute LIMIT 1'), intotals, tutionfees, otherfees });
}));
module.exports = router;
