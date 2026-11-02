import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [flash, setFlashState] = useState(null);
  const refresh = useCallback(async () => { try { const m = await api.get('/me'); setMe(m.user ? m : null); } catch { setMe(null); } }, []);
  useEffect(() => { refresh(); const f = () => setMe(null); window.addEventListener('auth:expired', f); return () => window.removeEventListener('auth:expired', f); }, [refresh]);
  const setFlash = useCallback((type, text) => { setFlashState({ type, text, id: Date.now() }); }, []);
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlashState(null), 7000); return () => clearTimeout(t); }, [flash]);
  const can = useCallback((p) => !!me && (me.permissions || []).includes(p), [me]);
  const value = useMemo(() => ({ me, refresh, flash, setFlash, success: (t) => setFlash('success', t), error: (t) => setFlash('error', t), can, clearFlash: () => setFlashState(null) }), [me, refresh, flash, setFlash, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
