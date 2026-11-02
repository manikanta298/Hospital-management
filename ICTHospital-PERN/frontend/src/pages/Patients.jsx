import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, fileUrl, toForm } from '../api.js';
import { useAction, useForm, useLoad } from '../hooks.js';
import { useApp } from '../context.jsx';
import { Barcode, Btn, Card, ConfirmBtn, Field, Fields, FormActions, Filters, KV, Letterhead, LinkBtn, Load, Page, Pager, PrintButton, StatusBadge, Table, Tabs } from '../components/ui.jsx';
import { fmtDate, fmtDateTime, money } from '../util.js';

export function PatientList() {
  const app = useApp(); const [sp, setSp] = useSearchParams(); const [q, setQ] = useState(sp.get('q') || ''); const st = useLoad('/patients', Object.fromEntries(sp.entries()), [sp.toString()]); const { run } = useAction();
  return <Page title="Patients" actions={app.can('patient_add') && <LinkBtn kind="primary" to="/patients/new">+ Register patient</LinkBtn>}>
    <Filters onSubmit={() => setSp(q ? { q } : {})}><Field label="Search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MRN, CNIC, phone…" /></Field><Btn kind="primary" type="submit">Search</Btn></Filters>
    <Load state={st}>{(d) => <Card><Table rows={d.data} columns={[
      { label: 'MRN', key: 'patient_id' }, { label: 'Name', render: (r) => <Link to={`/patients/${r.id}`}>{r.name}</Link> }, { label: 'Sex', key: 'sex' }, { label: 'Age', key: 'age' }, { label: 'Phone', key: 'phone' }, { label: 'CNIC', key: 'cnic' }, { label: 'Registered', render: (r) => fmtDate(r.add_date) },
      { label: '', className: 'right nowrap', render: (r) => <>{app.can('patient_update') && <Link className="btn btn-sm" to={`/patients/${r.id}/edit`}>Edit</Link>} {app.can('patient_delete') && <ConfirmBtn message={`Delete ${r.name}?`} onConfirm={async () => { if (await run(() => api.del(`/patients/${r.id}`))) st.reload(); }}>Delete</ConfirmBtn>}</> }]} />
      <Pager meta={d.meta} onPage={(p) => setSp({ ...Object.fromEntries(sp.entries()), page: p })} /></Card>}</Load></Page>;
}

export function PatientForm() {
  const { id } = useParams(); const nav = useNavigate(); const edit = !!id; const st = useLoad(edit ? `/patients/${id}/edit` : '/patients/form-data'); const { run, busy, errors } = useAction();
  const form = useForm({ name: '', father_name: '', sex: '', birthdate: '', phone: '', alt_phone: '', email: '', address: '', city: '', cnic: '', bloodgroup: '', doctor: '', patient_type_id: '', guardian_relation: '', guardian_mrn: '', old_mrn: '', employee_no: '', mlc: false, photo: null });
  useEffect(() => { if (edit && st.data) form.setValues({ ...st.data.patient, birthdate: fmtDate(st.data.patient.birthdate), mlc: !!st.data.patient.mlc, photo: null }); }, [st.data]); // eslint-disable-line
  return <Page title={edit ? 'Edit patient' : 'Register patient'}><Load state={st}>{(d) => {
    const fields = [
      { name: 'name', label: 'Full name', required: true }, { name: 'father_name', label: "Father's / husband's name" }, { name: 'sex', label: 'Sex', type: 'select', options: ['male', 'female', 'other'] }, { name: 'birthdate', label: 'Date of birth', type: 'date' },
      { name: 'cnic', label: 'CNIC', placeholder: '12345-1234567-1' }, { name: 'bloodgroup', label: 'Blood group', type: 'select', options: d.bloodGroups }, { name: 'phone', label: 'Phone' }, { name: 'alt_phone', label: 'Alternate phone' },
      { name: 'email', label: 'Email', type: 'email' }, { name: 'city', label: 'City' }, { name: 'address', label: 'Address', span: 2 }, { name: 'doctor', label: 'Preferred doctor', type: 'select', options: d.doctors },
      { name: 'patient_type_id', label: 'Patient type', type: 'select', options: (d.patientTypes || []).map((t) => [t.id, `${t.name}${t.company ? ` (${t.company})` : ''}`]) }, { name: 'guardian_relation', label: 'Guardian relation' }, { name: 'guardian_mrn', label: 'Guardian MRN' },
      { name: 'old_mrn', label: 'Old MRN' }, { name: 'employee_no', label: 'Employee no.' }, { name: 'photo', label: 'Photo', type: 'file', accept: 'image/*' }, { name: 'mlc', label: 'Medico-legal case (MLC)', type: 'checkbox' }];
    return <Card><form onSubmit={async (e) => { e.preventDefault(); const body = toForm(form.values); const r = await run(() => (edit ? api.put(`/patients/${id}`, body) : api.post('/patients', body))); if (r) nav(`/patients/${r.patient.id}`); }}>
      <Fields fields={fields} form={form} errors={errors} cols={3} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>{edit ? 'Save changes' : 'Register'}</Btn><LinkBtn to="/patients">Cancel</LinkBtn></FormActions></form></Card>;
  }}</Load></Page>;
}

