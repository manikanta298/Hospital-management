import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAction, useForm, useLoad } from '../hooks.js';
import Crud from '../components/Crud.jsx';
import { Btn, Card, ConfirmBtn, Field, Fields, FormActions, Filters, KV, Letterhead, LinkBtn, Load, Page, PrintButton, Table } from '../components/ui.jsx';
import { fmtDate, money, monthNames, today } from '../util.js';

const toApp = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export function AccountingSettings() {
  const st = useLoad('/accounting'); const { run, busy, errors } = useAction(); const f = useForm({});
  useEffect(() => { if (st.data) f.setValues(st.data.accounting); }, [st.data]); // eslint-disable-line
  return <Page title="Accounting settings"><Load state={st}>{() => <Card><form onSubmit={async (e) => { e.preventDefault(); await run(() => api.post('/accounting', f.values)); }}><Fields form={f} errors={errors} fields={[{ name: 'company_id', label: 'Company ID', required: true }, { name: 'api_link', label: 'API link', required: true }, { name: 'username', label: 'Username', required: true }, { name: 'password', label: 'Password', type: 'password', required: true }]} /><FormActions><Btn kind="primary" type="submit" disabled={busy}>Save</Btn></FormActions></form></Card>}</Load></Page>;
}
export const AccountingSectors = () => <Crud title="Accounting sectors" rowLabel="sector" listUrl="/accounting/sectors" listKey="sectors" createUrl="/accounting/sectors" updateUrl={(r) => `/accounting/sectors/${r.id}`} deleteUrl={(r) => `/accounting/sectors/${r.id}`} canDelete="accounting"
  blank={{ name: '', type: 'Income' }} fields={[{ name: 'name', label: 'Name', required: true }, { name: 'type', label: 'Type', type: 'select', options: [['Income', 'Income'], ['Expence', 'Expense']], required: true }]} columns={() => [{ label: 'Name', key: 'name' }, { label: 'Type', render: (r) => (r.type === 'Expence' ? 'Expense' : r.type) }]} />;

