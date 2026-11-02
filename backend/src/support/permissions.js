const db = require('../db');
// Grants for the signed-in user's role, loaded once per request (cached on req).
async function load(role) {
  if (!role) return {};
  const rows = await db.q("SELECT permission_name FROM permission WHERE permission_group=$1 AND permission_type='yes'", [role]);
  return Object.fromEntries(rows.map((r) => [r.permission_name, true]));
}
async function grants(req) {
  if (!req.user) return {};
  const role = String(req.user.group || '').toLowerCase();
  if (!req._grants || req._grantsRole !== role) { req._grants = await load(role); req._grantsRole = role; }
  return req._grants;
}
async function allows(req, permission) { return !!(await grants(req))[permission]; }
const key = (label) => label.toLowerCase().replace(/ /g, '_');
module.exports = { allows, grants, key };
