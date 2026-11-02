// Front desk cash: shift close, day book, final settlement. Mounted at /api (explicit paths).
const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError, round2, money, int, num, HttpError } = require('../lib/http');
const perms = require('../support/permissions');
const modes = require('../support/paymentModes');
const branch = require('../support/branch');
const patientType = require('../support/patientType');
const math = require('../support/invoiceMath');

const userName = (u) => (`${u.firstname || ''} ${u.lastname || ''}`.trim() || u.login);
function totals(payments) {
  const t = { cash: 0, bank_transfer: 0, card: 0, cheque: 0, other: 0, write_off: 0, count: 0 };
  for (const p of payments) { const a = parseFloat(p.amount); if (modes.isWriteOff(p.method)) { t.write_off += a; continue; } t[modes.bucket(p.method)] += a; t.count++; }
  for (const k of Object.keys(t)) if (k !== 'count') t[k] = round2(t[k]);
  t.total = round2(t.cash + t.bank_transfer + t.card + t.cheque + t.other); return t;
}
const target = async (req) => { const asked = int(req.body && req.body.user_id !== undefined ? req.body.user_id : req.query.user_id); return asked && (await perms.allows(req, 'cash_close_all_users')) ? asked : req.user.id; };
const openPayments = async (userId, c) => { const rows = await db.q('SELECT * FROM invoice_payment WHERE received_by=$1 AND shift_close_id IS NULL ORDER BY paid_at', [userId], c); for (const r of rows) r.invoice = await db.find('payment', r.payment_id, c); return rows; };

router.get('/cash-close', can('cash_close'), wrap(async (req, res) => {
  const all = await perms.allows(req, 'cash_close_all_users'); const userId = await target(req); const open = await openPayments(userId);
  const history = await db.q(`SELECT * FROM shift_close ${all ? '' : 'WHERE user_id=$1'} ORDER BY closed_at DESC LIMIT 50`, all ? [] : [req.user.id]);
  const users = await db.q('SELECT id, firstname, lastname, login FROM users ORDER BY firstname');
  res.json({ userId, users: all ? users : [], payments: open, totals: totals(open), history, userNames: Object.fromEntries(users.map((u) => [u.id, userName(u)])) });
}));
router.post('/cash-close', can('cash_close'), wrap(async (req, res) => {
  const data = validate(req.body, { user_id: 'nullable|integer', counted_cash: 'nullable|numeric|min:0', comment: 'nullable|max:500' }); const userId = await target(req);
  const close = await db.tx(async (c) => {
    const open = await db.q('SELECT * FROM invoice_payment WHERE received_by=$1 AND shift_close_id IS NULL FOR UPDATE', [userId], c);
    if (!open.length) throw new ValidationError({ counted_cash: ['There is nothing to close: no payments since the last close.'] });
    const t = totals(open); const counted = data.counted_cash !== null && data.counted_cash !== undefined && data.counted_cash !== '' ? round2(parseFloat(data.counted_cash)) : null;
    const close = await db.insert('shift_close', { user_id: userId, opened_at: open.map((p) => p.paid_at).sort()[0], closed_at: db.now(), payments_count: t.count, total: t.total, cash: t.cash, bank_transfer: t.bank_transfer, card: t.card, cheque: t.cheque, other: t.other, counted_cash: counted, difference: counted === null ? null : round2(counted - t.cash), comment: data.comment ?? null, closed_by: req.user.id, branch_id: branch.current(req) }, c);
    await c.query('UPDATE invoice_payment SET shift_close_id=$1 WHERE id = ANY($2)', [close.id, open.map((p) => p.id)]); return close;
  });
  res.status(201).json({ success: 'Shift closed.', close });
}));
router.get('/cash-close/:id(\\d+)', can('cash_close'), wrap(async (req, res) => {
  const close = notFound(await db.find('shift_close', req.params.id));
  if (Number(close.user_id) !== Number(req.user.id) && !(await perms.allows(req, 'cash_close_all_users'))) throw new HttpError(403, 'Forbidden');
  const payments = await db.q('SELECT * FROM invoice_payment WHERE shift_close_id=$1 ORDER BY paid_at', [close.id]); for (const p of payments) p.invoice = await db.find('payment', p.payment_id);
  const user = await db.find('users', close.user_id);
  res.json({ close, payments, cashier: user ? userName(user) : '-', institute: await db.one('SELECT * FROM institute LIMIT 1') });
}));

