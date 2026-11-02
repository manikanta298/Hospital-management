// Port of jeremykenedy/laravel-logger: records each request of a signed-in user in activity_log.
const db = require('../db');
const SKIP = [/^\/api\/activity/, /^\/api\/session/, /^\/api\/me/, /^\/api\/health/];
module.exports = (req, res, next) => {
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 500 || SKIP.some((r) => r.test(req.originalUrl))) return;
    const label = { GET: 'Viewed', POST: 'Created', PUT: 'Edited', PATCH: 'Edited', DELETE: 'Deleted' }[req.method] || req.method;
    db.insert('activity_log', {
      description: `${label} ${req.originalUrl.split('?')[0]}`, userType: 'Registered', userId: req.user.id, route: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      ipAddress: req.ip, userAgent: req.get('user-agent'), locale: (req.get('accept-language') || '').split(',')[0] || 'en', referer: req.get('referer') || null, methodType: req.method,
    }).catch(() => {});
  });
  next();
};
