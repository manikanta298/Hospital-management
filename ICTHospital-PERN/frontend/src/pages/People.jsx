import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, fileUrl, toForm } from '../api.js';
import { useAction, useForm, useLoad } from '../hooks.js';
import { useApp } from '../context.jsx';
import Crud from '../components/Crud.jsx';
import { Badge, Btn, Card, ConfirmBtn, Field, Fields, FormActions, Filters, KV, LinkBtn, Load, Page, Pager, StatusBadge, Table } from '../components/ui.jsx';
import { fmtDate } from '../util.js';

export function DoctorList() {
  const app = useApp(); const [sp, setSp] = useSearchParams(); const [q, setQ] = useState(sp.get('q') || ''); const st = useLoad('/doctors', Object.fromEntries(sp.entries()), [sp.toString()]); const { run } = useAction();
  return <Page title="Doctors" actions={app.can('doctor_add') && <LinkBtn kind="primary" to="/doctors/new">+ Add doctor</LinkBtn>}>
    <Filters onSubmit={() => setSp(q ? { q } : {})}><Field label="Search"><input value={q} onChange={(e) => setQ(e.target.value)} /></Field><Btn kind="primary" type="submit">Search</Btn></Filters>
    <Load state={st}>{(d) => <Card><Table rows={d.data} columns={[{ label: 'Name', render: (r) => <Link to={`/doctors/${r.id}`}>{r.name}</Link> }, { label: 'Department', key: 'department' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }, { label: 'Upcoming', render: (r) => d.upcoming[r.id] || 0 },
      { label: '', className: 'right nowrap', render: (r) => <>{app.can('doctor_schedule') && <Link className="btn btn-sm" to={`/doctors/${r.id}/slots`}>Schedule</Link>} {app.can('doctor_update') && <Link className="btn btn-sm" to={`/doctors/${r.id}/edit`}>Edit</Link>} {app.can('doctor_delete') && <ConfirmBtn message={`Remove ${r.name}?`} onConfirm={async () => { if (await run(() => api.del(`/doctors/${r.id}`))) st.reload(); }}>Delete</ConfirmBtn>}</> }]} />
      <Pager meta={d.meta} onPage={(p) => setSp({ ...Object.fromEntries(sp.entries()), page: p })} /></Card>}</Load></Page>;
}
export function DoctorForm() { return <PersonForm kind="doctor" />; }
export function StaffForm() { const { type } = useParams(); return <PersonForm kind={type} key={type} />; }

