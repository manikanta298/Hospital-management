import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { useAction } from '../hooks.js';
import { Btn, Field } from '../components/ui.jsx';

export function Login() {
  const app = useApp(); const nav = useNavigate(); const { run, busy, errors } = useAction();
  const [pub, setPub] = useState({ institute: { name: 'ictvission' } }); const [login, setLogin] = useState(''); const [password, setPassword] = useState(''); const [verify, setVerify] = useState(null); const [code, setCode] = useState(''); const [error, setError] = useState('');
  useEffect(() => { api.get('/public').then(setPub).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const r = verify ? await api.post('/verify-code', { id: verify, code }) : await api.post('/login', { login, password });
      if (r.verify) { setVerify(r.id); return; }
      await app.refresh(); if (r.error) app.error(r.error); else if (r.success) app.success(r.success); nav(r.redirect || '/dashboard');
    } catch (err) { setError(err.message); }
  };
  return (
    <div className="login-wrap"><form className="login-card" onSubmit={submit}>
      <h1>🏥 {pub.institute?.name}</h1><div className="muted">{verify ? 'Enter the verification code we sent by SMS.' : 'Sign in to continue'}</div>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      {verify ? <Field label="Verification code" error={errors.code}><input value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></Field> : <>
        <Field label="Username" error={errors.login}><input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus /></Field>
        <Field label="Password" error={errors.password}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field></>}
      <Btn kind="primary" type="submit" disabled={busy} className="" style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}>{verify ? 'Verify' : 'Sign in'}</Btn>
    </form></div>
  );
}
export const NoPermission = () => <div className="card"><div className="card-body"><h1>No permission</h1><p>Your role does not allow that. Ask an administrator to grant it under Administration → Permissions.</p></div></div>;
export const NotFound = () => <div className="card"><div className="card-body"><h1>Page not found</h1></div></div>;
