import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';

import account_balance from '@material-design-icons/svg/filled/account_balance.svg?url';
import account_balance_wallet from '@material-design-icons/svg/filled/account_balance_wallet.svg?url';
import account_tree from '@material-design-icons/svg/filled/account_tree.svg?url';
import admin_panel_settings from '@material-design-icons/svg/filled/admin_panel_settings.svg?url';
import airline_seat_flat from '@material-design-icons/svg/filled/airline_seat_flat.svg?url';
import analytics from '@material-design-icons/svg/filled/analytics.svg?url';
import apartment from '@material-design-icons/svg/filled/apartment.svg?url';
import assessment from '@material-design-icons/svg/filled/assessment.svg?url';
import badge from '@material-design-icons/svg/filled/badge.svg?url';
import bedroom_parent from '@material-design-icons/svg/filled/bedroom_parent.svg?url';
import biotech from '@material-design-icons/svg/filled/biotech.svg?url';
import calculate from '@material-design-icons/svg/filled/calculate.svg?url';
import calendar_month from '@material-design-icons/svg/filled/calendar_month.svg?url';
import category from '@material-design-icons/svg/filled/category.svg?url';
import chat from '@material-design-icons/svg/filled/chat.svg?url';
import corporate_fare from '@material-design-icons/svg/filled/corporate_fare.svg?url';
import credit_card from '@material-design-icons/svg/filled/credit_card.svg?url';
import dashboard from '@material-design-icons/svg/filled/dashboard.svg?url';
import description from '@material-design-icons/svg/filled/description.svg?url';
import desk from '@material-design-icons/svg/filled/desk.svg?url';
import engineering from '@material-design-icons/svg/filled/engineering.svg?url';
import event from '@material-design-icons/svg/filled/event.svg?url';
import event_available from '@material-design-icons/svg/filled/event_available.svg?url';
import fact_check from '@material-design-icons/svg/filled/fact_check.svg?url';
import format_list_numbered from '@material-design-icons/svg/filled/format_list_numbered.svg?url';
import forum from '@material-design-icons/svg/filled/forum.svg?url';
import groups from '@material-design-icons/svg/filled/groups.svg?url';
import healing from '@material-design-icons/svg/filled/healing.svg?url';
import health_and_safety from '@material-design-icons/svg/filled/health_and_safety.svg?url';
import history from '@material-design-icons/svg/filled/history.svg?url';
import hotel from '@material-design-icons/svg/filled/hotel.svg?url';
import hourglass_top from '@material-design-icons/svg/filled/hourglass_top.svg?url';
import local_hospital from '@material-design-icons/svg/filled/local_hospital.svg?url';
import local_pharmacy from '@material-design-icons/svg/filled/local_pharmacy.svg?url';
import lock from '@material-design-icons/svg/filled/lock.svg?url';
import manage_accounts from '@material-design-icons/svg/filled/manage_accounts.svg?url';
import medical_information from '@material-design-icons/svg/filled/medical_information.svg?url';
import medical_services from '@material-design-icons/svg/filled/medical_services.svg?url';
import medication from '@material-design-icons/svg/filled/medication.svg?url';
import medication_liquid from '@material-design-icons/svg/filled/medication_liquid.svg?url';
import menu_book from '@material-design-icons/svg/filled/menu_book.svg?url';
import miscellaneous_services from '@material-design-icons/svg/filled/miscellaneous_services.svg?url';
import monitor_heart from '@material-design-icons/svg/filled/monitor_heart.svg?url';
import notifications from '@material-design-icons/svg/filled/notifications.svg?url';
import payments from '@material-design-icons/svg/filled/payments.svg?url';
import people from '@material-design-icons/svg/filled/people.svg?url';
import person_search from '@material-design-icons/svg/filled/person_search.svg?url';
import pie_chart from '@material-design-icons/svg/filled/pie_chart.svg?url';
import point_of_sale from '@material-design-icons/svg/filled/point_of_sale.svg?url';
import price_change from '@material-design-icons/svg/filled/price_change.svg?url';
import price_check from '@material-design-icons/svg/filled/price_check.svg?url';
import qr_code from '@material-design-icons/svg/filled/qr_code.svg?url';
import receipt from '@material-design-icons/svg/filled/receipt.svg?url';
import receipt_long from '@material-design-icons/svg/filled/receipt_long.svg?url';
import record_voice_over from '@material-design-icons/svg/filled/record_voice_over.svg?url';
import request_quote from '@material-design-icons/svg/filled/request_quote.svg?url';
import rule from '@material-design-icons/svg/filled/rule.svg?url';
import science from '@material-design-icons/svg/filled/science.svg?url';
import send from '@material-design-icons/svg/filled/send.svg?url';
import settings from '@material-design-icons/svg/filled/settings.svg?url';
import settings_suggest from '@material-design-icons/svg/filled/settings_suggest.svg?url';
import sms from '@material-design-icons/svg/filled/sms.svg?url';
import sms_failed from '@material-design-icons/svg/filled/sms_failed.svg?url';
import summarize from '@material-design-icons/svg/filled/summarize.svg?url';
import support_agent from '@material-design-icons/svg/filled/support_agent.svg?url';
import text_snippet from '@material-design-icons/svg/filled/text_snippet.svg?url';
import timeline from '@material-design-icons/svg/filled/timeline.svg?url';
import trending_down from '@material-design-icons/svg/filled/trending_down.svg?url';
import trending_up from '@material-design-icons/svg/filled/trending_up.svg?url';
import tune from '@material-design-icons/svg/filled/tune.svg?url';

