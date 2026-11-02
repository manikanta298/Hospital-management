const test = require('node:test'); const assert = require('node:assert/strict'); const { boot } = require('./helper');
let t, api, db; const ok = (r, s = [200, 201]) => assert.ok([].concat(s).includes(r.status), `expected ${s} got ${r.status}: ${JSON.stringify(r.body).slice(0, 400)}`);
test.before(async () => { t = await boot(); api = t.api; db = t.db; });
test.after(async () => { await t.stop(); });

test('auth: wrong password, login, me', async () => {
  ok(await api.post('/login', { login: 'admin', password: 'nope' }), 401);
  assert.equal((await api.get('/patients')).status, 401);
  const r = await api.post('/login', { login: 'admin', password: '123456' }); ok(r); assert.equal(r.body.redirect, '/dashboard');
  const me = await api.get('/me'); assert.equal(me.body.role, 'Admin'); assert.ok(me.body.permissions.includes('patient_view'));
});
test('master data: departments, doctors, services, patient types', async () => {
  ok(await api.post('/departments', { name: 'Cardiology' }));
  ok(await api.post('/departments', { name: 'Cardiology' }), 422);
  const d = await api.post('/doctors', { name: 'Dr Hana', department: 'Cardiology', email: 'hana@x.com', login_username: 'dhana', login_password: 'secret123' }); ok(d);
  assert.ok(await db.one("SELECT 1 FROM users WHERE login='dhana' AND \"group\"='Doctor'"));
  ok(await api.post('/doctors', { name: 'Dr Dup', email: 'hana@x.com' }), 422);
  ok(await api.post('/services', { category: 'Consultation', c_price: 500, department: 'Cardiology', service_kind: 'consultation' }));
  ok(await api.post('/services', { category: 'X-Ray Chest', c_price: 800, service_kind: 'radiology' }));
  const pt = await api.post('/patient-types', { name: 'General', kind: 'general', active: true }); ok(pt);
  ok(await api.post('/patient-types', { name: 'Panel Co', kind: 'panel', company: 'Acme', active: true }));
  const list = await api.get('/services'); assert.equal(list.body.services.length, 2);
});
test('patients: create, validate, search, show', async () => {
  ok(await api.post('/patients', { name: '' }), 422);
  const p = await api.post('/patients', { name: 'Ali Khan', phone: '0300123456', sex: 'male', birthdate: '1990-05-01', cnic: '1234512345671', doctor: 'Dr Hana' }); ok(p);
  assert.equal(p.body.patient.patient_id, '000001'); assert.equal(p.body.patient.cnic, '12345-1234567-1');
  const p2 = await api.post('/patients', { name: 'Sara Ahmed', birthdate: '2000-01-01' }); assert.equal(p2.body.patient.patient_id, '000002');
  assert.equal((await api.get('/patients?q=ali')).body.data.length, 1);
  const sh = await api.get(`/patients/${p.body.patient.id}`); ok(sh); assert.equal(sh.body.outstanding, 0);
  assert.equal((await api.get('/search?search=sar')).body.patients.length, 1);
  ok(await api.get(`/patients/${p.body.patient.id}/card`));
});
test('appointments, slots, OPD queue, visit fee billing', async () => {
  const doc = (await db.one("SELECT * FROM doctor WHERE name='Dr Hana'")); const pat = await db.one("SELECT * FROM patient WHERE name='Ali Khan'");
  const day = new Date(Date.now() + 86400000); const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const a = await api.post('/appointments', { patient: pat.id, doctor: doc.id, date, start: '10:00', minutes: 15, status: 'scheduled' }); ok(a);
  ok(await api.post('/appointments', { patient: pat.id, doctor: doc.id, date, start: '10:05', status: 'scheduled' }), 422); // clash
  ok(await api.post(`/doctors/${doc.id}/slots`, { weekdays: [0, 1, 2, 3, 4, 5, 6], start_time: '09:00', end_time: '12:00', slot_minutes: 15 }));
  ok(await api.post('/appointments', { patient: pat.id, doctor: doc.id, date, start: '15:00', status: 'scheduled' }), 422); // outside hours
  const free = await api.get(`/opd/free-slots?doctor=${doc.id}&date=${date}`); ok(free); assert.ok(free.body.length > 0 && !free.body.some((s) => s.start === '10:00'));
  const svc = await db.one("SELECT * FROM payment_category WHERE category='Consultation'");
  ok(await api.post('/opd/visit-fees', { visit_type: 'first', shift: 'any', payment_category_id: svc.id, fee: 450 }));
  const w = await api.post('/opd/walk-in', { patient: pat.id, doctor: doc.id, visit_type: 'first', bill: true }); ok(w); assert.match(w.body.success, /Token 1 issued\. Visit fee billed on invoice #\d+ \(450\.00\)/);
  const q = await api.get(`/opd/queue?doctor=${doc.id}`); ok(q); assert.equal(q.body.counts.waiting, 1);
  ok(await api.post(`/opd/${w.body.visit.id}/call-in`)); ok(await api.post(`/opd/${w.body.visit.id}/done`));
});
test('consultation saves exam, raises lab + radiology orders, completes', async () => {
  const visit = await db.one("SELECT * FROM appointment WHERE token_no=1");
  ok(await api.post('/lab/catalogue', { category: 'CBC', reference_value: 'Hb 12-16' })); const cat = await db.one("SELECT * FROM lab_category WHERE category='CBC'");
  ok(await api.post('/radiology/catalogue', { name: 'Chest X-Ray', modality: 'xray', payment_category_id: (await db.one("SELECT id FROM payment_category WHERE category='X-Ray Chest'")).id }));
  const exam = await db.one("SELECT * FROM radiology_exam LIMIT 1");
  const v = await api.get(`/consultations/visit/${visit.id}`); ok(v); assert.equal(v.body.c.status, 'draft');
  const s = await api.post(`/consultations/visit/${visit.id}`, { presenting_complaint: 'Chest pain', diagnosis: 'Angina', exam: { cvs: { status: 'abnormal', note: 'murmur' }, gpe: { status: '' } }, past: { diabetes: 'yes' }, gynae: {}, lab_tests: [cat.id], radiology_exams: [exam.id], radiology_urgent: true, template_name: 'Chest', action: 'complete', b_p: '120/80' }); ok(s);
  assert.match(s.body.success, /completed.*Lab request #\d+ raised\. 1 radiology exam\(s\) ordered\. Template "Chest" saved/);
  const c = await db.one('SELECT * FROM consultation'); assert.equal(c.status, 'completed'); assert.equal(JSON.parse(c.examination).cvs.status, 'abnormal');
  const v2 = await api.get(`/consultations/visit/${visit.id}`); assert.equal(v2.body.templates.length, 1); assert.equal(v2.body.orders[0].tests[0].name, 'CBC');
  const lab = await db.one('SELECT * FROM lab'); ok(await api.post(`/lab/${lab.id}/results`, { results: { [(await db.one('SELECT id FROM lab_test')).id]: '13.5' } }));
  assert.equal((await db.one('SELECT status FROM lab')).status, 'reported');
  const ro = await db.one('SELECT * FROM radiology_order'); ok(await api.put(`/radiology/${ro.id}`, { action: 'report', impression: '' }), 422); ok(await api.put(`/radiology/${ro.id}`, { action: 'report', impression: 'Normal', findings: 'Clear' }));
  ok(await api.post(`/radiology/${ro.id}/bill`)); ok(await api.post(`/radiology/${ro.id}/bill`), 409);
});
test('prescriptions, medicines, pharmacy stock', async () => {
  const pat = await db.one("SELECT * FROM patient WHERE name='Ali Khan'"); const doc = await db.one('SELECT * FROM doctor');
  ok(await api.post('/medicines/categories', { category: 'Antibiotic' })); const mc = await db.one('SELECT * FROM medicine_category');
  ok(await api.post('/medicines', { name: 'Amoxil', category: mc.id, box: '500mg', price: 5, s_price: 8, quantity: 10 })); ok(await api.post('/medicines', { name: 'Amoxil', box: '500mg' }), 422);
  const med = await db.one('SELECT * FROM medicine');
  ok(await api.post('/prescriptions', { patient: pat.id, doctor: doc.id, date: '2026-01-01', items: [] }), 422);
  const rx = await api.post('/prescriptions', { patient: pat.id, doctor: doc.id, date: '2026-01-01', items: [{ medicine_id: med.id, dosage: '1 tab', duration: '5 days' }, { name: '' }] }); ok(rx);
  assert.equal((await db.one('SELECT medicine FROM prescription')).medicine, 'Amoxil 1 tab for 5 days');
  ok(await api.post('/pharmacy', { patient: pat.id, date: '2026-01-02', items: [{ medicine_id: med.id, quantity: 11 }] }), 422);
  const sale = await api.post('/pharmacy', { patient: pat.id, date: '2026-01-02', discount: 4, items: [{ medicine_id: med.id, quantity: 4 }] }); ok(sale); assert.equal(sale.body.sale.gross_total, '28.00');
  assert.equal((await db.one('SELECT quantity FROM medicine')).quantity, 6);
  ok(await api.del(`/pharmacy/${sale.body.sale.id}`)); assert.equal((await db.one('SELECT quantity FROM medicine')).quantity, 10);
  ok(await api.del(`/medicines/${med.id}`), 409);
});
test('beds and admissions', async () => {
  const pat = await db.one("SELECT * FROM patient WHERE name='Ali Khan'");
  ok(await api.post('/beds/categories', { category: 'General Ward' })); const bc = await db.one('SELECT * FROM bed_category');
  ok(await api.post('/beds', { category: bc.id, number: 'A1' })); ok(await api.post('/beds', { category: bc.id, number: 'A1' }), 422); const bed = await db.one('SELECT * FROM bed');
  const ad = await api.post('/admissions', { patient: pat.id, bed_id: bed.id }); ok(ad);
  ok(await api.post('/admissions', { patient: pat.id, bed_id: bed.id }), 422); ok(await api.del(`/beds/${bed.id}`), 409);
  const a = await db.one('SELECT * FROM alloted_bed'); ok(await api.post(`/admissions/${a.id}/discharge`, { d_time: '2000-01-01 00:00' }), 422); ok(await api.post(`/admissions/${a.id}/discharge`, {}));
  assert.equal((await db.one('SELECT status FROM bed')).status, 'free');
});
test('invoices, payments, doctor shares, cash close, day book, settlement', async () => {
  const pat = await db.one("SELECT * FROM patient WHERE name='Ali Khan'"); const doc = await db.one('SELECT * FROM doctor'); const svc = await db.one("SELECT * FROM payment_category WHERE category='Consultation'");
  const pol = await api.post('/doctor-share/policies', { name: 'Std 40', doctor_percent: 40 }); ok(pol);
  ok(await api.post(`/doctor-share/policies/${pol.body.policy.id}/assign`, { doctors: [doc.id] }));
  const inv = await api.post('/invoices', { patient: pat.id, doctor: doc.id, date: '2026-02-01', discount: 50, items: [{ payment_category_id: svc.id, quantity: 2 }, { name: 'Dressing', unit_price: 100 }] }); ok(inv);
  assert.equal(inv.body.invoice.gross_total, '1050.00');
  const shares = await db.q('SELECT * FROM doctor_share WHERE payment_id=$1', [inv.body.invoice.id]); assert.equal(shares.length, 2); assert.equal(shares.reduce((a, x) => a + parseFloat(x.amount), 0).toFixed(2), '420.00'); // 40% of each line net of its share of the 50 discount
  ok(await api.post(`/invoices/${inv.body.invoice.id}/pay`, { amount: 2000 }), 422);
  ok(await api.post(`/invoices/${inv.body.invoice.id}/pay`, { amount: 500, method: 'Cash' }));
  assert.equal((await db.one('SELECT status FROM payment WHERE id=$1', [inv.body.invoice.id])).status, 'part paid');
  ok(await api.post('/doctor-share/approve', { ids: shares.map((x) => x.id) }), 409);
  ok(await api.post(`/invoices/${inv.body.invoice.id}/pay`, { amount: 550, method: 'Card' })); ok(await api.del(`/invoices/${inv.body.invoice.id}`), 409);
  ok(await api.post('/doctor-share/approve', { ids: shares.map((x) => x.id) })); ok(await api.post('/doctor-share/pay', { ids: shares.map((x) => x.id), reference: 'P1' }));
  assert.equal((await db.one("SELECT COUNT(*)::int c FROM accounting WHERE name='Doctor share'")).c, 1);
  const cc = await api.get('/cash-close'); ok(cc); assert.equal(cc.body.totals.cash, 500); assert.equal(cc.body.totals.card, 550);
  const close = await api.post('/cash-close', { counted_cash: 480 }); ok(close); assert.equal(close.body.close.difference, '-20.00'); ok(await api.post('/cash-close', {}), 422);
  ok(await api.get(`/cash-close/${close.body.close.id}`));
  const book = await api.get('/day-book?from=2026-02-01&to=2026-02-28'); ok(book); assert.equal(book.body.lines.length, 2);
  const open = await api.post('/invoices', { patient: pat.id, date: '2026-03-01', items: [{ name: 'Misc', unit_price: 300 }] }); ok(open);
  const st = await api.get(`/settlement?patient=${pat.id}`); assert.ok(st.body.receivable >= 300);
  ok(await api.post(`/settlement/${pat.id}`, { amount: 100, method: 'Cash', write_off: 200, write_off_reason: 'Hardship' }));
  const rep = await api.get('/reports/debtors'); ok(rep); ok(await api.get('/reports/lab')); ok(await api.get('/reports/drug-usage')); ok(await api.get('/reports/occupancy'));
  ok(await api.get('/pricing')); ok(await api.post('/pricing/adjust', { type: (await db.one("SELECT id FROM patient_type WHERE name='General'")).id, percent: 10, setting: 'both' }));
  const exp = await api.get('/pricing/export'); ok(exp); assert.match(String(exp.body), /Consultation/);
});
test('accounting, staff, users, permissions, activity, dashboard', async () => {
  ok(await api.post('/accounting/sectors', { name: 'Donations', type: 'Income' }));
  ok(await api.post('/accounting/income', { entries: [{ name: 'Donations', amount: 1000, date: '05/02/2026', description: 'x' }, { name: 'Donations', amount: '', date: '' }] }));
  assert.equal((await db.one("SELECT date FROM accounting WHERE name='Donations'")).date, '2026-02-05');
  const rl = await api.get('/accounting/income-list?year=2026&month=February'); assert.equal(rl.body.entries.length, 1);
  ok(await api.get('/accounting/report/Income/2026-02-01/2026-02-28')); ok(await api.get('/accounting/report-summary/2026-02-01/2026-03-31'));
  const nu = await api.post('/staff/nurse', { name: 'Nina Nurse', login_username: 'nina', login_password: 'password1' }); ok(nu); assert.ok(await db.one("SELECT 1 FROM users WHERE login='nina' AND \"group\"='Nurse'"));
  ok(await api.get('/staff/bogus'), 404);
  const u = await api.post('/users', { firstname: 'A', lastname: 'B', email: 'a@b.com', group: 'Receptionist', desc: 'x', login: 'recep', password: 'pw12345' }); ok(u);
  const pm = await api.get('/permission'); assert.equal(pm.body.permissions.length, 96 * 7);
  ok(await api.post('/permission', { admin: Object.fromEntries(pm.body.permission_fields.map((f) => [f.toLowerCase().replace(/ /g, '_'), true])), receptionist: { patient_view: true } }));
  // receptionist: allowed patient_view, denied patient_add
  const r2 = await api.post('/impersonate/' + u.body.user.id); ok(r2); assert.equal((await api.get('/me')).body.role, 'Receptionist');
  ok(await api.get('/patients')); const denied = await api.post('/patients', { name: 'No' }); ok(denied, 403); assert.equal(denied.body.permission, 'patient_add');
  ok(await api.get('/users'), 200); ok(await api.get('/activity'), 403);
  ok(await api.post('/logout')); assert.equal((await api.get('/me')).body.role, 'Admin');
  const dash = await api.get('/dashboard'); ok(dash); assert.equal(dash.body.totalPatients, 2); assert.ok(dash.body.income > 0);
  const act = await api.get('/activity'); ok(act); assert.ok(act.body.meta.total > 5);
  ok(await api.put(`/hospital-branches/0`, {}), 404); const br = await api.post('/hospital-branches', { name: 'Main' }); ok(br);
  ok(await api.post('/barcode', { code: '1234567890' })); ok(await api.post('/settings', { firstname: 'H', lastname: 'A', login: 'admin', desc: 'x', cpassword: 'a', npassword: 'newpass1', cnpassword: 'newpass1' }));
  ok(await api.post('/logout')); assert.equal((await api.post('/login', { login: 'admin', password: 'newpass1' })).status, 200);
});