// kind = 'Income' | 'Expence'. A grid of entries, one per accounting sector, saved together.
export function EntryPage({ kind }) {
  const base = kind.toLowerCase(); const label = kind === 'Income' ? 'Income' : 'Expense'; const st = useLoad(`/accounting/${base}-sectors`); const { run, busy, errors } = useAction(); const [rows, setRows] = useState({});
  const list = useLoad(`/accounting/${base}-list`, { year: new Date().getFullYear(), month: monthNames[new Date().getMonth()] });
  const [ym, setYm] = useState({ year: String(new Date().getFullYear()), month: monthNames[new Date().getMonth()] }); const l2 = useLoad(`/accounting/${base}-list`, ym, [ym.year, ym.month]);
  const set = (id, k, v) => setRows((r) => ({ ...r, [id]: { date: today(), ...(r[id] || {}), [k]: v } }));
  return <Page title={`${label} entries`}><Load state={st}>{(d) => <><Card title={`Add ${label.toLowerCase()}`}><p className="muted">Fill only the sectors you have an amount for.</p>{errors.name && <div className="alert alert-error">{errors.name.join(' ')}</div>}
    <table className="table lines"><thead><tr><th>Sector</th><th>Amount</th><th>Date</th><th>Description</th></tr></thead><tbody>{d.sectors.map((s) => <tr key={s.id}><td>{s.name}</td><td><input type="number" step="0.01" value={rows[s.id]?.amount || ''} onChange={(e) => set(s.id, 'amount', e.target.value)} /></td><td><input type="date" value={rows[s.id]?.date || today()} onChange={(e) => set(s.id, 'date', e.target.value)} /></td><td><input value={rows[s.id]?.description || ''} onChange={(e) => set(s.id, 'description', e.target.value)} /></td></tr>)}</tbody></table>
    <FormActions><Btn kind="primary" disabled={busy} onClick={async () => { const entries = d.sectors.map((s) => ({ name: s.name, amount: rows[s.id]?.amount ?? '', date: rows[s.id]?.amount ? toApp(rows[s.id]?.date || today()) : '', description: rows[s.id]?.description || '' })); if (await run(() => api.post(`/accounting/${base}`, { entries }))) { setRows({}); l2.reload(); } }}>Save</Btn></FormActions></Card>
    <Card title="Entries by month"><Filters><Field label="Month"><select value={ym.month} onChange={(e) => setYm({ ...ym, month: e.target.value })}>{monthNames.map((m) => <option key={m}>{m}</option>)}</select></Field><Field label="Year"><input type="number" value={ym.year} onChange={(e) => setYm({ ...ym, year: e.target.value })} /></Field></Filters>
      <Load state={l2}>{(x) => <><Table rows={x.entries} columns={[{ label: 'Date', render: (r) => fmtDate(r.date) }, { label: 'Sector', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Amount', className: 'right', render: (r) => money(r.amount) }, { label: '', render: (r) => <ConfirmBtn onConfirm={async () => { await run(() => api.del(`/accounting/${base}/${r.id}`)); l2.reload(); }}>Delete</ConfirmBtn> }]} /><p className="right"><b>Total {money(x.entries.reduce((a, r) => a + parseFloat(r.amount), 0))}</b></p></>}</Load></Card></>}</Load></Page>;
}
export function AccountingReportForm({ summary }) {
  const nav = useNavigate(); const f = useForm({ rtype: 'Income', from: today().slice(0, 8) + '01', to: today() });
  return <Page title={summary ? 'Income & expense summary' : 'Income / expense report'}><Card><form className="row" onSubmit={(e) => { e.preventDefault(); nav(summary ? `/accounting/reportsum/${f.values.from}/${f.values.to}` : `/accounting/report/${f.values.rtype}/${f.values.from}/${f.values.to}`); }}>
    {!summary && <Field label="Report"><select value={f.values.rtype} onChange={(e) => f.set('rtype', e.target.value)}><option value="Income">Income</option><option value="Expence">Expense</option></select></Field>}<Field label="From"><input type="date" value={f.values.from} onChange={(e) => f.set('from', e.target.value)} /></Field><Field label="To"><input type="date" value={f.values.to} onChange={(e) => f.set('to', e.target.value)} /></Field><Btn kind="primary" type="submit">Show</Btn></form></Card></Page>;
}
export function AccountingReport() {
  const { rtype, from, to } = useParams(); const st = useLoad(`/accounting/report/${rtype}/${from}/${to}`);
  return <Page title={`${rtype === 'Income' ? 'Income' : 'Expense'} report`} actions={<><PrintButton /><LinkBtn to="/accounting/report">Back</LinkBtn></>}><Load state={st}>{(d) => <div className="print-sheet"><Letterhead institute={d.institute} /><p>{d.formdata[0]} to {d.formdata[1]}</p><Table rows={d.datas.map((r, i) => ({ id: i, ...r }))} columns={[{ label: 'Date', render: (r) => fmtDate(r.date) }, { label: 'Name', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Amount', className: 'right', render: (r) => money(r.amount) }]} />
    {d.tutionfees && <KV rows={[['Invoiced (patients)', money(d.tutionfees.payTotal)], ['Received (patients)', money(d.tutionfees.paiTotal)], ['Due', money(d.tutionfees.dueamount)], ['Deposits received', money(d.otherfees.paiTotal)]]} />}<p className="right"><b>Total {money(d.total)}</b></p></div>}</Load></Page>;
}
export function AccountingSummary() {
  const { from, to } = useParams(); const st = useLoad(`/accounting/report-summary/${from}/${to}`);
  return <Page title="Income & expense summary" actions={<><PrintButton /><LinkBtn to="/accounting/reportsum">Back</LinkBtn></>}><Load state={st}>{(d) => <div className="print-sheet"><Letterhead institute={d.institute} /><p>{d.formdata[0]} to {d.formdata[1]}</p>
    <div className="cols-2"><div><h2>Income</h2><Table rows={d.incomes.map((r, i) => ({ id: i, ...r }))} columns={[{ label: 'Name', key: 'name' }, { label: 'Amount', className: 'right', render: (r) => money(r.amount) }]} /><p>Patient payments {money(d.tutionfees.paiTotal + d.otherfees.paiTotal)}</p><b>Total {money(d.intotals)}</b></div>
      <div><h2>Expense</h2><Table rows={d.expences.map((r, i) => ({ id: i, ...r }))} columns={[{ label: 'Name', key: 'name' }, { label: 'Amount', className: 'right', render: (r) => money(r.amount) }]} /><b>Total {money(d.extotal)}</b></div></div><h2 style={{ marginTop: 16 }}>Balance {money(d.balance[0])}</h2></div>}</Load></Page>;
}
