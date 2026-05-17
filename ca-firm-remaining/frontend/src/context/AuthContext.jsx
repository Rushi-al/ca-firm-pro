import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [firm,    setFirm]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount — try to restore session using refresh token cookie
  useEffect(() => {
    const tryRestore = async () => {
      try {
        // Try refresh first (cookie-based)
        const refreshRes = await api.post('/auth/refresh');
        const token = refreshRes.data.data.accessToken;
        sessionStorage.setItem('accessToken', token);

        // Fetch current user
        const meRes = await api.get('/auth/me');
        setUser(meRes.data.data.user);
        setFirm(meRes.data.data.firm);
      } catch {
        // No valid session — show login
        sessionStorage.removeItem('accessToken');
      } finally {
        setLoading(false);
      }
    };
    tryRestore();
  }, []);

  const login = async (email, password) => {
    const res  = await api.post('/auth/login', { email, password });
    const data = res.data.data;

    // 2FA required
    if (data.requires2FA) return data;

    // Normal login — store short-lived access token in sessionStorage
    sessionStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
    setFirm(data.firm);
    return data;
  };

  const complete2FA = async (tempToken, token) => {
    const res  = await api.post('/auth/2fa/complete', { tempToken, token });
    const data = res.data.data;
    sessionStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
    setFirm(data.firm);
    return data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    sessionStorage.removeItem('accessToken');
    setUser(null);
    setFirm(null);
  };

  return (
    <AuthContext.Provider value={{ user, firm, loading, login, complete2FA, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
