import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { cls } from '../util.js';

export const Loading = () => <div className="loading">Loading…</div>;
export const ErrorBox = ({ error }) => (error ? <div className="alert alert-error">{error.status === 403 ? 'You do not have permission to see this page.' : error.message}</div> : null);
export function Load({ state, children }) { if (state.loading && !state.data) return <Loading />; if (state.error) return <ErrorBox error={state.error} />; return state.data ? children(state.data) : null; }

export function Page({ title, actions, children, crumbs }) {
  return (
    <section className="page">
      <header className="page-head"><div><h1>{title}</h1>{crumbs && <div className="crumbs">{crumbs}</div>}</div><div className="page-actions">{actions}</div></header>
      {children}
    </section>
  );
}
export const Card = ({ title, actions, children, className }) => (
  <div className={cls('card', className)}>{(title || actions) && <div className="card-head"><h2>{title}</h2><div>{actions}</div></div>}<div className="card-body">{children}</div></div>
);
export const Badge = ({ children, tone = 'gray' }) => <span className={`badge badge-${tone}`}>{children}</span>;
export const statusTone = (s) => ({ paid: 'green', completed: 'green', reported: 'green', approved: 'blue', 'part paid': 'amber', partial: 'amber', pending: 'amber', requested: 'amber', ordered: 'amber', scheduled: 'blue', arrived: 'blue', 'in consultation': 'purple', unpaid: 'red', cancelled: 'red', 'no show': 'red', draft: 'gray', enabled: 'green', disabled: 'gray', occupied: 'red', free: 'green', admitted: 'blue', discharged: 'gray' }[String(s || '').toLowerCase()] || 'gray');
export const StatusBadge = ({ value }) => (value ? <Badge tone={statusTone(value)}>{value}</Badge> : null);

export function Table({ columns, rows, empty = 'Nothing here yet.', rowKey = 'id', onRow }) {
  if (!rows || !rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap"><table className="table"><thead><tr>{columns.map((c) => <th key={c.label} className={c.className}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r[rowKey] ?? i} onClick={onRow ? () => onRow(r) : undefined}>{columns.map((c) => <td key={c.label} className={c.className}>{c.render ? c.render(r, i) : r[c.key]}</td>)}</tr>)}</tbody></table></div>
  );
}
export function Pager({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return meta ? <div className="pager-info">{meta.total} record(s)</div> : null;
  return (
    <div className="pager">
      <button className="btn btn-sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>‹ Prev</button>
      <span>Page {meta.current_page} of {meta.last_page} · {meta.total} record(s)</span>
      <button className="btn btn-sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>Next ›</button>
    </div>
  );
}
export const Btn = ({ children, kind = 'default', size, className, ...p }) => <button type="button" className={cls('btn', `btn-${kind}`, size && `btn-${size}`, className)} {...p}>{children}</button>;
export const LinkBtn = ({ to, children, kind = 'default', size, className }) => <Link to={to} className={cls('btn', `btn-${kind}`, size && `btn-${size}`, className)}>{children}</Link>;
export function ConfirmBtn({ children, message = 'Are you sure?', onConfirm, kind = 'danger', size = 'sm', disabled }) {
  return <Btn kind={kind} size={size} disabled={disabled} onClick={() => { if (window.confirm(message)) onConfirm(); }}>{children}</Btn>;
}

// ----- form fields
export function Field({ label, error, hint, children, required, className }) {
  const msg = Array.isArray(error) ? error.join(' ') : error;
  return <label className={cls('field', msg && 'has-error', className)}><span className="field-label">{label}{required && <b className="req"> *</b>}</span>{children}{hint && <small className="hint">{hint}</small>}{msg && <small className="err">{msg}</small>}</label>;
}
export function Fields({ fields, form, errors = {}, cols = 2 }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {fields.filter((f) => !f.hidden).map((f) => {
        const err = errors[f.name]; const v = form.values[f.name];
        const common = { name: f.name, value: v ?? '', onChange: (e) => form.set(f.name, f.type === 'file' ? e.target.files[0] : e.target.value), placeholder: f.placeholder, disabled: f.disabled };
        let input;
        if (f.type === 'select') input = <select {...common}><option value="">{f.placeholder || '— select —'}</option>{(f.options || []).map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}</select>;
        else if (f.type === 'textarea') input = <textarea rows={f.rows || 3} {...common} />;
        else if (f.type === 'checkbox') return <label key={f.name} className="check" style={{ gridColumn: f.span ? `span ${f.span}` : undefined }}><input type="checkbox" checked={!!v} onChange={(e) => form.set(f.name, e.target.checked)} /> {f.label}</label>;
        else if (f.type === 'file') input = <input type="file" accept={f.accept} onChange={common.onChange} />;
        else input = <input type={f.type || 'text'} step={f.step} min={f.min} max={f.max} maxLength={f.maxLength} {...common} autoComplete={f.type === 'password' ? 'new-password' : undefined} />;
        return <Field key={f.name} label={f.label} required={f.required} error={err} hint={f.hint} className={f.span ? `span-${f.span}` : ''}>{input}</Field>;
      })}
    </div>
  );
}
export const FormActions = ({ children }) => <div className="form-actions">{children}</div>;

export function PatientSelect({ patients, value, onChange, required, label = 'Patient', error }) {
  return <Field label={label} required={required} error={error}><select value={value ?? ''} onChange={(e) => onChange(e.target.value)}><option value="">— select patient —</option>{(patients || []).map((p) => <option key={p.id} value={p.id}>{p.patient_id ? `${p.patient_id} · ` : ''}{p.name}</option>)}</select></Field>;
}
export function DoctorSelect({ doctors, value, onChange, label = 'Doctor', required, error, blank = '— select doctor —' }) {
  return <Field label={label} required={required} error={error}><select value={value ?? ''} onChange={(e) => onChange(e.target.value)}><option value="">{blank}</option>{(doctors || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>;
}

export function Barcode({ value, height = 40, width = 1.6, displayValue = true }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && value) { try { JsBarcode(ref.current, String(value), { format: 'CODE128', height, width, displayValue, margin: 0, fontSize: 12 }); } catch { /* invalid value */ } } }, [value, height, width, displayValue]);
  return <svg ref={ref} />;
}
export const PrintButton = () => <Btn kind="primary" onClick={() => window.print()}>🖨 Print</Btn>;
export function Letterhead({ institute }) {
  return <div className="letterhead"><h2>{institute?.name || 'ICTHospital'}</h2><div>{[institute?.address, institute?.phoneNo, institute?.email].filter(Boolean).join(' · ')}</div></div>;
}
export function KV({ rows }) { return <dl className="kv">{rows.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>)}</dl>; }
export function Tabs({ tabs, active, onChange }) { return <div className="tabs">{tabs.map(([k, l]) => <button key={k} type="button" className={cls('tab', active === k && 'on')} onClick={() => onChange(k)}>{l}</button>)}</div>; }
export function Stat({ label, value, tone, sub }) { return <div className={cls('stat', tone && `stat-${tone}`)}><div className="stat-v">{value}</div><div className="stat-l">{label}</div>{sub && <div className="stat-s">{sub}</div>}</div>; }
export function Filters({ children, onSubmit }) { return <form className="filters" onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(); }}>{children}</form>; }
