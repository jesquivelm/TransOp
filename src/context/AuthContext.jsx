import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
const TOKEN_KEY = 'tms_token';
const USER_KEY = 'tms_user';

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'TransOP';
    clearStoredSession();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const login = (userData, userToken) => {
    clearStoredSession();
    localStorage.setItem(TOKEN_KEY, userToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(userToken);
    setUser(userData);
  };

  const updateUser = (patch) => {
    setUser(prev => {
      const next = { ...(prev || {}), ...(patch || {}) };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    clearStoredSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