// Each group contains links with a label, route, permission, and Material icon.
const MENU = [
  ['', null, [['Dashboard', '/dashboard', null, dashboard]]],
  ['Front desk', desk, [['Patients', '/patients', 'patient_view', groups], ['Appointments', '/appointments', 'appointment_view', event], ['OPD queue', '/opd/queue', 'appointment_view', format_list_numbered], ['OPD history', '/opd/history', 'appointment_view', history], ['Consultations', '/consultations', 'consultation_view', medical_services], ['Medical history', '/history', 'patient_medical_history', medical_information]]],
  ['Clinical', healing, [['Prescriptions', '/prescriptions', 'prescription_view', description], ['Laboratory', '/lab', 'lab_test_view', science], ['Lab catalogue', '/lab/catalogue', 'lab_test_view', biotech], ['Radiology', '/radiology', 'diagnostic_report_view', monitor_heart], ['Radiology catalogue', '/radiology/catalogue', 'diagnostic_report_view', fact_check], ['Admissions', '/admissions', 'admission_view', local_hospital], ['Beds', '/beds', 'bed_view', hotel], ['Ward types', '/beds/categories', 'ward_view', bedroom_parent]]],
  ['Pharmacy', local_pharmacy, [['Pharmacy sales', '/pharmacy', 'pharmacy_stock_view', point_of_sale], ['Medicines', '/medicines', 'medicine_view', medication], ['Medicine categories', '/medicines/categories', 'medicine_view', category]]],
  ['Billing', receipt, [['Invoices', '/invoices', 'invoice_view', receipt_long], ['Settlement', '/settlement', 'payment_add', payments], ['Cash close', '/cash-close', 'cash_close', lock], ['Day book', '/day-book', 'view_payment_reports', menu_book], ['Doctor share', '/doctor-share', 'doctor_share_view', pie_chart], ['Share policies', '/doctor-share/policies', 'doctor_share_view', rule], ['Services', '/services', 'service_view', miscellaneous_services], ['Pricing', '/pricing', 'service_view', price_change], ['Patient types', '/patient-types', 'service_view', badge], ['Visit fees', '/opd/visit-fees', 'service_view', price_check], ['Payment gateways', '/gateways', 'payment_view', credit_card]]],
  ['Accounting', account_balance_wallet, [['Income', '/accounting/income', 'accounting', trending_up], ['Expense', '/accounting/expence', 'accounting', trending_down], ['Sectors', '/accounting/sectors', 'accounting', account_tree], ['Report', '/accounting/report', 'view_payment_reports', assessment], ['Summary report', '/accounting/reportsum', 'view_payment_reports', summarize], ['Settings', '/accounting', 'accounting', settings]]],
  ['People', people, [['Doctors', '/doctors', 'doctor_view', person_search], ['Nurses', '/staff/nurse', 'nurse_view', health_and_safety], ['Pharmacists', '/staff/pharmacist', 'staff_view', local_pharmacy], ['Laboratory staff', '/staff/laboratorist', 'staff_view', engineering], ['Receptionists', '/staff/receptionist', 'staff_view', support_agent], ['Accountants', '/staff/accountant', 'staff_view', calculate], ['Departments', '/departments', 'department_view', corporate_fare]]],
  ['Reports', analytics, [['Debtors', '/reports/debtors', 'view_payment_reports', account_balance], ['Pending lab', '/reports/lab', 'lab_test_view', hourglass_top], ['Drug usage', '/reports/drug-usage', 'view_pharmacy_reports', medication_liquid], ['Bed occupancy', '/reports/occupancy', 'bed_view', airline_seat_flat]]],
  ['Messaging', chat, [['Send message', '/message', 'send_sms/voice', send], ['Message templates', '/template', 'send_sms/voice', text_snippet], ['SMS formats', '/sms', 'send_sms/voice', sms], ['SMS log', '/smslog', 'view_sms/voice_log_reports', forum], ['Notifications', '/notification-type', 'send_notification', notifications], ['ICTCore (SMS)', '/ictcore?type=sms', 'send_notification', sms_failed], ['ICTCore (voice)', '/ictcore?type=voice', 'send_notification', record_voice_over], ['Payment reminder text', '/ictcore/fees', 'send_notification', request_quote], ['Appointment reminder text', '/ictcore/attendance', 'send_notification', event_available]]],
  ['Administration', settings_suggest, [['Users', '/users', '@admin', manage_accounts], ['Permissions', '/permission', '@admin', admin_panel_settings], ['Hospital information', '/institute', 'hospital_information_add', apartment], ['Branches', '/hospital-branches', 'branch_view', account_tree], ['Activity log', '/activity', '@admin', timeline], ['Barcodes', '/barcode', null, qr_code], ['Notification schedule', '/schedule', null, calendar_month], ['My settings', '/settings', null, tune]]],
];

