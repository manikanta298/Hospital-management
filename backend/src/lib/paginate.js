// Laravel-style paginator: GET ?page=N -> { data, meta:{current_page,per_page,total,last_page,from,to} }
const db = require('../db');
async function paginate(req, { select = '*', from, where = [], params = [], order = 'id DESC', perPage = 25, map }) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = parseInt(await db.val(`SELECT COUNT(*) FROM ${from} ${w}`, params), 10);
  let data = await db.q(`SELECT ${select} FROM ${from} ${w} ORDER BY ${order} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`, params);
  if (map) data = await map(data);
  const last = Math.max(1, Math.ceil(total / perPage));
  return { data, meta: { current_page: page, per_page: perPage, total, last_page: last, from: total ? (page - 1) * perPage + 1 : null, to: total ? Math.min(page * perPage, total) : null } };
}
module.exports = paginate;
