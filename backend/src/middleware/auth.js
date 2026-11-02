const db = require('../db');
const perms = require('../support/permissions');
const { HttpError } = require('../lib/http');

// Loads the signed-in user (if any) from the session onto req.user.
async function loadUser(req, res, next) {
  try {
    req.user = null;
    if (req.session && req.session.userId) {
      req.user = await db.one('SELECT * FROM users WHERE id=$1', [req.session.userId]);
      if (!req.user) delete req.session.userId;
    }
    next();
  } catch (e) { next(e); }
}
const auth = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Unauthenticated.')));
const admin = (req, res, next) => (req.user && req.user.group === 'Admin' ? next() : next(new HttpError(req.user ? 403 : 401, 'Page not found.')));
const superAdmin = (req, res, next) => (req.user && req.user.group === 'Admin' && req.user.login === 'ictkashif' ? next() : next(new HttpError(req.user ? 403 : 401, 'Page not found.')));
// checkPermission('patient_view')
const can = (permission) => async (req, res, next) => {
  try {
    if (!req.user) return next(new HttpError(401, 'Unauthenticated.'));
    if (await perms.allows(req, permission)) return next();
    next(new HttpError(403, 'You do not have permission to do that.', { permission }));
  } catch (e) { next(e); }
};
module.exports = { loadUser, auth, admin, superAdmin, can };
