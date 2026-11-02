export const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtDate = (s) => (s ? String(s).slice(0, 10) : '');
export const fmtDateTime = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '');
export const cls = (...a) => a.filter(Boolean).join(' ');
export const fullName = (u) => (u ? `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.login : '');
export const titleCase = (s) => String(s || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
