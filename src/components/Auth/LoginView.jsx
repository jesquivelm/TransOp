import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bus, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { T } from '../../app';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      let data;
      const contentType = resp.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await resp.json();
      } else {
        // El servidor devolvió algo que no es JSON (ej: un error 404 o 500 HTML)
        throw new Error('El servidor no respondió correctamente. Verifica que el backend esté corriendo en el puerto 3020.');
      }

      if (!resp.ok) throw new Error(data.error || 'Acceso denegado');

      login(data.user, data.token);
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError('No se pudo conectar con el servidor. ¿Está el backend encendido?');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      padding: 20
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 400, 
        background: 'rgba(30, 41, 59, 0.7)', 
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 40,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            width: 64, height: 64, borderRadius: 16, background: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)'
          }}>
            <Bus size={32} color="#000" />
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>TransOP</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>Sistema de Gestión de Transporte</p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 24, color: '#f87171', fontSize: 13
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, marginLeft: 4 }}>USUARIO</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#64748b" style={{ position: 'absolute', left: 14, top: 14 }} />
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                style={{ 
                  width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(15, 23, 42, 0.5)', 
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none',
                  fontSize: 15, transition: '0.2s'
                }} 
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, marginLeft: 4 }}>CONTRASEÑA</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#64748b" style={{ position: 'absolute', left: 14, top: 14 }} />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ 
                  width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(15, 23, 42, 0.5)', 
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none',
                  fontSize: 15, transition: '0.2s'
                }} 
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', padding: '14px', background: '#f59e0b', color: '#000', border: 'none',
              borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: '0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 11 }}>© 2026 TransOP · Advanced Transport Systems</p>
        </div>
      </div>
    </div>
  );
}