function MaterialIcon({ source }) {
  return <span className="material-menu-icon" style={{ maskImage: `url("${source}")` }} aria-hidden="true" />;
}

export default function Layout() {
  const app = useApp(); const nav = useNavigate(); const { me, flash } = app; const [q, setQ] = useState('');
  const visible = (p) => !p || (p === '@admin' ? me.role === 'Admin' : app.can(p));
  const logout = async () => { const r = await api.post('/logout'); await app.refresh(); nav(r.redirect === '/dashboard' ? '/dashboard' : '/'); };
  const switchBranch = async (e) => { await api.post('/branch-switch', { branch_id: e.target.value }); await app.refresh(); window.location.reload(); };
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand" title={me.inName || 'ICTHospital'}>
          <MaterialIcon source={local_hospital} />
          <span className="icon-label-text">{me.inName || 'ICTHospital'}</span>
        </div>
        <nav aria-label="Hospital navigation">
          {MENU.map(([group, groupIcon, items]) => {
            const shown = items.filter(([, , permission]) => visible(permission));
            if (!shown.length) return null;
            return (
              <div className="side-group" key={group} role={group ? 'group' : undefined} aria-label={group || undefined}>
                {groupIcon && <div className="grp" title={group}><MaterialIcon source={groupIcon} /></div>}
                <div className="side-links">
                  {shown.map(([label, to, , icon]) => (
                    <NavLink key={to} to={to} title={label} aria-label={label}
                      className={({ isActive }) => (isActive ? 'active' : '')} end={to === '/dashboard'}>
                      <MaterialIcon source={icon} />
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
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
