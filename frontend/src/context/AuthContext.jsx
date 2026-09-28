import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

/** Set by the API at login alongside the httpOnly token; carries no secret. */
const hasSessionHint = () => document.cookie.split('; ').some((c) => c.startsWith('city546_session='));

/**
 * Resolves to the signed-in admin, or null. Public visitors (no hint cookie)
 * skip the request entirely; a 401 simply means "not signed in".
 */
async function fetchSession() {
  if (!hasSessionHint()) return null;
  try {
    const { data } = await api.get('/auth/me');
    return data.data.user;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const applySession = useCallback((sessionUser) => {
    setUser(sessionUser);
    setStatus(sessionUser ? 'authenticated' : 'anonymous');
  }, []);

  const refresh = useCallback(() => fetchSession().then(applySession), [applySession]);

  // Restore the session (httpOnly cookie) on first load.
  useEffect(() => {
    let active = true;
    fetchSession().then((u) => active && applySession(u));
    return () => {
      active = false;
    };
  }, [applySession]);

  // If the session expires mid-use, any 401 from the API signs the UI out.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (error) => {
      if (error.status === 401 && !error.url?.includes('/auth/login')) {
        setUser(null);
        setStatus('anonymous');
      }
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.data.user);
    setStatus('authenticated');
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, isAdmin: user?.role === 'ADMIN', login, logout, refresh }),
    [user, status, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
