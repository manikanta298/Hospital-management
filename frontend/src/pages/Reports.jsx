import { Link, useSearchParams } from 'react-router-dom';
import { useLoad } from '../hooks.js';
import { Card, Filters, Field, Load, Page, Stat, Table } from '../components/ui.jsx';
import { money, today } from '../util.js';

const bars = (rows, label, value, fmt = (v) => v) => { const max = Math.max(1, ...rows.map((r) => r[value])); return rows.map((r) => <div key={r[label]} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}><span style={{ width: 130, flexShrink: 0 }}>{r[label]}</span><div style={{ background: 'var(--brand)', height: 14, width: `${(r[value] / max) * 100}%`, minWidth: 2, borderRadius: 3 }} /><span className="muted">{fmt(r[value])}</span></div>); };

export function DebtorsReport() {
  const st = useLoad('/reports/debtors');
  return <Page title="Debtors (outstanding balances)"><Load state={st}>{(d) => <><div className="stats"><Stat label="Total owed" value={money(d.total)} tone="red" />{Object.entries(d.buckets).map(([k, v]) => <Stat key={k} label={k} value={money(v)} />)}</div>
    <Card><Table rows={d.rows.map((r, i) => ({ id: i, ...r }))} columns={[{ label: 'Patient', render: (r) => (r.patient ? <Link to={`/settlement?patient=${r.patient.id}`}>{r.patient.name}</Link> : '—') }, { label: 'MRN', render: (r) => r.patient?.patient_id }, { label: 'Phone', render: (r) => r.patient?.phone }, { label: 'Invoices', key: 'invoices' }, { label: 'Oldest', key: 'oldest' }, { label: 'Days', key: 'days' }, { label: 'Owed', className: 'right', render: (r) => money(r.owed) }]} /></Card></>}</Load></Page>;
}
export function PendingLabReport() {
  const st = useLoad('/reports/lab');
  return <Page title="Pending lab results"><Load state={st}>{(d) => <><div className="stats"><Stat label="Pending tests" value={d.rows.length} /><Stat label="Waiting 3+ days" value={d.overdue} tone="red" /></div><div className="cols-2"><Card title="By test">{bars(Object.entries(d.byTest).map(([k, v]) => ({ k, v })), 'k', 'v')}</Card></div>
    <Card><Table rows={d.rows.map((r) => ({ id: r.test.id, ...r }))} columns={[{ label: 'Test', render: (r) => r.test.name }, { label: 'Patient', render: (r) => r.patient?.name }, { label: 'Requested', render: (r) => r.lab?.date }, { label: 'Days waiting', render: (r) => r.days }, { label: '', render: (r) => r.lab && <Link to={`/lab/${r.lab.id}`}>Enter result</Link> }]} /></Card></>}</Load></Page>;
}
export function DrugUsageReport() {
  const [sp, setSp] = useSearchParams(); const params = Object.fromEntries(sp.entries()); const st = useLoad('/reports/drug-usage', params, [sp.toString()]);
  return <Page title="Drug usage"><Load state={st}>{(d) => <><Filters><Field label="From"><input type="date" value={d.from} onChange={(e) => setSp({ ...params, from: e.target.value })} /></Field><Field label="To"><input type="date" value={d.to} onChange={(e) => setSp({ ...params, to: e.target.value })} /></Field></Filters><div className="stats"><Stat label="Dispensed value" value={money(d.totalValue)} /></div>
    <Card><Table rows={d.rows.map((r) => ({ id: r.name, ...r }))} columns={[{ label: 'Medicine', key: 'name' }, { label: 'Times prescribed', className: 'right', key: 'prescribed' }, { label: 'Units dispensed', className: 'right', key: 'dispensed' }, { label: 'Value', className: 'right', render: (r) => money(r.value) }]} /></Card></>}</Load></Page>;
}
export function OccupancyReport() {
  const [sp, setSp] = useSearchParams(); const params = Object.fromEntries(sp.entries()); const st = useLoad('/reports/occupancy', params, [sp.toString()]);
  return <Page title="Bed occupancy"><Load state={st}>{(d) => <><Filters><Field label="From"><input type="date" value={d.from} onChange={(e) => setSp({ ...params, from: e.target.value })} /></Field><Field label="To"><input type="date" value={d.to} onChange={(e) => setSp({ ...params, to: e.target.value })} /></Field></Filters>
    <div className="stats"><Stat label="Beds" value={d.totalBeds} /><Stat label="Occupied now" value={d.currentlyOccupied} tone="amber" /><Stat label="Peak" value={d.peak} /><Stat label="Average stay (days)" value={d.averageStay ?? '—'} /><Stat label="Discharges" value={d.discharges} /></div>
    <div className="cols-2"><Card title="Occupancy % by day"><div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, overflowX: 'auto' }}>{d.days.map((x) => <div key={x.date} title={`${x.date}: ${x.occupied} beds (${x.percent}%)`} style={{ background: 'var(--brand)', width: 10, minWidth: 6, height: `${Math.max(2, x.percent)}%`, borderRadius: '2px 2px 0 0' }} />)}</div></Card>
      <Card title="Admissions by ward">{bars(Object.entries(d.byWard).map(([k, v]) => ({ k, v })), 'k', 'v')}</Card></div></>}</Load></Page>;
}
