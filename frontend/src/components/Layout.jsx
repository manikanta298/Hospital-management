import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';

// [label, path, permission | null]   (permission names are the same ones the Laravel sidebar checked)
const MENU = [
  ['', [['Dashboard', '/dashboard', null]]],
  ['Front desk', [['Patients', '/patients', 'patient_view'], ['Appointments', '/appointments', 'appointment_view'], ['OPD queue', '/opd/queue', 'appointment_view'], ['OPD history', '/opd/history', 'appointment_view'], ['Consultations', '/consultations', 'consultation_view'], ['Medical history', '/history', 'patient_medical_history']]],
  ['Clinical', [['Prescriptions', '/prescriptions', 'prescription_view'], ['Laboratory', '/lab', 'lab_test_view'], ['Lab catalogue', '/lab/catalogue', 'lab_test_view'], ['Radiology', '/radiology', 'diagnostic_report_view'], ['Radiology catalogue', '/radiology/catalogue', 'diagnostic_report_view'], ['Admissions', '/admissions', 'admission_view'], ['Beds', '/beds', 'bed_view'], ['Ward types', '/beds/categories', 'ward_view']]],
  ['Pharmacy', [['Pharmacy sales', '/pharmacy', 'pharmacy_stock_view'], ['Medicines', '/medicines', 'medicine_view'], ['Medicine categories', '/medicines/categories', 'medicine_view']]],
  ['Billing', [['Invoices', '/invoices', 'invoice_view'], ['Settlement', '/settlement', 'payment_add'], ['Cash close', '/cash-close', 'cash_close'], ['Day book', '/day-book', 'view_payment_reports'], ['Doctor share', '/doctor-share', 'doctor_share_view'], ['Share policies', '/doctor-share/policies', 'doctor_share_view'], ['Services', '/services', 'service_view'], ['Pricing', '/pricing', 'service_view'], ['Patient types', '/patient-types', 'service_view'], ['Visit fees', '/opd/visit-fees', 'service_view'], ['Payment gateways', '/gateways', 'payment_view']]],
  ['Accounting', [['Income', '/accounting/income', 'accounting'], ['Expense', '/accounting/expence', 'accounting'], ['Sectors', '/accounting/sectors', 'accounting'], ['Report', '/accounting/report', 'view_payment_reports'], ['Summary report', '/accounting/reportsum', 'view_payment_reports'], ['Settings', '/accounting', 'accounting']]],
  ['People', [['Doctors', '/doctors', 'doctor_view'], ['Nurses', '/staff/nurse', 'nurse_view'], ['Pharmacists', '/staff/pharmacist', 'staff_view'], ['Laboratory staff', '/staff/laboratorist', 'staff_view'], ['Receptionists', '/staff/receptionist', 'staff_view'], ['Accountants', '/staff/accountant', 'staff_view'], ['Departments', '/departments', 'department_view']]],
  ['Reports', [['Debtors', '/reports/debtors', 'view_payment_reports'], ['Pending lab', '/reports/lab', 'lab_test_view'], ['Drug usage', '/reports/drug-usage', 'view_pharmacy_reports'], ['Bed occupancy', '/reports/occupancy', 'bed_view']]],
  ['Messaging', [['Send message', '/message', 'send_sms/voice'], ['Message templates', '/template', 'send_sms/voice'], ['SMS formats', '/sms', 'send_sms/voice'], ['SMS log', '/smslog', 'view_sms/voice_log_reports'], ['Notifications', '/notification-type', 'send_notification'], ['ICTCore (SMS)', '/ictcore?type=sms', 'send_notification'], ['ICTCore (voice)', '/ictcore?type=voice', 'send_notification'], ['Payment reminder text', '/ictcore/fees', 'send_notification'], ['Appointment reminder text', '/ictcore/attendance', 'send_notification']]],
  ['Administration', [['Users', '/users', '@admin'], ['Permissions', '/permission', '@admin'], ['Hospital information', '/institute', 'hospital_information_add'], ['Branches', '/hospital-branches', 'branch_view'], ['Activity log', '/activity', '@admin'], ['Barcodes', '/barcode', null], ['Notification schedule', '/schedule', null], ['My settings', '/settings', null]]],
];

export default function Layout() {
  const app = useApp(); const nav = useNavigate(); const { me, flash } = app; const [q, setQ] = useState('');
  const visible = (p) => !p || (p === '@admin' ? me.role === 'Admin' : app.can(p));
  const logout = async () => { const r = await api.post('/logout'); await app.refresh(); nav(r.redirect === '/dashboard' ? '/dashboard' : '/'); };
  const switchBranch = async (e) => { await api.post('/branch-switch', { branch_id: e.target.value }); await app.refresh(); window.location.reload(); };
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">🏥 {me.inName || 'ICTHospital'}</div>
        {MENU.map(([group, items]) => { const shown = items.filter(([, , p]) => visible(p)); if (!shown.length) return null; return <div key={group}>{group && <div className="grp">{group}</div>}{shown.map(([label, to]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')} end={to === '/dashboard'}>{label}</NavLink>)}</div>; })}
      </aside>
      <div className="main">
        <div className="top no-print">
          <form className="search" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) nav(`/search?search=${encodeURIComponent(q.trim())}`); }}><input type="search" placeholder="Search patients and doctors…" value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <div className="grow" />
          {me.branch?.canSwitch && me.branch.list.length > 0 && <select style={{ width: 'auto' }} value={me.branch.current || ''} onChange={switchBranch}><option value="">All branches</option>{me.branch.list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
          {me.branch && !me.branch.canSwitch && me.branch.name && <span className="muted">📍 {me.branch.name}</span>}
          <span>{me.name} <span className="muted">({me.role})</span></span>
          {me.impersonating && <span className="muted">· viewing as another user</span>}
          <button className="btn btn-sm" onClick={logout}>{me.impersonating ? 'Back to admin' : 'Log out'}</button>
        </div>
        <div className="content">
          {flash && <div className={`alert alert-${flash.type === 'success' ? 'success' : 'error'} toast`} onClick={app.clearFlash}>{flash.text}</div>}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