export function PatientShow() {
  const { id } = useParams(); const app = useApp(); const st = useLoad(`/patients/${id}`); const [tab, setTab] = useState('overview');
  return <Load state={st}>{(d) => { const p = d.patient; return (
    <Page title={`${p.name} · ${p.patient_id}`} actions={<>{app.can('appointment_add') && <LinkBtn to={`/appointments/new?patient=${p.id}`}>Book appointment</LinkBtn>}{app.can('payment_add') && <LinkBtn to={`/invoices/new?patient=${p.id}`}>New invoice</LinkBtn>}{app.can('admission_add') && <LinkBtn to={`/admissions/new?patient=${p.id}`}>Admit</LinkBtn>}<LinkBtn to={`/patients/${p.id}/card`}>Card</LinkBtn><LinkBtn to={`/patients/${p.id}/wristband`}>Wristband</LinkBtn>{app.can('patient_update') && <LinkBtn to={`/patients/${p.id}/edit`}>Edit</LinkBtn>}</>}>
      <div className="stats"><div className="stat"><div className="stat-v">{money(d.billed)}</div><div className="stat-l">Billed</div></div><div className="stat"><div className="stat-v">{money(d.paid)}</div><div className="stat-l">Paid</div></div><div className={`stat ${d.outstanding > 0 ? 'stat-red' : ''}`}><div className="stat-v">{money(d.outstanding)}</div><div className="stat-l">Outstanding</div></div></div>
      <Tabs active={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['appointments', `Appointments (${d.appointments.length})`], ['rx', `Prescriptions (${d.prescriptions.length})`], ['labs', `Lab (${d.labs.length})`], ['admissions', `Admissions (${d.admissions.length})`], ['history', `History (${d.history.length})`], ['invoices', `Invoices (${d.invoices.length})`]]} />
      {tab === 'overview' && <Card><KV rows={[['MRN', p.patient_id], ['Father / husband', p.father_name], ['Sex', p.sex], ['Date of birth', fmtDate(p.birthdate)], ['Age', p.age], ['Blood group', p.bloodgroup], ['Phone', p.phone], ['Alt. phone', p.alt_phone], ['Email', p.email], ['CNIC', p.cnic], ['Address', [p.address, p.city].filter(Boolean).join(', ')], ['Preferred doctor', p.doctor], ['Old MRN', p.old_mrn], ['Employee no.', p.employee_no], ['Guardian', [p.guardian_relation, p.guardian_mrn].filter(Boolean).join(' · ')], ['MLC', p.mlc ? 'Yes' : 'No'], ['Registered', fmtDate(p.add_date)]]} />{p.img_url && <img alt="" src={fileUrl(p.img_url)} style={{ maxWidth: 140, marginTop: 14, borderRadius: 8 }} />}</Card>}
      {tab === 'appointments' && <Card><Table rows={d.appointments} columns={[{ label: 'Date', key: 'date' }, { label: 'Slot', key: 'time_slot' }, { label: 'Doctor', render: (r) => d.doctorNames[r.doctor] }, { label: 'Status', render: (r) => <StatusBadge value={r.status} /> }, { label: '', render: (r) => <Link to={`/appointments/${r.id}`}>View</Link> }]} /></Card>}
      {tab === 'rx' && <Card><Table rows={d.prescriptions} columns={[{ label: 'Date', key: 'date' }, { label: 'Doctor', render: (r) => d.doctorNames[r.doctor] }, { label: 'Medicines', render: (r) => r.items.map((i) => i.name).join(', ') }, { label: '', render: (r) => <Link to={`/prescriptions/${r.id}`}>View</Link> }]} /></Card>}
      {tab === 'labs' && <Card><Table rows={d.labs} columns={[{ label: 'Date', key: 'date' }, { label: 'Tests', render: (r) => r.tests.map((t) => `${t.name}: ${t.result || 'pending'}`).join('; ') }, { label: 'Status', render: (r) => <StatusBadge value={r.status} /> }, { label: '', render: (r) => <Link to={`/lab/${r.id}`}>View</Link> }]} /></Card>}
      {tab === 'admissions' && <Card><Table rows={d.admissions} columns={[{ label: 'Bed', render: (r) => `${d.bedCategories[r.category] || ''} ${r.number || ''}` }, { label: 'Admitted', render: (r) => fmtDateTime(r.a_time) }, { label: 'Discharged', render: (r) => fmtDateTime(r.d_time) || '—' }, { label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} /></Card>}
      {tab === 'history' && <Card actions={null}><Table rows={d.history} columns={[{ label: 'Date', render: (r) => fmtDate(r.date) }, { label: 'Title', key: 'title' }, { label: 'Notes', key: 'description' }, { label: '', render: (r) => (r.img_url ? <a href={api.url(`/history/${r.id}/attachment`)} target="_blank" rel="noreferrer">Attachment</a> : null) }]} /><div style={{ marginTop: 10 }}><LinkBtn to={`/history/new?patient=${p.id}`}>Add entry</LinkBtn></div></Card>}
      {tab === 'invoices' && <Card><Table rows={d.invoices} columns={[{ label: '#', render: (r) => <Link to={`/invoices/${r.id}`}>{r.id}</Link> }, { label: 'Date', key: 'date' }, { label: 'Items', key: 'category_name' }, { label: 'Total', className: 'right', render: (r) => money(r.gross_total) }, { label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} /></Card>}
    </Page>); }}</Load>;
}

export function PatientCard({ wristband }) {
  const { id } = useParams(); const st = useLoad(`/patients/${id}/${wristband ? 'wristband' : 'card'}`);
  return <Page title={wristband ? 'Wristband' : 'Patient card'} actions={<><PrintButton /><LinkBtn to={`/patients/${id}`}>Back</LinkBtn></>}><Load state={st}>{(d) => (
    <div className="print-card" style={wristband ? { width: 420, padding: 8 } : undefined}><Letterhead institute={d.institute} />
      <div className="row" style={{ justifyContent: 'space-between' }}><div><h2>{d.patient.name}</h2><div>MRN {d.patient.patient_id}</div><div>{d.patient.sex} · {d.patient.age} yrs · {d.patient.bloodgroup}</div>{d.type && <div>{d.type.name}</div>}{d.patient.mlc && <b style={{ color: 'red' }}>MLC</b>}</div>{d.patient.img_url && !wristband && <img alt="" src={fileUrl(d.patient.img_url)} style={{ width: 80, borderRadius: 6 }} />}</div>
      <div style={{ marginTop: 10 }}><Barcode value={d.patient.patient_id} /></div></div>)}</Load></Page>;
}

// ---- medical history
export function HistoryList() {
  const app = useApp(); const [sp, setSp] = useSearchParams(); const st = useLoad('/history', Object.fromEntries(sp.entries()), [sp.toString()]); const [q, setQ] = useState(sp.get('q') || ''); const { run } = useAction();
  return <Page title="Medical history" actions={<LinkBtn kind="primary" to="/history/new">+ Add entry</LinkBtn>}>
    <Filters onSubmit={() => setSp(q ? { q } : {})}><Field label="Search"><input value={q} onChange={(e) => setQ(e.target.value)} /></Field><Btn kind="primary" type="submit">Search</Btn></Filters>
    <Load state={st}>{(d) => <Card><Table rows={d.data} columns={[{ label: 'Date', render: (r) => fmtDate(r.date) }, { label: 'Patient', render: (r) => <Link to={`/patients/${r.patient_id}`}>{r.patient_name}</Link> }, { label: 'Title', key: 'title' }, { label: 'Description', key: 'description' }, { label: '', className: 'nowrap', render: (r) => <>{r.img_url && <a href={api.url(`/history/${r.id}/attachment`)} target="_blank" rel="noreferrer">File</a>} <Link className="btn btn-sm" to={`/history/${r.id}/edit`}>Edit</Link> <ConfirmBtn onConfirm={async () => { if (await run(() => api.del(`/history/${r.id}`))) st.reload(); }}>Delete</ConfirmBtn></> }]} /><Pager meta={d.meta} onPage={(p) => setSp({ ...Object.fromEntries(sp.entries()), page: p })} /></Card>}</Load></Page>;
}
export function HistoryForm() {
  const { id } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate(); const edit = !!id; const st = useLoad(edit ? `/history/${id}/edit` : '/history/form-data', edit ? undefined : { patient: sp.get('patient') }); const { run, busy, errors } = useAction();
  const form = useForm({ patient_id: sp.get('patient') || '', title: '', description: '', date: '', attachment: null });
  useEffect(() => { if (edit && st.data) form.setValues({ ...st.data.entry, date: fmtDate(st.data.entry.date), attachment: null }); }, [st.data]); // eslint-disable-line
  return <Page title={edit ? 'Edit history entry' : 'Add history entry'}><Load state={st}>{(d) => <Card><form onSubmit={async (e) => { e.preventDefault(); const body = toForm(form.values); const r = await run(() => (edit ? api.put(`/history/${id}`, body) : api.post('/history', body))); if (r) nav(`/patients/${r.entry.patient_id}`); }}>
    <Fields cols={2} form={form} errors={errors} fields={[{ name: 'patient_id', label: 'Patient', type: 'select', required: true, options: d.patients.map((p) => [p.id, `${p.patient_id} · ${p.name}`]) }, { name: 'date', label: 'Date', type: 'date' }, { name: 'title', label: 'Title', required: true }, { name: 'attachment', label: 'Attachment (image)', type: 'file', accept: 'image/*' }, { name: 'description', label: 'Description', type: 'textarea', required: true, span: 2, rows: 5 }]} />
    <FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn><LinkBtn to="/history">Cancel</LinkBtn></FormActions></form></Card>}</Load></Page>;
}
