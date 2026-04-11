import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tms_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const savedUser = localStorage.getItem('tms_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error("Error parsing user from localStorage:", err);
        localStorage.removeItem('tms_user');
        localStorage.removeItem('tms_token');
        setToken(null);
      }
    }
    setLoading(false);
  }, [token]);

  const login = (userData, userToken) => {
    localStorage.setItem('tms_token', userToken);
    localStorage.setItem('tms_user', JSON.stringify(userData));
    setToken(userToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('tms_token');
    localStorage.removeItem('tms_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, loading }}>
      {loading ? (
        <div style={{ 
          height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', background: '#0b0f1c', color: '#f59e0b',
          fontFamily: 'system-ui, sans-serif'
        }}>
          Cargando sistema de transporte...
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