router.get('/day-book', can('view_payment_reports'), wrap(async (req, res) => {
  const from = String(req.query.from || db.today()); const to = String(req.query.to || from); const kind = String(req.query.kind || ''); const userId = String(req.query.user || '');
  const types = Object.fromEntries((await db.q('SELECT * FROM patient_type')).map((t) => [t.id, t])); const def = await patientType.defaultId();
  const where = ['date >= $1', 'date <= $2']; const params = [from, to]; branch.scope(req, where, params); if (userId) { params.push(userId); where.push(`"user"=$${params.length}`); }
  const invoices = await math.hydrateItems(await db.q(`SELECT * FROM payment WHERE ${where.join(' AND ')} ORDER BY date, id`, params));
  const services = Object.fromEntries((await db.q('SELECT * FROM payment_category')).map((s) => [s.id, s]));
  const shareRows = invoices.length ? await db.q('SELECT invoice_item_id, SUM(amount) amt FROM doctor_share WHERE payment_id = ANY($1) GROUP BY invoice_item_id', [invoices.map((i) => i.id)]) : []; const shares = Object.fromEntries(shareRows.map((r) => [r.invoice_item_id, parseFloat(r.amt)]));
  const lines = []; const byDept = {}; const byKind = {};
  for (const inv of invoices) {
    const type = types[inv.patient_type_id || def]; const bucket = patientType.bucket(type && type.kind); if (kind !== '' && bucket.toLowerCase() !== kind) continue;
    const subtotal = inv.items.reduce((a, i) => a + parseFloat(i.line_total), 0); const discount = Math.min(parseFloat(inv.discount) || 0, subtotal);
    for (const item of inv.items) {
      const gross = parseFloat(item.line_total); const lineDiscount = subtotal > 0 ? round2((discount * gross) / subtotal) : 0; const net = round2(gross - lineDiscount); const doctor = round2(shares[item.id] || 0);
      const svc = services[item.payment_category_id]; const dept = (svc && svc.department) || 'Not set';
      lines.push({ date: inv.date, invoice: inv.id, patient: inv.patient_name, type: (type && type.name) || 'General', bucket, service: item.name, department: dept, gross, discount: lineDiscount, net, doctor, hospital: round2(net - doctor) });
      (byDept[dept] = byDept[dept] || {})[bucket] = round2(((byDept[dept] || {})[bucket] || 0) + net);
      const k = (svc && svc.service_kind) || 'other'; byKind[k] = round2((byKind[k] || 0) + net);
    }
  }
  if (req.query.export === 'csv') {
    const csv = ['Date,Invoice,Patient,Patient type,Group,Service,Department,Gross,Discount,Net,Doctor share,Hospital share', ...lines.map((l) => [l.date, l.invoice, l.patient, l.type, l.bucket, l.service, l.department, l.gross, l.discount, l.net, l.doctor, l.hospital].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n';
    return res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="day-book-${from}-to-${to}.csv"` }).send(csv);
  }
  const cw = ['paid_at::date >= $1', 'paid_at::date <= $2']; const cp = [from, to]; if (userId) { cp.push(userId); cw.push('received_by=$3'); }
  const collections = await db.q(`SELECT * FROM invoice_payment WHERE ${cw.join(' AND ')}`, cp);
  const sortedDept = Object.fromEntries(Object.keys(byDept).sort().map((k) => [k, byDept[k]]));
  res.json({ lines, byDept: sortedDept, kind_summary: byKind, collections: totals(collections), filters: { from, to, kind, userId }, users: await db.q('SELECT id, firstname, lastname, login FROM users ORDER BY firstname') });
}));

router.get('/settlement', can('payment_add'), wrap(async (req, res) => {
  const patient = req.query.patient ? await db.find('patient', req.query.patient) : null;
  const invoices = patient ? await math.hydrateItems(await math.hydratePayments(await db.q('SELECT * FROM payment WHERE patient=$1 ORDER BY date, id', [patient.id]))) : [];
  const sum = (f) => round2(invoices.reduce((a, i) => a + parseFloat(i[f] || 0), 0));
  const paid = round2(invoices.reduce((a, i) => a + i.payments.filter((p) => !modes.isWriteOff(p.method)).reduce((x, p) => x + parseFloat(p.amount), 0), 0));
  const writtenOff = round2(invoices.reduce((a, i) => a + i.payments.filter((p) => modes.isWriteOff(p.method)).reduce((x, p) => x + parseFloat(p.amount), 0), 0));
  for (const i of invoices) { i.balance = math.balance(i); i.paid = round2(math.paid(i)); i.settlement = math.settlement(i); }
  res.json({ patient, patients: await db.q('SELECT id, name, patient_id FROM patient ORDER BY name'), invoices, base: sum('amount'), discount: sum('discount'), net: sum('gross_total'), paid, writtenOff, receivable: round2(Math.max(0, invoices.reduce((a, i) => a + i.balance, 0))), modes: modes.MODES });
}));
router.post('/settlement/:patient(\\d+)', can('payment_add'), wrap(async (req, res) => {
  const patient = notFound(await db.find('patient', req.params.patient));
  const data = validate(req.body, { amount: 'nullable|numeric|min:0', method: `required|in:${modes.MODES.join(',')}`, reference: 'nullable|max:120', write_off: 'nullable|numeric|min:0', write_off_reason: 'nullable|max:120' });
  const amount = round2(num(data.amount)); const writeOff = round2(num(data.write_off));
  if (writeOff > 0 && !String(data.write_off_reason ?? '').trim()) throw new ValidationError({ write_off_reason: ['Say why the balance is being written off.'] });
  if (writeOff > 0 && !(await perms.allows(req, 'payment_update'))) throw new ValidationError({ write_off: ['Your role cannot write off a balance.'] });
  if (amount <= 0 && writeOff <= 0) throw new ValidationError({ amount: ['Enter the amount received or a write-off.'] });
  await db.tx(async (c) => {
    const invoices = await math.hydratePayments(await db.q('SELECT * FROM payment WHERE patient=$1 ORDER BY date, id FOR UPDATE', [patient.id], c), c);
    const outstanding = round2(invoices.reduce((a, i) => a + Math.max(0, math.balance(i)), 0));
    if (amount + writeOff > outstanding + 0.004) throw new ValidationError({ amount: [`Only ${outstanding.toFixed(2)} is outstanding for this patient.`] });
    for (const [amt, method, ref] of [[amount, data.method, data.reference ?? null], [writeOff, modes.WRITE_OFF, data.write_off_reason ?? null]]) {
      let left = amt;
      for (const inv of invoices) {
        if (left <= 0.004) break; const bal = math.balance(inv); if (bal <= 0.004) continue; const take = round2(Math.min(bal, left));
        const row = await db.insert('invoice_payment', { payment_id: inv.id, amount: money(take), method, reference: ref, paid_at: db.now(), received_by: req.user.id }, c); inv.payments.push(row); left = round2(left - take);
        await db.update('payment', inv.id, { amount_received: money(math.paid(inv)), status: math.settlement(inv) }, c);
      }
    }
  });
  res.json({ success: 'Settlement recorded.', patient: patient.id });
}));
module.exports = router;
