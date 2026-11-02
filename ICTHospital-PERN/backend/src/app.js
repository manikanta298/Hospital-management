const path = require('path'); const fs = require('fs');
const express = require('express'); const session = require('express-session'); const PgStore = require('connect-pg-simple')(session);
const helmet = require('helmet'); const morgan = require('morgan');
const db = require('./db');
const { loadUser } = require('./middleware/auth');
const activity = require('./middleware/activity');
const { notFound, handler } = require('./middleware/errors');
const { root: uploadRoot } = require('./lib/upload');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(express.json({ limit: '5mb' })); app.use(express.urlencoded({ extended: true }));
  if (process.env.CLIENT_ORIGIN) app.use((req, res, next) => { res.set({ 'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); return req.method === 'OPTIONS' ? res.sendStatus(204) : next(); });
  app.use(session({
    store: new PgStore({ pool: db.pool, createTableIfMissing: true }), name: 'connect.sid', secret: process.env.SESSION_SECRET || 'dev-secret-change-me', resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: (parseInt(process.env.SESSION_LIFETIME_MINUTES, 10) || 120) * 60000 },
  }));
  app.use('/storage', express.static(uploadRoot, { index: false, dotfiles: 'deny', setHeaders: (r) => r.set('X-Content-Type-Options', 'nosniff') }));
  app.use('/api', loadUser, activity);

  const r = (p, file, ...mw) => app.use(`/api${p}`, ...mw, require(`./routes/${file}`));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  r('', 'auth');
  r('/dashboard', 'dashboard'); r('/search', 'search'); r('/users', 'users'); r('/settings', 'settings'); r('/permission', 'permissions'); r('/institute', 'institute');
  r('/hospital-branches', 'hospitalBranches'); app.use('/api/branch-switch', require('./routes/hospitalBranches').switchRouter);
  r('/patients', 'patients'); r('/doctors', 'doctors'); r('/appointments', 'appointments'); r('', 'opd'); r('/consultations', 'consultations'); r('/prescriptions', 'prescriptions');
  r('/medicines', 'medicines'); r('/pharmacy', 'pharmacy'); r('/lab', 'lab'); r('/radiology', 'radiology'); r('/beds', 'beds'); r('/admissions', 'admissions'); r('/departments', 'departments');
  r('/staff', 'staff'); r('/history', 'history'); r('/services', 'services'); r('/services', 'packageItems'); r('/gateways', 'gateways'); r('/invoices', 'invoices'); r('', 'pricing');
  r('/doctor-share', 'doctorShare'); r('', 'cash'); r('/reports', 'reports'); r('/accounting', 'accounting'); r('', 'messaging'); r('/barcode', 'barcode'); r('/activity', 'activity');
  // Cron endpoint for an external scheduler (same path as the Laravel route). Set CRON_TOKEN to require ?token=.
  app.get('/api/cronjob/payment-reminder', async (req, res, next) => { try { if (process.env.CRON_TOKEN && req.query.token !== process.env.CRON_TOKEN) return res.status(403).json({ error: 'Forbidden' }); res.json(await require('./jobs/paymentReminder').run()); } catch (e) { next(e); } });
  app.use('/api', notFound);

  // Production: serve the built React app and fall back to index.html for client-side routes.
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html'))); }
  app.use(handler);
  return app;
}
module.exports = createApp;
