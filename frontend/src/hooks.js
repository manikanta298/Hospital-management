import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from './api.js';
import { useApp } from './context.jsx';

// Loads GET url (+params) and reloads when they change. Returns { data, loading, error, reload, setData }.
export function useLoad(url, params, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = JSON.stringify([url, params, ...deps]); const seq = useRef(0);
  const load = useCallback(async () => {
    if (!url) return; const mine = ++seq.current; setState((s) => ({ ...s, loading: true }));
    try { const data = await api.get(url, params); if (mine === seq.current) setState({ data, loading: false, error: null }); }
    catch (e) { if (mine === seq.current) setState({ data: null, loading: false, error: e }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

// Runs an API call, shows the server's success/error message, and exposes field errors.
export function useAction() {
  const app = useApp(); const [busy, setBusy] = useState(false); const [errors, setErrors] = useState({});
  const run = useCallback(async (fn, { ok, silent } = {}) => {
    setBusy(true); setErrors({});
    try { const r = await fn(); if (!silent) { const m = ok || (r && r.success); if (typeof m === 'string') app.success(m); } return r; }
    catch (e) { if (e instanceof ApiError) { setErrors(e.errors || {}); if (!silent) app.error(e.message + (e.errors && Object.keys(e.errors).length ? '' : '')); } else app.error(String(e.message || e)); return null; }
    finally { setBusy(false); }
  }, [app]);
  return { run, busy, errors, setErrors };
}

export function useForm(initial) {
  const [values, setValues] = useState(initial || {});
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));
  const bind = (name) => ({ name, value: values[name] ?? '', onChange: (e) => set(name, e.target.type === 'checkbox' ? e.target.checked : e.target.value) });
  return { values, setValues, set, bind };
}
export { useNavigate };
