const bcrypt = require('bcryptjs');
const db = require('../db');
const { validate } = require('../lib/http');
const userFor = async (person) => { const id = person ? String(person.ion_user_id ?? '') : ''; return /^\d+$/.test(id) && id !== '0' ? db.find('users', Number(id)) : null; };
// Validates the optional login_username / login_password pair on a staff form.
async function check(body, person) {
  const user = await userFor(person);
  const rules = {
    login_username: [user ? 'nullable' : 'required_with:login_password', 'max:20', 'regex:^[A-Za-z0-9._-]+$',
      async () => null],
    login_password: [user ? 'nullable' : 'required_with:login_username', 'min:8', 'max:64'],
  };
  const messages = { 'login_username.regex': 'Use letters, numbers, dots, dashes or underscores for the username.', 'login_username.required_with': 'Enter a username for the new login.', 'login_password.required_with': 'Enter a password for the new login.' };
  const out = validate(body, { login_username: rules.login_username.filter((r) => typeof r === 'string'), login_password: rules.login_password }, messages);
  if (out.login_username) {
    const taken = await db.one('SELECT id FROM users WHERE login=$1 AND ($2::int IS NULL OR id<>$2)', [out.login_username, user ? user.id : null]);
    if (taken) { const { ValidationError } = require('../lib/http'); throw new ValidationError({ login_username: ['That username is already taken.'] }); }
  }
  return out;
}
// Creates or updates the login behind a staff record. Returns a message or null.
async function apply(person, table, group, fields) {
  const username = String(fields.login_username ?? '').trim(); const password = String(fields.login_password ?? '');
  const user = await userFor(person);
  if (user) {
    const changed = []; const patch = {};
    if (username !== '' && username !== user.login) { patch.login = username; changed.push('username'); }
    if (password !== '') { patch.password = bcrypt.hashSync(password, 10); changed.push('password'); }
    if (changed.length) { await db.update('users', user.id, patch); return `Login ${changed.join(' and ')} updated.`; }
    return null;
  }
  if (username === '') return null;
  const [first, ...rest] = String(person.name || '').trim().split(' '); const last = rest.join(' ');
  const created = await db.insert('users', { firstname: (first || username).slice(0, 20), lastname: (last || '-').slice(0, 20), login: username, email: String(person.email ?? ''), group, desc: `${group} login for ${person.name}`.slice(0, 200), password: bcrypt.hashSync(password, 10) });
  await db.update(table, person.id, { ion_user_id: String(created.id) });
  return `Login created: ${username}.`;
}
module.exports = { userFor, check, apply };
