import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './context.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { Login, NoPermission, NotFound } from './pages/Auth.jsx';
import * as A from './pages/Admin.jsx';
import * as P from './pages/Patients.jsx';
import * as H from './pages/People.jsx';
import * as AP from './pages/Appointments.jsx';
import * as C from './pages/Consultation.jsx';
import * as CL from './pages/Clinical.jsx';
import * as D from './pages/Diagnostics.jsx';
import * as B from './pages/Billing.jsx';
import * as R from './pages/Reports.jsx';
import * as AC from './pages/Accounting.jsx';
import * as M from './pages/Messaging.jsx';

export default function App() {
  const { me } = useApp(); const loc = useLocation();
  if (me === undefined) return <Loading />;
  if (!me) return <Routes><Route path="*" element={<Login />} /></Routes>;
  if (loc.pathname === '/' || loc.pathname === '/login') return <Navigate to="/dashboard" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<A.Dashboard />} /><Route path="/search" element={<A.SearchPage />} /><Route path="/settings" element={<A.MySettings />} /><Route path="/schedule" element={<A.Schedule />} /><Route path="/institute" element={<A.Institute />} />
        <Route path="/users" element={<A.Users />} /><Route path="/permission" element={<A.Permissions />} /><Route path="/activity" element={<A.ActivityLog />} /><Route path="/activity/cleared" element={<A.ActivityLog cleared />} /><Route path="/activity/log/:id" element={<A.ActivityEntry />} />
        <Route path="/hospital-branches" element={<A.HospitalBranches />} /><Route path="/barcode" element={<A.BarcodePage />} /><Route path="/no-permission" element={<NoPermission />} />
        <Route path="/patients" element={<P.PatientList />} /><Route path="/patients/new" element={<P.PatientForm />} /><Route path="/patients/:id" element={<P.PatientShow />} /><Route path="/patients/:id/edit" element={<P.PatientForm />} /><Route path="/patients/:id/card" element={<P.PatientCard />} /><Route path="/patients/:id/wristband" element={<P.PatientCard wristband />} />
        <Route path="/history" element={<P.HistoryList />} /><Route path="/history/new" element={<P.HistoryForm />} /><Route path="/history/:id/edit" element={<P.HistoryForm />} />
        <Route path="/doctors" element={<H.DoctorList />} /><Route path="/doctors/new" element={<H.DoctorForm />} /><Route path="/doctors/:id" element={<H.DoctorShow />} /><Route path="/doctors/:id/edit" element={<H.DoctorForm />} /><Route path="/doctors/:id/slots" element={<AP.DoctorSlots />} />
        <Route path="/staff/:type" element={<H.StaffList />} /><Route path="/staff/:type/new" element={<H.StaffForm />} /><Route path="/staff/:type/:id/edit" element={<H.StaffForm />} /><Route path="/departments" element={<H.Departments />} />
        <Route path="/appointments" element={<AP.AppointmentList />} /><Route path="/appointments/new" element={<AP.AppointmentForm />} /><Route path="/appointments/:id" element={<AP.AppointmentShow />} /><Route path="/appointments/:id/edit" element={<AP.AppointmentForm />} />
        <Route path="/opd/queue" element={<AP.OpdQueue />} /><Route path="/opd/history" element={<AP.OpdHistory />} /><Route path="/opd/visit-fees" element={<AP.VisitFees />} /><Route path="/opd/:id/token" element={<AP.TokenPrint />} />
        <Route path="/consultations" element={<C.ConsultationList />} /><Route path="/consultations/visit/:id" element={<C.ConsultationVisit />} /><Route path="/consultations/:id/print" element={<C.ConsultationPrint />} />
        <Route path="/prescriptions" element={<CL.PrescriptionList />} /><Route path="/prescriptions/new" element={<CL.PrescriptionForm />} /><Route path="/prescriptions/:id" element={<CL.PrescriptionShow />} /><Route path="/prescriptions/:id/edit" element={<CL.PrescriptionForm />} />
        <Route path="/medicines" element={<CL.MedicineList />} /><Route path="/medicines/new" element={<CL.MedicineForm />} /><Route path="/medicines/categories" element={<CL.MedicineCategories />} /><Route path="/medicines/:id/edit" element={<CL.MedicineForm />} />
        <Route path="/pharmacy" element={<CL.PharmacyList />} /><Route path="/pharmacy/new" element={<CL.PharmacyNew />} /><Route path="/pharmacy/:id" element={<CL.PharmacyShow />} />
        <Route path="/beds" element={<CL.BedList />} /><Route path="/beds/new" element={<CL.BedForm />} /><Route path="/beds/categories" element={<CL.WardTypes />} /><Route path="/beds/:id/edit" element={<CL.BedForm />} />
        <Route path="/admissions" element={<CL.AdmissionList />} /><Route path="/admissions/new" element={<CL.AdmissionNew />} /><Route path="/admissions/:id" element={<CL.AdmissionShow />} />
        <Route path="/lab" element={<D.LabList />} /><Route path="/lab/new" element={<D.LabNew />} /><Route path="/lab/catalogue" element={<D.LabCatalogue />} /><Route path="/lab/:id" element={<D.LabShow />} />
        <Route path="/radiology" element={<D.RadiologyList />} /><Route path="/radiology/new" element={<D.RadiologyNew />} /><Route path="/radiology/catalogue" element={<D.RadiologyCatalogue />} /><Route path="/radiology/:id" element={<D.RadiologyShow />} /><Route path="/radiology/:id/print" element={<D.RadiologyPrint />} />
        <Route path="/services" element={<B.Services />} /><Route path="/services/:id/package" element={<B.ServicePackage />} /><Route path="/pricing" element={<B.Pricing />} /><Route path="/patient-types" element={<B.PatientTypes />} /><Route path="/gateways" element={<B.Gateways />} />
        <Route path="/invoices" element={<B.InvoiceList />} /><Route path="/invoices/new" element={<B.InvoiceNew />} /><Route path="/invoices/:id" element={<B.InvoiceShow />} />
        <Route path="/cash-close" element={<B.CashClose />} /><Route path="/cash-close/:id" element={<B.CashCloseShow />} /><Route path="/day-book" element={<B.DayBook />} /><Route path="/settlement" element={<B.Settlement />} />
        <Route path="/doctor-share" element={<B.DoctorShare />} /><Route path="/doctor-share/policies" element={<B.SharePolicies />} />
        <Route path="/reports/debtors" element={<R.DebtorsReport />} /><Route path="/reports/lab" element={<R.PendingLabReport />} /><Route path="/reports/drug-usage" element={<R.DrugUsageReport />} /><Route path="/reports/occupancy" element={<R.OccupancyReport />} />
        <Route path="/accounting" element={<AC.AccountingSettings />} /><Route path="/accounting/sectors" element={<AC.AccountingSectors />} /><Route path="/accounting/income" element={<AC.EntryPage kind="Income" />} /><Route path="/accounting/expence" element={<AC.EntryPage kind="Expence" />} />
        <Route path="/accounting/report" element={<AC.AccountingReportForm />} /><Route path="/accounting/report/:rtype/:from/:to" element={<AC.AccountingReport />} /><Route path="/accounting/reportsum" element={<AC.AccountingReportForm summary />} /><Route path="/accounting/reportsum/:from/:to" element={<AC.AccountingSummary />} />
        <Route path="/sms" element={<M.SmsFormats />} /><Route path="/smslog" element={<M.SmsLog />} /><Route path="/template" element={<M.Templates />} /><Route path="/ictcore" element={<M.IctCore />} /><Route path="/notification-type" element={<M.NotificationType />} /><Route path="/message" element={<M.SendMessage />} /><Route path="/ictcore/fees" element={<M.ReminderMessage kind="fees" />} /><Route path="/ictcore/attendance" element={<M.ReminderMessage kind="attendance" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
