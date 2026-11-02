import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, toForm } from '../api.js';
import { useAction, useForm, useLoad } from '../hooks.js';
import { useApp } from '../context.jsx';
import Crud from '../components/Crud.jsx';
import { Badge, Barcode, Btn, Card, ConfirmBtn, Fields, FormActions, Filters, Field, Load, Page, Pager, Stat, Table } from '../components/ui.jsx';
import { fmtDateTime, fullName, money } from '../util.js';

export function Dashboard() {
  const st = useLoad('/dashboard');
  return <Page title="Dashboard"><Load state={st}>{(d) => (
    <>
      <div className="stats">
        <Stat label="Patients" value={d.totalPatients} /><Stat label="Doctors" value={d.totalDoctors} tone="blue" /><Stat label="Staff" value={d.totalStaff} tone="blue" />
        <Stat label="Beds free / total" value={`${d.freeBeds} / ${d.totalBeds}`} sub={`${d.occupancy}% occupied`} tone="amber" /><Stat label="Appointments" value={d.totalAppointments} sub={`${d.pendingAppointments} pending`} />
        <Stat label="Prescriptions" value={d.totalPrescriptions} /><Stat label="Lab requests" value={d.totalLabTests} /><Stat label="Medicines" value={d.totalMedicines} />
      </div>
      <div className="stats"><Stat label="Income" value={money(d.income)} /><Stat label="Expenses" value={money(d.expenses)} tone="red" /><Stat label="Balance" value={money(d.balance)} tone={d.balance < 0 ? 'red' : undefined} /></div>
      <div className="cols-2">
        <Card title="Recent patients" actions={<Link to="/patients">All patients</Link>}><Table rows={d.recentPatients} columns={[{ label: 'Name', render: (r) => <Link to={`/patients/${r.id}`}>{r.name}</Link> }, { label: 'Phone', key: 'phone' }, { label: 'Sex', key: 'sex' }, { label: 'Age', key: 'age' }, { label: 'Added', key: 'add_date' }]} /></Card>
        <Card title="Recent appointments" actions={<Link to="/appointments">All appointments</Link>}><Table rows={d.recentAppointments} columns={[{ label: 'Patient', render: (r) => d.patientNames[r.patient] || '—' }, { label: 'Doctor', render: (r) => d.doctorNames[r.doctor] || '—' }, { label: 'Date', key: 'date' }, { label: 'Slot', key: 'time_slot' }, { label: 'Status', key: 'status' }]} /></Card>
      </div>
    </>)}</Load></Page>;
}

export function SearchPage() {
  const [sp] = useSearchParams(); const term = sp.get('search') || ''; const st = useLoad('/search', { search: term }, [term]);
  return <Page title={`Search: ${term}`}><Load state={st}>{(d) => (d.message ? <div className="alert alert-info">{d.message}</div> : (
    <div className="cols-2">
      <Card title={`Patients (${d.patients.length})`}><Table rows={d.patients} columns={[{ label: 'MRN', key: 'patient_id' }, { label: 'Name', render: (r) => <Link to={`/patients/${r.id}`}>{r.name}</Link> }, { label: 'Phone', key: 'phone' }, { label: 'Age', key: 'age' }]} /></Card>
      <Card title={`Doctors (${d.doctors.length})`}><Table rows={d.doctors} columns={[{ label: 'Name', render: (r) => <Link to={`/doctors/${r.id}`}>{r.name}</Link> }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }]} /></Card>
    </div>))}</Load></Page>;
}

