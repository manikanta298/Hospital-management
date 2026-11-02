// Mounts the built React app in jsdom against the real API + embedded PostgreSQL and visits every screen.
const { JSDOM, VirtualConsole } = require('jsdom'); const { boot } = require('./helper');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const t = await boot(); const { api, db } = t;
  await api.post('/login', { login: 'admin', password: '123456' });
  // --- seed a realistic data set through the API
  const doc = (await api.post('/doctors', { name: 'Dr Hana', department: 'Cardiology' })).body.doctor; await api.post('/departments', { name: 'Cardiology' });
  const svc = (await api.post('/services', { category: 'Consultation', c_price: 500, department: 'Cardiology', service_kind: 'consultation' })).body.service;
  await api.post('/patient-types', { name: 'General', kind: 'general', active: true });
  const pat = (await api.post('/patients', { name: 'Ali Khan', phone: '0300', sex: 'male', birthdate: '1990-01-01' })).body.patient;
  await api.post('/opd/visit-fees', { visit_type: 'first', shift: 'any', payment_category_id: svc.id, fee: 450 });
  const walk = (await api.post('/opd/walk-in', { patient: pat.id, doctor: doc.id, visit_type: 'first', bill: true })).body.visit;
  await api.post('/lab/catalogue', { category: 'CBC' }); const cat = await db.one('SELECT * FROM lab_category');
  await api.post('/radiology/catalogue', { name: 'Chest X-Ray', modality: 'xray' }); const ex = await db.one('SELECT * FROM radiology_exam');
  await api.post(`/consultations/visit/${walk.id}`, { diagnosis: 'x', lab_tests: [cat.id], radiology_exams: [ex.id], action: 'save', template_name: 'T' });
  await api.post('/medicines/categories', { category: 'Abx' }); await api.post('/medicines', { name: 'Amoxil', quantity: 10, s_price: 5 }); const med = await db.one('SELECT * FROM medicine');
  const rx = (await api.post('/prescriptions', { patient: pat.id, doctor: doc.id, date: '2026-01-01', items: [{ medicine_id: med.id, dosage: '1' }] })).body.prescription;
  const sale = (await api.post('/pharmacy', { patient: pat.id, date: '2026-01-01', items: [{ medicine_id: med.id, quantity: 1 }] })).body.sale;
  await api.post('/beds/categories', { category: 'Ward' }); const bc = await db.one('SELECT * FROM bed_category'); await api.post('/beds', { category: bc.id, number: '1' }); const bed = await db.one('SELECT * FROM bed');
  await api.post('/admissions', { patient: pat.id, bed_id: bed.id }); const adm = await db.one('SELECT * FROM alloted_bed');
  const inv = (await api.post('/invoices', { patient: pat.id, doctor: doc.id, date: '2026-01-01', items: [{ payment_category_id: svc.id }] })).body.invoice; await api.post(`/invoices/${inv.id}/pay`, { amount: 100, method: 'Cash' });
  const cc = (await api.post('/cash-close', { counted_cash: 100 })).body.close;
  await api.post('/history', { patient_id: pat.id, title: 'Asthma', description: 'x' }); const hist = await db.one('SELECT * FROM medical_history');
  await api.post('/staff/nurse', { name: 'Nina' }); const nurse = await db.one('SELECT * FROM nurse'); await api.post('/accounting/sectors', { name: 'Don', type: 'Income' });
  await api.post('/doctor-share/policies', { name: 'P', doctor_percent: 10 }); const appt = (await api.post('/appointments', { patient: pat.id, doctor: doc.id, date: '2030-01-01', start: '10:00', status: 'scheduled' })).body.appointment;
  const radio = await db.one('SELECT * FROM radiology_order'); const lab = await db.one('SELECT * FROM lab'); const con = await db.one('SELECT * FROM consultation'); const svc2 = svc.id;
  const routes = ['/dashboard', '/search?search=ali', '/settings', '/schedule', '/institute', '/users', '/permission', '/activity', '/activity/cleared', '/activity/log/1', '/hospital-branches', '/barcode', '/no-permission',
    '/patients', '/patients/new', `/patients/${pat.id}`, `/patients/${pat.id}/edit`, `/patients/${pat.id}/card`, `/patients/${pat.id}/wristband`, '/history', '/history/new', `/history/${hist.id}/edit`,
    '/doctors', '/doctors/new', `/doctors/${doc.id}`, `/doctors/${doc.id}/edit`, `/doctors/${doc.id}/slots`, '/staff/nurse', '/staff/nurse/new', `/staff/nurse/${nurse.id}/edit`, '/staff/pharmacist', '/departments',
    '/appointments', '/appointments/new', `/appointments/${appt.id}`, `/appointments/${appt.id}/edit`, '/opd/queue', '/opd/history', '/opd/visit-fees', `/opd/${walk.id}/token`,
    '/consultations', `/consultations/visit/${walk.id}`, `/consultations/${con.id}/print`, '/prescriptions', '/prescriptions/new', `/prescriptions/${rx.id}`, `/prescriptions/${rx.id}/edit`,
    '/medicines', '/medicines/new', '/medicines/categories', `/medicines/${med.id}/edit`, '/pharmacy', '/pharmacy/new', `/pharmacy/${sale.id}`, '/beds', '/beds/new', '/beds/categories', `/beds/${bed.id}/edit`, '/admissions', '/admissions/new', `/admissions/${adm.id}`,
    '/lab', '/lab/new', '/lab/catalogue', `/lab/${lab.id}`, '/radiology', '/radiology/new', '/radiology/catalogue', `/radiology/${radio.id}`, `/radiology/${radio.id}/print`,
    '/services', `/services/${svc2}/package`, '/pricing', '/patient-types', '/gateways', '/invoices', '/invoices/new', `/invoices/${inv.id}`, '/cash-close', `/cash-close/${cc.id}`, '/day-book', `/settlement?patient=${pat.id}`, '/doctor-share', '/doctor-share/policies',
    '/reports/debtors', '/reports/lab', '/reports/drug-usage', '/reports/occupancy', '/accounting', '/accounting/sectors', '/accounting/income', '/accounting/expence', '/accounting/report', '/accounting/report/Income/2026-01-01/2026-12-31', '/accounting/reportsum', '/accounting/reportsum/2026-01-01/2026-12-31',
    '/sms', '/smslog', '/template', '/ictcore?type=sms', '/notification-type', '/message'];
  // --- boot the SPA
  const origin = t.origin; const cookies = {}; const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`)); vc.on('error', (...a) => errors.push(`console.error: ${a.map(String).join(' ').slice(0, 300)}`));
  const fs = require('fs'); const path = require('path'); const dist = path.resolve(__dirname, '../../frontend/dist'); const jsFile = fs.readdirSync(path.join(dist, 'assets')).find((f) => f.endsWith('.js'));
  const html = '<!doctype html><html><body><div id="root"></div></body></html>'; const bundle = fs.readFileSync(path.join(dist, 'assets', jsFile), 'utf8');
  const dom = new JSDOM(html, { url: `${origin}/dashboard`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })); w.scrollTo = () => {};
    w.fetch = async (u, o = {}) => { const h = { ...(o.headers || {}), Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') }; const r = await fetch(new URL(u, origin), { ...o, headers: h, body: o.body && o.body.constructor && o.body.constructor.name === 'FormData' ? undefined : o.body }); for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); cookies[kv.slice(0, i)] = kv.slice(i + 1); } return r; };
    w.confirm = () => true; w.print = () => {}; } });
  const w = dom.window; w.eval(bundle); // log in through the same fetch so the browser holds the session
  await sleep(800); // initial /me -> login screen
  const loginForm = w.document.querySelector('form.login-card'); if (!loginForm) throw new Error('login screen did not render: ' + w.document.body.textContent.slice(0, 200));
  const setVal = (el, v) => { const d = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const inputs = loginForm.querySelectorAll('input'); setVal(inputs[0], 'admin'); setVal(inputs[1], '123456'); loginForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await sleep(1200);
  const bad = [];
  for (const r of routes) {
    errors.length = 0; w.history.pushState({}, '', r); w.dispatchEvent(new w.PopStateEvent('popstate')); await sleep(450);
    const body = w.document.body.textContent; const err = [...w.document.querySelectorAll('.alert-error')].map((e) => e.textContent).filter((x) => !/permission/.test(x));
    const stuck = /Loading…/.test(body) ; const blank = (w.document.querySelector('.content')?.textContent || '').trim().length < 5;
    if (err.length || stuck || blank || errors.length) bad.push(`${r}\n    ${[err.join(' | '), stuck && 'STUCK LOADING', blank && 'BLANK', errors.slice(0, 2).join(' | ')].filter(Boolean).join(' ; ')}`);
  }
  console.log(`visited ${routes.length} screens, ${bad.length} with problems`); bad.forEach((b) => console.log(' -', b));
  w.close(); await t.stop(); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
