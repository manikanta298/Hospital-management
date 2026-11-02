// Small helpers shared by every route: async wrapper, errors, Laravel-style validation.
class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); } }
class ValidationError extends HttpError { constructor(errors) { super(422, 'The given data was invalid.', { errors }); } }

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const abort = (status, message) => { throw new HttpError(status, message || (status === 404 ? 'Not found' : 'Error')); };
const notFound = (row) => { if (!row) abort(404, 'Not found'); return row; };
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const labelOf = (f) => f.replace(/_/g, ' ');

// rules: { field: 'required|email|max:100' | ['required', fn] }
function validate(body, rules, messages = {}) {
  const errors = {}; const out = {};
  const add = (f, rule, text) => { (errors[f] = errors[f] || []).push(messages[`${f}.${rule}`] || text); };
  for (const [field, spec] of Object.entries(rules)) {
    const list = Array.isArray(spec) ? spec : String(spec).split('|');
    const v = body[field];
    const required = list.includes('required');
    const requiredWith = list.find((r) => typeof r === 'string' && r.startsWith('required_with:'));
    if (isBlank(v)) {
      if (required) add(field, 'required', `The ${labelOf(field)} field is required.`);
      else if (requiredWith && requiredWith.slice(14).split(',').some((o) => !isBlank(body[o]))) add(field, 'required_with', `The ${labelOf(field)} field is required.`);
      out[field] = v === undefined ? undefined : null;
      continue;
    }
    out[field] = typeof v === 'string' ? v.trim() : v;
    const numeric = list.includes('numeric') || list.includes('integer');
    for (const r of list) {
      if (typeof r === 'function') { const m = r(v, body); if (m) add(field, 'custom', m); continue; }
      const [name, arg] = r.split(/:(.*)/s);
      const s = String(v);
      switch (name) {
        case 'email': if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) add(field, name, `The ${labelOf(field)} must be a valid email address.`); break;
        case 'max': if ((numeric ? Number(v) : s.length) > Number(arg)) add(field, name, `The ${labelOf(field)} may not be greater than ${arg}${numeric ? '' : ' characters'}.`); break;
        case 'min': if ((numeric ? Number(v) : s.length) < Number(arg)) add(field, name, `The ${labelOf(field)} must be at least ${arg}${numeric ? '' : ' characters'}.`); break;
        case 'numeric': if (isNaN(Number(v)) || s.trim() === '') add(field, name, `The ${labelOf(field)} must be a number.`); break;
        case 'integer': if (!/^-?\d+$/.test(s)) add(field, name, `The ${labelOf(field)} must be an integer.`); break;
        case 'date': if (isNaN(Date.parse(s))) add(field, name, `The ${labelOf(field)} is not a valid date.`); break;
        case 'in': if (!arg.split(',').includes(s)) add(field, name, `The selected ${labelOf(field)} is invalid.`); break;
        case 'date_format': if (arg === 'H:i' && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(s)) add(field, name, `The ${labelOf(field)} does not match the format ${arg}.`); break;
        case 'boolean': if (![true, false, 0, 1, '0', '1', 'true', 'false', 'on', 'off'].includes(v)) add(field, name, `The ${labelOf(field)} field must be true or false.`); break;
        case 'array': if (!Array.isArray(v)) add(field, name, `The ${labelOf(field)} must be an array.`); break;
        case 'regex': if (!new RegExp(arg).test(s)) add(field, name, `The ${labelOf(field)} format is invalid.`); break;
        default: break;
      }
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}
const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on' || v === 'yes';
// assertExists({patient: 5}, {patient: 'patient'}) -> 422 if the id is not a row of that table
async function assertExists(values, tables) {
  const db = require('../db'); const errors = {};
  for (const [field, table] of Object.entries(tables)) {
    const v = values[field]; if (isBlank(v)) continue;
    if (!(await db.one(`SELECT 1 FROM "${table}" WHERE id=$1`, [v]))) errors[field] = [`The selected ${labelOf(field)} is invalid.`];
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
}
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => round2(n).toFixed(2);
const nullIfBlank = (v) => (isBlank(v) ? null : v);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
module.exports = { assertExists, HttpError, ValidationError, wrap, abort, notFound, validate, bool, num, int, round2, money, nullIfBlank, pick, isBlank };