export function MySettings() {
  const st = useLoad('/settings'); const { run, busy, errors } = useAction(); const form = useForm({});
  useEffect(() => { if (st.data) form.setValues({ ...st.data.set, cpassword: '', npassword: '', cnpassword: '' }); }, [st.data]); // eslint-disable-line
  const fields = [{ name: 'firstname', label: 'First name', required: true }, { name: 'lastname', label: 'Last name', required: true }, { name: 'login', label: 'Username', required: true, disabled: true }, { name: 'desc', label: 'Description', required: true }, { name: 'cpassword', label: 'Current password', type: 'password', required: true }, { name: 'npassword', label: 'New password', type: 'password', required: true }, { name: 'cnpassword', label: 'Confirm new password', type: 'password', required: true }];
  return <Page title="My settings"><Load state={st}>{() => <Card><form onSubmit={async (e) => { e.preventDefault(); await run(() => api.post('/settings', form.values)); }}><Fields fields={fields} form={form} errors={errors} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}

export function Schedule() {
  const st = useLoad('/settings/schedule'); const { run, busy } = useAction(); const form = useForm({ date: '', time: '' });
  useEffect(() => { if (st.data) form.setValues(st.data.schedule); }, [st.data]); // eslint-disable-line
  return <Page title="Notification schedule"><Load state={st}>{(d) => <Card><p className="muted">Day of the month ({d.month} {d.year}) and time of day the reminder job should run.</p><form onSubmit={async (e) => { e.preventDefault(); await run(() => api.post('/settings/schedule', form.values)); }}><Fields cols={2} form={form} fields={[{ name: 'date', label: 'Day', required: true }, { name: 'time', label: 'Time', type: 'time', required: true }]} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}

export function Institute() {
  const st = useLoad('/institute'); const { run, busy, errors } = useAction(); const form = useForm({}); const app = useApp();
  useEffect(() => { if (st.data) form.setValues({ ...st.data.institute, grade_system: st.data.gradsystem === 'auto', family: st.data.family === 'on', accounting: st.data.accounting === 'no' }); }, [st.data]); // eslint-disable-line
  const f = [{ name: 'name', label: 'Hospital name', required: true }, { name: 'establish', label: 'Established', required: true }, { name: 'web', label: 'Website', required: true }, { name: 'email', label: 'Email', required: true }, { name: 'phoneNo', label: 'Phone', required: true }, { name: 'address', label: 'Address', required: true, span: 2 }, { name: 'logo', label: 'Logo (PNG)', type: 'file', accept: 'image/png' }];
  return <Page title="Hospital information"><Load state={st}>{() => <Card><form onSubmit={async (e) => { e.preventDefault(); const r = await run(() => api.post('/institute', toForm({ ...form.values, grade_system: form.values.grade_system, family: form.values.family, accounting: form.values.accounting }))); if (r) app.refresh(); }}>
    <Fields fields={f} form={form} errors={errors} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}

export function Users() {
  const app = useApp(); const nav = useNavigate();
  const groups = ['Admin', 'Doctor', 'Nurse', 'Accountant', 'Receptionist', 'Pharmacist', 'Laboratorist'];
  return <Crud title="Users" rowLabel="user" listUrl="/users" listKey="users" createUrl="/users" updateUrl={(r) => `/users/${r.id}`} deleteUrl={(r) => `/users/${r.id}`}
    blank={{ firstname: '', lastname: '', login: '', email: '', group: '', desc: '', password: '' }}
    fields={[{ name: 'firstname', label: 'First name', required: true }, { name: 'lastname', label: 'Last name', required: true }, { name: 'login', label: 'Username', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'group', label: 'Role', type: 'select', options: groups, required: true }, { name: 'desc', label: 'Description', required: true }, { name: 'password', label: 'Password (required; re-enter when editing)', type: 'password', required: true }]}
    toBody={(v) => ({ ...v })}
    columns={() => [{ label: 'Name', render: (r) => fullName(r) }, { label: 'Username', key: 'login' }, { label: 'Email', key: 'email' }, { label: 'Role', render: (r) => <Badge tone="blue">{r.group}</Badge> }, { label: '', className: 'nowrap', render: (r) => r.id !== app.me.user.id && <Btn size="sm" onClick={async () => { await api.post(`/impersonate/${r.id}`); await app.refresh(); nav('/dashboard'); }}>Log in as</Btn> }]} />;
}

export function Permissions() {
  const st = useLoad('/permission'); const { run, busy } = useAction(); const [grid, setGrid] = useState({});
  useEffect(() => { if (st.data) { const g = {}; for (const p of st.data.permissions) (g[p.permission_group] = g[p.permission_group] || {})[p.permission_name] = p.permission_type === 'yes'; setGrid(g); } }, [st.data]);
  const key = (l) => l.toLowerCase().replace(/ /g, '_');
  return <Page title="Permissions" actions={<Btn kind="primary" disabled={busy} onClick={() => run(() => api.post('/permission', grid))}>Save permissions</Btn>}><Load state={st}>{(d) => (
    <Card><div className="table-wrap"><table className="table perm-table"><thead><tr><th>Permission</th>{Object.entries(d.groups).map(([g, label]) => <th key={g}>{label}</th>)}</tr></thead>
      <tbody>{d.permission_fields.map((f) => <tr key={f}><td>{f}</td>{Object.keys(d.groups).map((g) => <td key={g}><input type="checkbox" checked={!!grid[g]?.[key(f)]} onChange={(e) => setGrid((s) => ({ ...s, [g]: { ...(s[g] || {}), [key(f)]: e.target.checked } }))} /></td>)}</tr>)}</tbody></table></div></Card>)}</Load></Page>;
}

export function ActivityLog({ cleared }) {
  const [sp, setSp] = useSearchParams(); const page = Number(sp.get('page') || 1); const params = Object.fromEntries(sp.entries());
  const st = useLoad(cleared ? '/activity/cleared' : '/activity', params, [sp.toString()]); const { run } = useAction(); const nav = useNavigate(); const [f, setF] = useState({});
  const act = (fn) => async () => { if (await run(fn)) st.reload(); };
  return <Page title={cleared ? 'Cleared activity log' : 'Activity log'} actions={<>
    {cleared ? <><Btn onClick={act(() => api.post('/activity/restore-log'))}>Restore all</Btn><ConfirmBtn size="" message="Permanently destroy the cleared log?" onConfirm={act(() => api.del('/activity/destroy-activity'))}>Destroy</ConfirmBtn><Link className="btn" to="/activity">Back</Link></>
      : <><a className="btn" href={api.url('/activity/export')}>Export CSV</a><Link className="btn" to="/activity/cleared">Cleared log</Link><ConfirmBtn size="" message="Clear the activity log?" onConfirm={act(() => api.del('/activity/clear-activity'))}>Clear log</ConfirmBtn></>}</>}>
    <Load state={st}>{(d) => (
      <>
        {!cleared && <Filters onSubmit={() => setSp(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))}>
          <Field label="Description"><input value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="User"><select value={f.user || ''} onChange={(e) => setF({ ...f, user: e.target.value })}><option value="">All</option>{d.users.map((u) => <option key={u.id} value={u.id}>{fullName(u)}</option>)}</select></Field>
          <Field label="Method"><select value={f.method || ''} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="">All</option>{['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Route"><input value={f.route || ''} onChange={(e) => setF({ ...f, route: e.target.value })} /></Field><Field label="IP"><input value={f.ip_address || ''} onChange={(e) => setF({ ...f, ip_address: e.target.value })} /></Field><Btn kind="primary" type="submit">Search</Btn></Filters>}
        <Card title={`${d.totalActivities} entries`}><Table rows={d.data} columns={[{ label: 'ID', key: 'id' }, { label: 'Time', render: (r) => fmtDateTime(r.created_at) }, { label: 'User', render: (r) => (r.userDetails ? fullName(r.userDetails) : '—') }, { label: 'Description', render: (r) => <a onClick={() => nav(`/activity/log/${r.id}`)} style={{ cursor: 'pointer' }}>{r.description}</a> }, { label: 'Method', key: 'methodType' }, { label: 'IP', key: 'ipAddress' }]} /><Pager meta={d.meta} onPage={(p) => setSp({ ...params, page: p })} /></Card>
      </>)}</Load></Page>;
}
export function ActivityEntry() {
  const { id } = useParams(); const st = useLoad(`/activity/log/${id}`);
  return <Page title={`Activity #${id}`} actions={<Link className="btn" to="/activity">Back</Link>}><Load state={st}>{(d) => <><Card><dl className="kv">{[['Description', d.activity.description], ['User', d.activity.userDetails ? fullName(d.activity.userDetails) : '—'], ['Method', d.activity.methodType], ['Route', d.activity.route], ['IP address', d.activity.ipAddress], ['User agent', d.activity.userAgent], ['Language', d.activity.locale], ['Referer', d.activity.referer], ['When', fmtDateTime(d.activity.created_at)]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl></Card>
    <Card title={`Recent activity by this user (${d.totalUserActivities})`}><Table rows={d.userActivities} columns={[{ label: 'Time', render: (r) => fmtDateTime(r.created_at) }, { label: 'Description', key: 'description' }, { label: 'Method', key: 'methodType' }]} /></Card></>}</Load></Page>;
}

export function HospitalBranches() {
  const st = useLoad('/hospital-branches'); const { run } = useAction(); const [sel, setSel] = useState({});
  const crud = <Crud title="Hospital branches" rowLabel="branch" listUrl="/hospital-branches" listKey="branches" createUrl="/hospital-branches" updateUrl={(r) => `/hospital-branches/${r.id}`} canAdd="branch_add" canUpdate="branch_update"
    blank={{ name: '', address: '', phone: '', active: true }} fields={[{ name: 'name', label: 'Name', required: true }, { name: 'address', label: 'Address' }, { name: 'phone', label: 'Phone' }, { name: 'active', label: 'Active', type: 'checkbox' }]}
    columns={() => [{ label: 'Name', key: 'name' }, { label: 'Address', key: 'address' }, { label: 'Phone', key: 'phone' }, { label: 'Active', render: (r) => (r.active ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>) }]}
    extra={(d, reload) => <Card title="Assign users to a branch"><p className="muted">A user with a branch only sees that branch's records. Users without a branch can switch between branches.</p>
      {d.branches.map((b) => { const mine = sel[b.id] ?? d.users.filter((u) => u.branch_id === b.id).map((u) => u.id); return <div key={b.id} style={{ marginBottom: 14 }}><b>{b.name}</b><div className="row">{d.users.map((u) => <label key={u.id} className="check"><input type="checkbox" checked={mine.includes(u.id)} onChange={(e) => setSel({ ...sel, [b.id]: e.target.checked ? [...mine, u.id] : mine.filter((x) => x !== u.id) })} />{fullName(u)}</label>)}</div><Btn size="sm" onClick={async () => { await run(() => api.post(`/hospital-branches/${b.id}/assign`, { users: mine })); reload(); }}>Save assignment</Btn></div>; })}</Card>} />;
  return crud;
}

export function BarcodePage() {
  const [code, setCode] = useState(''); const [cols, setCols] = useState(null); const { run, errors } = useAction();
  return <Page title="Barcodes" actions={cols && <Btn kind="primary" onClick={() => window.print()}>Print</Btn>}>
    <Card><form className="row" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => api.post('/barcode', { code }), { silent: false }); if (r) setCols([r.barcodesc1, r.barcodesc2, r.barcodesc3]); }}>
      <Field label="First 10-digit code" error={errors.code}><input value={code} maxLength={10} onChange={(e) => setCode(e.target.value)} /></Field><Btn kind="primary" type="submit">Generate 42 barcodes</Btn></form></Card>
    {cols && <div className="cols-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>{cols.map((c, i) => <div key={i}>{c.map((v) => <div key={v} style={{ marginBottom: 14 }}><Barcode value={v} /></div>)}</div>)}</div>}</Page>;
}