// One form for doctors and every staff type (they share name/email/phone/address/photo + optional login).
function PersonForm({ kind }) {
  const { id } = useParams(); const nav = useNavigate(); const edit = !!id; const isDoc = kind === 'doctor'; const base = isDoc ? '/doctors' : `/staff/${kind}`;
  const st = useLoad(edit ? `${base}/${id}/edit` : `${base}/form-data`); const { run, busy, errors } = useAction();
  const form = useForm({ name: '', email: '', phone: '', address: '', department: '', profile: '', procedure_id: '', login_username: '', login_password: '', photo: null });
  useEffect(() => { if (edit && st.data) form.setValues({ ...(st.data.doctor || st.data.person), login_username: st.data.login?.username || '', login_password: '', photo: null }); }, [st.data]); // eslint-disable-line
  return <Page title={`${edit ? 'Edit' : 'Add'} ${isDoc ? 'doctor' : (st.data?.staffMeta?.singular || kind)}`}><Load state={st}>{(d) => {
    const fields = [{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address' },
      ...(isDoc ? [{ name: 'department', label: 'Department', type: 'select', options: d.departments }, { name: 'profile', label: 'Profile / speciality' }, { name: 'procedure_id', label: 'Registration no.' }] : []), { name: 'photo', label: 'Photo', type: 'file', accept: 'image/*' },
      { name: 'login_username', label: d.login ? 'Login username' : 'Create a login (username)', hint: 'Optional. Lets this person sign in.' }, { name: 'login_password', label: d.login ? 'New password (leave blank to keep)' : 'Password (min 8)', type: 'password' }];
    return <Card><form onSubmit={async (e) => { e.preventDefault(); const body = toForm(form.values); const r = await run(() => (edit ? api.put(`${base}/${id}`, body) : api.post(base, body))); if (r) nav(isDoc ? '/doctors' : base); }}>
      <Fields fields={fields} form={form} errors={errors} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn><LinkBtn to={isDoc ? '/doctors' : base}>Cancel</LinkBtn></FormActions></form></Card>; }}</Load></Page>;
}
export function DoctorShow() {
  const { id } = useParams(); const st = useLoad(`/doctors/${id}`);
  return <Load state={st}>{(d) => <Page title={d.doctor.name} actions={<LinkBtn to={`/doctors/${id}/slots`}>Schedule</LinkBtn>}><Card>{d.doctor.img_url && <img alt="" src={fileUrl(d.doctor.img_url)} style={{ maxWidth: 120, borderRadius: 8, marginBottom: 12 }} />}<KV rows={[['Department', d.doctor.department], ['Profile', d.doctor.profile], ['Registration no.', d.doctor.procedure_id], ['Phone', d.doctor.phone], ['Email', d.doctor.email], ['Address', d.doctor.address]]} /></Card>
    <Card title="Recent appointments"><Table rows={d.appointments} columns={[{ label: 'Date', key: 'date' }, { label: 'Slot', key: 'time_slot' }, { label: 'Patient', render: (r) => d.patients[r.patient]?.name }, { label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} /></Card></Page>}</Load>;
}
export function StaffList() {
  const { type } = useParams(); const app = useApp(); const [sp, setSp] = useSearchParams(); const [q, setQ] = useState(sp.get('q') || ''); const st = useLoad(`/staff/${type}`, Object.fromEntries(sp.entries()), [type, sp.toString()]); const { run } = useAction(); const perm = st.data?.staffMeta?.permission;
  return <Page title={st.data?.staffMeta?.label || 'Staff'} actions={perm && app.can(`${perm}_add`) && <LinkBtn kind="primary" to={`/staff/${type}/new`}>+ Add {st.data.staffMeta.singular}</LinkBtn>}>
    <Filters onSubmit={() => setSp(q ? { q } : {})}><Field label="Search"><input value={q} onChange={(e) => setQ(e.target.value)} /></Field><Btn kind="primary" type="submit">Search</Btn></Filters>
    <Load state={st}>{(d) => <Card><Table rows={d.data} columns={[{ label: 'Name', key: 'name' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }, { label: 'Address', key: 'address' }, { label: 'Login', render: (r) => (r.ion_user_id ? <Badge tone="green">Yes</Badge> : '—') },
      { label: '', className: 'right nowrap', render: (r) => <>{app.can(`${d.staffMeta.permission}_update`) && <Link className="btn btn-sm" to={`/staff/${type}/${r.id}/edit`}>Edit</Link>} {app.can(`${d.staffMeta.permission}_delete`) && <ConfirmBtn onConfirm={async () => { if (await run(() => api.del(`/staff/${type}/${r.id}`))) st.reload(); }}>Delete</ConfirmBtn>}</> }]} /><Pager meta={d.meta} onPage={(p) => setSp({ ...Object.fromEntries(sp.entries()), page: p })} /></Card>}</Load></Page>;
}

export function Departments() {
  const [adopting, setAdopting] = useState(false);
  return <Crud title="Departments" rowLabel="department" listUrl="/departments" listKey="departments" createUrl="/departments" updateUrl={(r) => `/departments/${r.id}`} deleteUrl={(r) => `/departments/${r.id}`} canAdd="department_add" canUpdate="department_update" canDelete="department_delete"
    blank={{ name: '', description: '' }} fields={[{ name: 'name', label: 'Name', required: true }, { name: 'description', label: 'Description', type: 'textarea' }]}
    columns={(d) => [{ label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Doctors', render: (r) => d.usage[r.name] || 0 }]}
    extra={(d, reload) => d.unlisted.length > 0 && <div className="alert alert-info">Used by doctors but not on the list: {d.unlisted.join(', ')}. <Btn size="sm" disabled={adopting} onClick={async () => { setAdopting(true); await api.post('/departments/adopt'); setAdopting(false); reload(); }}>Add them</Btn></div>} />;
}
