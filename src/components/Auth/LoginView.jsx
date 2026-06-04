import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, AlertCircle, Loader2, Database } from 'lucide-react';
import EmergencyDbConfig from './EmergencyDbConfig';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmergencyDb, setShowEmergencyDb] = useState(false);
  const [dbError, setDbError] = useState(null); // null = OK / string = error log
  const [checkingDb, setCheckingDb] = useState(true);
  const { login } = useAuth();

  // ── Cargar credenciales guardadas ──────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('transop_saved_credentials');
      if (saved) {
        const { username: u, password: p } = JSON.parse(saved);
        if (u) setUsername(u);
        if (p) setPassword(p);
        setRememberPassword(true);
      }
    } catch {
      // ignorar errores de localStorage
    }
  }, []);

  // ── Ping inicial al backend para detectar problemas de DB ─────────────────
  useEffect(() => {
    const checkDb = async () => {
      setCheckingDb(true);
      try {
        const res = await fetch('/api/system/db-emergency/status', {
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const data = await res.json();
            msg = data.error || msg;
          } catch { /* no-json */ }
          setDbError(msg);
          return;
        }

        const data = await res.json();
        if (data.ok === false) {
          setDbError(data.error || 'La base de datos no está disponible.');
        } else {
          setDbError(null); // conexión OK → ocultar botón
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          setDbError('Tiempo de espera agotado al verificar la base de datos (>6 s).');
        } else if (err.name === 'TypeError') {
          setDbError('No se pudo conectar con el servidor. ¿Está el backend encendido?');
        } else {
          setDbError(err.message || 'Error desconocido al verificar la base de datos.');
        }
      } finally {
        setCheckingDb(false);
      }
    };

    checkDb();
  }, []);

  // ── Submit login ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      let data;
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await resp.json();
      } else {
        throw new Error(
          'El servidor no respondió correctamente. Verifica que el backend esté corriendo en el puerto 3020.'
        );
      }

      if (!resp.ok) throw new Error(data.error || 'Acceso denegado');

      // Guardar / limpiar credenciales según la preferencia
      if (rememberPassword) {
        localStorage.setItem(
          'transop_saved_credentials',
          JSON.stringify({ username, password })
        );
      } else {
        localStorage.removeItem('transop_saved_credentials');
      }

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

  // ── Vista de configuración de emergencia ───────────────────────────────────
  if (showEmergencyDb) {
    return (
      <EmergencyDbConfig
        onBack={() => setShowEmergencyDb(false)}
        initialError={dbError}
      />
    );
  }

  // ── Render principal ───────────────────────────────────────────────────────
  const showDbButton = !checkingDb && dbError !== null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top, rgba(245, 158, 11, 0.18), transparent 28%), linear-gradient(135deg, #0b1120 0%, #111827 58%, #0f172a 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 40,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            filter: 'drop-shadow(0 14px 20px rgba(0, 0, 0, 0.28))',
          }}>
            <img
              src="/transop-icon.svg"
              alt="TransOP"
              style={{ width: 64, height: 64, display: 'block' }}
            />
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>TransOP</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
            Sistema de Gestión de Transporte
          </p>
        </div>

        {/* Error de login */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 24, color: '#f87171', fontSize: 13,
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', color: '#94a3b8',
              fontSize: 12, fontWeight: 600, marginBottom: 8, marginLeft: 4,
            }}>
              Usuario
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#64748b" style={{ position: 'absolute', left: 14, top: 14 }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                style={{
                  width: '100%', padding: '14px 14px 14px 44px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', outline: 'none', fontSize: 15, transition: '0.2s',
                }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', color: '#94a3b8',
              fontSize: 12, fontWeight: 600, marginBottom: 8, marginLeft: 4,
            }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#64748b" style={{ position: 'absolute', left: 14, top: 14 }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '14px 14px 14px 44px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', outline: 'none', fontSize: 15, transition: '0.2s',
                }}
                required
              />
            </div>
          </div>

          {/* Recordar contraseña */}
          <div style={{ marginBottom: 28 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              color: '#94a3b8', fontSize: 13, cursor: 'pointer', userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
                style={{ accentColor: '#f59e0b', width: 15, height: 15, cursor: 'pointer' }}
              />
              Recordar contraseña
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', background: '#f59e0b',
              color: '#000', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: '0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          {/* Botón DB — solo visible si hay error de conexión */}
          {checkingDb ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: '#64748b', fontSize: 12, marginBottom: 16,
            }}>
              <Loader2 size={13} className="animate-spin" />
              Verificando conexión…
            </div>
          ) : showDbButton ? (
            <button
              onClick={() => setShowEmergencyDb(true)}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 10, padding: '8px 14px',
                color: '#f87171', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                marginBottom: 16, transition: '0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)';
              }}
            >
              <Database size={14} />
              Problema de conexión — Configurar base de datos
            </button>
          ) : null}

          <p style={{ color: '#64748b', fontSize: 11 }}>
            © 2026 TransOP · Advanced Transport Systems
          </p>
        </div>
      </div>
    </div>
  );
}
