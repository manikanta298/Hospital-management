const db = require('../db');
const D = require('../lib/dates');
const { ValidationError } = require('../lib/http');
async function blockFor(doctorId, start, end, c) {
  for (const b of await db.q('SELECT * FROM slot_block WHERE doctor_id=$1 AND date=$2', [doctorId, D.dateStr(start)], c)) {
    if (!b.start_time || !b.end_time) return b;
    const from = D.parse(`${D.dateStr(start)} ${b.start_time}`), to = D.parse(`${D.dateStr(start)} ${b.end_time}`);
    if (start < to && end > from) return b;
  }
  return null;
}
// Throws a validation error unless the doctor works (and is free) from start to end.
async function assertBookable(doctorId, start, end, c) {
  const block = await blockFor(doctorId, start, end, c);
  if (block) throw new ValidationError({ start: [`The doctor is not available then${block.reason ? ` (${block.reason})` : ''}.`] });
  const all = await db.q('SELECT * FROM doctor_slot WHERE doctor_id=$1 AND active=TRUE', [doctorId], c);
  if (!all.length) return;
  const day = all.filter((s) => Number(s.weekday) === start.getDay());
  for (const s of day) {
    const from = D.parse(`${D.dateStr(start)} ${s.start_time}`), to = D.parse(`${D.dateStr(start)} ${s.end_time}`);
    if (start >= from && end <= to) return;
  }
  const hours = day.map((s) => `${s.start_time}-${s.end_time}`).join(', ');
  throw new ValidationError({ start: [hours === '' ? `The doctor has no clinic on ${D.dayName(start)}s.` : `Outside the doctor's clinic hours on ${D.dayName(start)} (${hours}).`] });
}
async function freeSlots(doctorId, date, c) {
  const day = D.parse(date);
  const slots = await db.q('SELECT * FROM doctor_slot WHERE doctor_id=$1 AND active=TRUE AND weekday=$2 ORDER BY start_time', [doctorId, day.getDay()], c);
  const booked = await db.q("SELECT s_time, e_time FROM appointment WHERE doctor=$1 AND date=$2 AND status NOT IN ('cancelled','no show')", [doctorId, D.dateStr(day)], c);
  const free = [];
  for (const s of slots) {
    let t = D.parse(`${D.dateStr(day)} ${s.start_time}`); const stop = D.parse(`${D.dateStr(day)} ${s.end_time}`);
    while (D.addMinutes(t, s.slot_minutes) <= stop) {
      const end = D.addMinutes(t, s.slot_minutes);
      const taken = booked.some((b) => b.s_time < D.dateTimeStr(end) && b.e_time > D.dateTimeStr(t));
      if (!taken && !(await blockFor(doctorId, t, end, c))) free.push({ start: D.hm(t), minutes: s.slot_minutes });
      t = end;
    }
  }
  return free;
}
module.exports = { assertBookable, freeSlots, blockFor };
