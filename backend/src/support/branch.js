const db = require('../db');
// The branch the signed-in user works in: their own, or the one an unrestricted user picked.
const current = (req) => {
  const u = req.user; if (!u) return null;
  if (u.branch_id) return Number(u.branch_id);
  const p = req.session && req.session.branch_id; return p ? Number(p) : null;
};
const canSwitch = (req) => !!req.user && !req.user.branch_id;
const name = (id) => (id ? db.val('SELECT name FROM hospital_branch WHERE id=$1', [id]) : null);
// Adds "(branch_id = X OR branch_id IS NULL)" to a WHERE-clause list.
function scope(req, where, params, column = 'branch_id') {
  const id = current(req); if (id === null) return;
  params.push(id); where.push(`(${column} = $${params.length} OR ${column} IS NULL)`);
}
module.exports = { current, canSwitch, name, scope };
