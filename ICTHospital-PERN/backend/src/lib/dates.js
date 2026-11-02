// Minimal Carbon replacement: local-time parsing and arithmetic on 'YYYY-MM-DD[ HH:MM[:SS]]' strings.
const pad = (n) => String(n).padStart(2, '0');
function parse(s) {
  if (s instanceof Date) return new Date(s.getTime());
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(s); return isNaN(d) ? null : d;
}
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateTimeStr = (d) => `${dateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addMinutes = (d, n) => new Date(d.getTime() + n * 60000);
const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
const diffDays = (a, b) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayName = (d) => DAYS[d.getDay()];
module.exports = { parse, dateStr, dateTimeStr, hm, addMinutes, addDays, diffDays, dayName, DAYS, pad };
