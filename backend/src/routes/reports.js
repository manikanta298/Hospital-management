const router = require('express').Router();
const db = require('../db');
const { can, auth } = require('../middleware/auth');
const { wrap, round2, num } = require('../lib/http');
const D = require('../lib/dates');
const math = require('../support/invoiceMath');

function range(q, defaultDays) {
  let from = q.from ? D.parse(q.from) : D.addDays(new Date(), -defaultDays); let to = q.to ? D.parse(q.to) : new Date();
  from.setHours(0, 0, 0, 0); to.setHours(0, 0, 0, 0);
  if (from > to) [from, to] = [to, from];
  if (D.diffDays(from, to) > 366) from = D.addDays(to, -366);
  return [from, to];
}
router.get('/', auth, (req, res) => res.json({ reports: ['lab', 'drug-usage', 'debtors', 'occupancy'] }));
router.get('/lab', can('lab_test_view'), wrap(async (req, res) => {
  const tests = await db.q("SELECT * FROM lab_test WHERE result IS NULL OR result='' ORDER BY lab_id");
  const labIds = [...new Set(tests.map((t) => t.lab_id))]; const labs = labIds.length ? Object.fromEntries((await db.q('SELECT * FROM lab WHERE id = ANY($1)', [labIds])).map((l) => [l.id, l])) : {};
  const pids = [...new Set(Object.values(labs).map((l) => l.patient).filter(Boolean))]; const patients = pids.length ? Object.fromEntries((await db.q('SELECT id, name, patient_id FROM patient WHERE id = ANY($1)', [pids])).map((p) => [p.id, p])) : {};
  const rows = tests.map((test) => { const lab = labs[test.lab_id] || null; const requested = lab && lab.date ? D.parse(lab.date) : null; return { test, lab, patient: lab ? patients[lab.patient] || null : null, days: requested ? D.diffDays(requested, new Date()) : null }; }).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  const byTest = {}; for (const t of tests) byTest[t.name] = (byTest[t.name] || 0) + 1;
  res.json({ rows, overdue: rows.filter((r) => (r.days ?? 0) >= 3).length, byTest: Object.fromEntries(Object.entries(byTest).sort((a, b) => b[1] - a[1])) });
}));
router.get('/drug-usage', can('view_pharmacy_reports'), wrap(async (req, res) => {
  const [from, to] = range(req.query, 30); const f = D.dateStr(from); const t = D.dateStr(to);
  const prescribed = Object.fromEntries((await db.q('SELECT pm.name, COUNT(*)::int n FROM prescription_medicine pm JOIN prescription p ON p.id=pm.prescription_id WHERE p.date BETWEEN $1 AND $2 GROUP BY pm.name', [f, t])).map((r) => [r.name, r.n]));
  const dispensed = Object.fromEntries((await db.q('SELECT i.name, SUM(i.quantity)::int qty, SUM(i.line_total) val FROM pharmacy_sale_item i JOIN pharmacy_payment s ON s.id=i.pharmacy_payment_id WHERE s.date BETWEEN $1 AND $2 GROUP BY i.name', [f, t])).map((r) => [r.name, r]));
  const names = [...new Set([...Object.keys(prescribed), ...Object.keys(dispensed)])].sort();
  const rows = names.map((name) => ({ name, prescribed: prescribed[name] || 0, dispensed: dispensed[name] ? dispensed[name].qty : 0, value: dispensed[name] ? num(dispensed[name].val) : 0 })).sort((a, b) => b.dispensed + b.prescribed - (a.dispensed + a.prescribed));
  res.json({ rows, from: f, to: t, totalValue: rows.reduce((a, r) => a + r.value, 0) });
}));
router.get('/debtors', can('view_payment_reports'), wrap(async (req, res) => {
  const invoices = (await math.hydratePayments(await db.q('SELECT * FROM payment ORDER BY date'))).filter((i) => math.balance(i) > 0.001);
  const pids = [...new Set(invoices.map((i) => i.patient).filter(Boolean))]; const patients = pids.length ? Object.fromEntries((await db.q('SELECT id, name, patient_id, phone FROM patient WHERE id = ANY($1)', [pids])).map((p) => [p.id, p])) : {};
  const groups = {}; for (const i of invoices) (groups[i.patient] = groups[i.patient] || []).push(i);
  const rows = Object.entries(groups).map(([pid, g]) => { const oldest = g.map((i) => i.date).filter(Boolean).sort()[0]; return { patient: patients[pid] || null, invoices: g.length, owed: round2(g.reduce((a, i) => a + math.balance(i), 0)), oldest, days: oldest ? D.diffDays(D.parse(oldest), new Date()) : null }; }).sort((a, b) => b.owed - a.owed);
  const buckets = { '0 to 30 days': 0, '31 to 60 days': 0, '61 to 90 days': 0, 'over 90 days': 0 };
  for (const r of rows) { const d = r.days ?? 0; buckets[d <= 30 ? '0 to 30 days' : d <= 60 ? '31 to 60 days' : d <= 90 ? '61 to 90 days' : 'over 90 days'] += r.owed; }
  res.json({ rows, total: round2(rows.reduce((a, r) => a + r.owed, 0)), buckets });
}));
router.get('/occupancy', can('bed_view'), wrap(async (req, res) => {
  const [from, to] = range(req.query, 30); const f = D.dateStr(from);
  const admissions = await db.q('SELECT * FROM alloted_bed WHERE (d_time IS NULL OR d_time >= $1) AND a_time <= $2', [f, `${D.dateStr(to)} 23:59:59`]);
  const beds = Object.fromEntries((await db.q('SELECT * FROM bed')).map((b) => [b.id, b])); const cats = Object.fromEntries((await db.q('SELECT id, category FROM bed_category')).map((c) => [c.id, c.category])); const totalBeds = Math.max(1, Object.keys(beds).length);
  const days = [];
  for (let day = new Date(from); day <= to; day = D.addDays(day, 1)) {
    const end = new Date(day); end.setHours(23, 59, 59, 999); const start = new Date(day); start.setHours(0, 0, 0, 0);
    const occupied = admissions.filter((a) => { const i = a.a_time ? D.parse(a.a_time) : null; const o = a.d_time ? D.parse(a.d_time) : null; return i && i <= end && (!o || o >= start); }).length;
    days.push({ date: D.dateStr(day), occupied, percent: Math.round((occupied / totalBeds) * 100) });
  }
  const closed = admissions.filter((a) => a.a_time && a.d_time); const stays = closed.map((a) => Math.max(1, D.diffDays(D.parse(a.a_time), D.parse(a.d_time))));
  const byWard = {}; for (const a of admissions) { const bed = beds[a.bed_id]; const k = bed ? cats[bed.category] || 'Uncategorised' : 'Removed bed'; byWard[k] = (byWard[k] || 0) + 1; }
  res.json({ days, from: f, to: D.dateStr(to), totalBeds: Object.keys(beds).length, currentlyOccupied: admissions.filter((a) => !a.d_time).length, averageStay: stays.length ? Math.round((stays.reduce((a, b) => a + b, 0) / stays.length) * 10) / 10 : null, discharges: closed.length, byWard: Object.fromEntries(Object.entries(byWard).sort((a, b) => b[1] - a[1])), peak: days.reduce((m, d) => Math.max(m, d.occupied), 0) });
}));
module.exports = router;
