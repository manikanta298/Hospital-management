const { HttpError } = require('../lib/http');
const notFound = (req, res, next) => next(new HttpError(404, 'Not found'));
// eslint-disable-next-line no-unused-vars
const handler = (err, req, res, next) => {
  if (err.code === '23505') return res.status(422).json({ error: 'That record already exists.', errors: {} });
  if (err.code === '23503') return res.status(422).json({ error: 'That record is still in use by other records.', errors: {} });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(422).json({ error: 'The file is too large.', errors: {} });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Server error.' : err.message, errors: err.errors || undefined, permission: err.permission });
};
module.exports = { notFound, handler };
