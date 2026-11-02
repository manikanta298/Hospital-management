import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAction, useForm, useLoad } from '../hooks.js';
import Crud from '../components/Crud.jsx';
import { Btn, Card, ConfirmBtn, Fields, FormActions, Field, Load, Page, Table } from '../components/ui.jsx';
import { fmtDateTime, today } from '../util.js';

export const SmsFormats = () => <Crud title="SMS formats" rowLabel="format" listUrl="/sms" listKey="smses" createUrl="/sms" updateUrl={(r) => `/sms/${r.id}`} deleteUrl={(r) => `/sms/${r.id}`} blank={{ type: '', sender: '', message: '' }}
  fields={[{ name: 'type', label: 'Type', required: true }, { name: 'sender', label: 'Sender', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true, span: 2 }]} columns={() => [{ label: 'Type', key: 'type' }, { label: 'Sender', key: 'sender' }, { label: 'Message', key: 'message' }]} />;
export const Templates = () => <Crud title="Message templates" rowLabel="template" listUrl="/template" listKey="messages" createUrl="/template" updateUrl={(r) => `/template/${r.id}`} deleteUrl={(r) => `/template/${r.id}`} blank={{ title: '', description: '' }}
  toBody={(v) => ({ title: v.title ?? v.name, description: v.description })} fields={[{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Message', type: 'textarea', required: true, span: 2 }]}
  columns={() => [{ label: 'Title', key: 'name' }, { label: 'Message', key: 'description' }, { label: 'Voice', render: (r) => (r.recording ? 'Yes' : '—') }]} />;
export function SmsLog() {
  const [r, setR] = useState(null); const f = useForm({ fromDate: today(), toDate: today() }); const { run, errors } = useAction(); const load = async () => { const x = await run(() => api.post('/smslog', f.values), { silent: true }); if (x) setR(x.smslogs); };
  return <Page title="SMS / voice log"><Card><form className="row" onSubmit={(e) => { e.preventDefault(); load(); }}><Field label="From" error={errors.fromDate}><input type="date" value={f.values.fromDate} onChange={(e) => f.set('fromDate', e.target.value)} /></Field><Field label="To" error={errors.toDate}><input type="date" value={f.values.toDate} onChange={(e) => f.set('toDate', e.target.value)} /></Field><Btn kind="primary" type="submit">Show</Btn></form></Card>
    {r && <Card><Table rows={r} columns={[{ label: 'When', render: (x) => fmtDateTime(x.created_at) }, { label: 'Type', key: 'type' }, { label: 'Sender', key: 'sender' }, { label: 'Recipient', key: 'recipient' }, { label: 'Message', key: 'message' }, { label: 'Status', key: 'status' }, { label: '', render: (x) => <ConfirmBtn onConfirm={async () => { await run(() => api.del(`/smslog/${x.id}`)); load(); }}>Delete</ConfirmBtn> }]} /></Card>}</Page>;
}
export function IctCore() {
  const [sp] = useSearchParams(); const type = sp.get('type') || 'sms'; const st = useLoad('/ictcore', { type }, [type]); const { run, busy, errors } = useAction(); const f = useForm({});
  useEffect(() => { if (st.data) f.setValues({ ...st.data.ictcore_integration, type, method: 'telenor' === st.data.ictcore_integration.method ? '' : 'ictcore' }); }, [st.data]); // eslint-disable-line
  return <Page title={`ICTCore / SMS gateway (${type})`}><Load state={st}>{() => <Card><form onSubmit={async (e) => { e.preventDefault(); await run(() => api.post('/ictcore', { ...f.values, type })); }}>
    <Fields cols={2} form={f} errors={errors} fields={[{ name: 'ictcore_url', label: 'ICTCore API URL' }, { name: 'ictcore_account_id', label: 'Account ID', type: 'number' }, { name: 'ictcore_user', label: 'Username', required: true }, { name: 'ictcore_password', label: 'Password', type: 'password', required: true }, { name: 'method', label: 'Method', type: 'select', options: [['ictcore', 'ICTCore'], ['', 'Telenor / gateway only']] }]} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}
export function NotificationType() {
  const st = useLoad('/notification-type'); const { run, busy, errors } = useAction(); const f = useForm({ fess: 'sms', attendance: 'sms', time_set: '', time: '', date: '' });
  useEffect(() => { if (st.data) { const s = st.data.schedule; const by = Object.fromEntries(st.data.notification_types.map((n) => [n.notification, n.type])); f.setValues({ fess: by.fess || 'sms', attendance: by.attendance || 'sms', time_set: s.time || '', time: s.time || '', date: s.date || '' }); } }, [st.data]); // eslint-disable-line
  return <Page title="Notification settings"><Load state={st}>{(d) => <Card><p className="muted">How payment and appointment reminders are sent, and the day/time the reminder job runs ({d.month} {d.year}).</p><form onSubmit={async (e) => { e.preventDefault(); await run(() => api.post('/notification-type', { ...f.values, time: f.values.time_set })); }}>
    <Fields cols={2} form={f} errors={errors} fields={[{ name: 'fess', label: 'Payment reminders', type: 'select', options: ['sms', 'voice'] }, { name: 'attendance', label: 'Appointment reminders', type: 'select', options: ['sms', 'voice'] }, { name: 'date', label: 'Day of month', required: true }, { name: 'time_set', label: 'Time', type: 'time', required: true }]} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}
export function SendMessage() {
  const st = useLoad('/message'); const { run, busy, errors } = useAction(); const f = useForm({ role: 'patient', type: 'sms', stpye: 'quick', mess_name: '', message: '', phone_number: '' });
  return <Page title="Send message"><Load state={st}>{(d) => <Card><form onSubmit={async (e) => { e.preventDefault(); await run(() => api.post('/message', f.values)); }}>
    <Fields cols={2} form={f} errors={errors} fields={[{ name: 'role', label: 'Send to', type: 'select', options: [['patient', 'All patients'], ['doctor', 'All doctors'], ['other', 'Other numbers']] }, { name: 'type', label: 'Channel', type: 'select', options: ['sms', 'voice'] }, { name: 'stpye', label: 'Mode', type: 'select', options: [['quick', 'Quick (one by one)'], ['campaign', 'Campaign']] }, { name: 'mess_name', label: 'Campaign name', required: true }, { name: 'phone_number', label: 'Numbers (comma separated, for “Other”)', span: 2 }, { name: 'message', label: 'Message', type: 'textarea', required: true, span: 2 }]} />
    <div className="row" style={{ marginTop: 8 }}><span className="muted">Templates:</span>{d.messages.map((m) => <Btn key={m.id} size="sm" onClick={() => { f.set('message', m.description); f.set('mess_name', m.name); }}>{m.name}</Btn>)}</div><FormActions><Btn kind="primary" type="submit" disabled={busy}>Send</Btn></FormActions></form></Card>}</Load></Page>;
}

export function ReminderMessage({ kind }) {
  const st = useLoad(`/ictcore/${kind}`); const { run, busy, errors } = useAction(); const f = useForm({ name: '', description: '', recording: null });
  useEffect(() => { if (st.data) f.setValues({ ...st.data.message, recording: null }); }, [st.data]); // eslint-disable-line
  return <Page title={kind === 'fees' ? 'Payment reminder message' : 'Appointment reminder message'}><Load state={st}>{(d) => <Card><form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(); fd.append('name', f.values.name || ''); fd.append('description', f.values.description || ''); if (f.values.recording) fd.append('recording', f.values.recording); await run(() => api.post(`/ictcore/${kind}`, fd)); st.reload(); }}>
    <Fields cols={1} form={f} errors={errors} fields={[{ name: 'name', label: 'Title', required: true }, { name: 'description', label: 'Message text (used for SMS)', type: 'textarea', required: true }, { name: 'recording', label: 'Voice recording (wav/mp3)', type: 'file', accept: 'audio/*' }]} />{d.message.recording && <p className="muted">Current recording: {d.message.recording}</p>}<FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}
