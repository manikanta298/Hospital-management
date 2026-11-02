// Activity log (port of jeremykenedy/laravel-logger). Admin only. "Cleared" entries are soft-deleted.
const router = require('express').Router();
const db = require('../db');
const { auth, admin } = require('../middleware/auth');
const { wrap, notFound } = require('../lib/http');
const paginate = require('../lib/paginate');
router.use(auth, admin);
const mapUsers = async (rows) => { const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean))]; const u = ids.length ? Object.fromEntries((await db.q('SELECT id, firstname, lastname, login, email FROM users WHERE id = ANY($1)', [ids])).map((x) => [x.id, x])) : {}; for (const r of rows) r.userDetails = u[r.userId] || null; return rows; };
router.get('/', wrap(async (req, res) => {
  const where = ['deleted_at IS NULL']; const params = []; const q = req.query;
  if (q.description) { params.push(`%${q.description}%`); where.push(`description ILIKE $${params.length}`); }
  if (q.user) { params.push(q.user); where.push(`"userId"=$${params.length}`); }
  if (q.method) { params.push(q.method); where.push(`"methodType"=$${params.length}`); }
  if (q.route) { params.push(`%${q.route}%`); where.push(`route ILIKE $${params.length}`); }
  if (q.ip_address) { params.push(`%${q.ip_address}%`); where.push(`"ipAddress" ILIKE $${params.length}`); }
  const out = await paginate(req, { from: 'activity_log', where, params, order: 'created_at DESC, id DESC', perPage: 25, map: mapUsers });
  res.json({ ...out, totalActivities: out.meta.total, users: await db.q('SELECT id, firstname, lastname, login FROM users ORDER BY firstname') });
}));
router.get('/export', wrap(async (req, res) => {
  const rows = await mapUsers(await db.q('SELECT * FROM activity_log WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50000'));
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['ID,Time,User,Description,Method,Route,IP,User agent', ...rows.map((r) => [r.id, r.created_at, r.userDetails ? `${r.userDetails.firstname} ${r.userDetails.lastname}` : '', r.description, r.methodType, r.route, r.ipAddress, r.userAgent].map(q).join(','))].join('\n') + '\n';
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="activity-log.csv"' }).send(csv);
}));
router.get('/cleared', wrap(async (req, res) => { const out = await paginate(req, { from: 'activity_log', where: ['deleted_at IS NOT NULL'], order: 'created_at DESC', map: mapUsers }); res.json({ ...out, totalActivities: out.meta.total }); }));
router.get('/log/:id(\\d+)', wrap(async (req, res) => {
  const a = notFound(await db.find('activity_log', req.params.id)); const [row] = await mapUsers([a]);
  const mine = await db.q('SELECT * FROM activity_log WHERE "userId"=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 25', [a.userId]);
  res.json({ activity: row, userActivities: await mapUsers(mine), totalUserActivities: mine.length, isClearedEntry: !!a.deleted_at });
}));
router.delete('/clear-activity', wrap(async (req, res) => { await db.q('UPDATE activity_log SET deleted_at=$1 WHERE deleted_at IS NULL', [db.now()]); res.json({ success: 'Activity log cleared successfully.' }); }));
router.delete('/destroy-activity', wrap(async (req, res) => { await db.q('DELETE FROM activity_log WHERE deleted_at IS NOT NULL'); res.json({ success: 'Activity log destroyed successfully.' }); }));
router.post('/restore-log', wrap(async (req, res) => { await db.q('UPDATE activity_log SET deleted_at=NULL WHERE deleted_at IS NOT NULL'); res.json({ success: 'Activity log restored successfully.' }); }));
module.exports = router;
