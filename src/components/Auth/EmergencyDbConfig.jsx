import { useState, useEffect } from 'react';
import { Database, RefreshCcw, Save, CheckCircle, XCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(15, 23, 42, 0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const EMPTY_FORM = { host: 'localhost', port: 5432, database: '', user: '', password: '', ssl: false };

export default function EmergencyDbConfig({ onBack }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState(null);
  const [source, setSource] = useState('sin-configurar');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/system/db-emergency/status');
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
        setSource(data.source || 'sin-configurar');
        if (data.config) {
          setForm(prev => ({
            ...prev,
            host: data.config.host || prev.host,
            port: data.config.port || prev.port,
            database: data.config.database || prev.database,
            user: data.config.user || prev.user,
            ssl: data.config.ssl || false,
          }));
        }
      } else {
        setStatus({ ok: false, error: data.error || 'Error al cargar estado' });
      }
    } catch (err) {
      setStatus({ ok: false, error: err.message });
    }
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const testConnection = async () => {
    setTesting(true);
    setMessage('');
    try {
      const res = await fetch('/api/system/db-emergency/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al probar conexión');
      }
      setStatus(data);
      setMessage('Conexión exitosa.');
    } catch (err) {
      setStatus({ ok: false, error: err.message });
      setMessage(err.message);
    }
    setTesting(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/system/db-emergency/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar configuración');
      }
      setMessage('Configuración guardada y aplicada.');
      setStatus(prev => ({ ...prev, ok: true }));
    } catch (err) {
      setMessage(err.message);
    }
    setSaving(false);
  };

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
        maxWidth: 600,
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 40,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={onBack} style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <ArrowLeft size={18} />
          </button>
          <Database size={22} color="#f59e0b" />
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>
              Configuración de Base de Datos
            </h2>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
              Modo de recuperación — sin conexión a la base de datos
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
            Cargando configuración actual...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {status?.ok
                  ? <CheckCircle size={20} color="#22c55e" />
                  : <XCircle size={20} color="#ef4444" />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: status?.ok ? '#22c55e' : '#ef4444' }}>
                    {status?.ok ? 'Conexión activa' : 'Sin conexión'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Fuente: {source}
                  </div>
                </div>
              </div>
              <button onClick={loadStatus} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 12,
              }}>
                <RefreshCcw size={14} />
                Recargar
              </button>
            </div>

            {status?.ok === false && status?.error && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                fontSize: 13,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}>
                <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{status.error}</span>
              </div>
            )}

            <div style={{
              padding: 24,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(15, 23, 42, 0.3)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <Field label="Host">
                  <input value={form.host} onChange={e => setForm(prev => ({ ...prev, host: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Puerto">
                  <input value={form.port} onChange={e => setForm(prev => ({ ...prev, port: Number(e.target.value) }))} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                </Field>
                <Field label="Base de datos">
                  <input value={form.database} onChange={e => setForm(prev => ({ ...prev, database: e.target.value }))} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                </Field>
                <Field label="Usuario">
                  <input value={form.user} onChange={e => setForm(prev => ({ ...prev, user: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Contraseña">
                  <input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="SSL" hint="Actívalo si el servidor exige conexión segura.">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, color: '#94a3b8', fontSize: 13 }}>
                    <input type="checkbox" checked={Boolean(form.ssl)} onChange={e => setForm(prev => ({ ...prev, ssl: e.target.checked }))} />
                    Usar SSL
                  </label>
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
                <button onClick={testConnection} disabled={testing || saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                    color: '#94a3b8', cursor: testing ? 'wait' : 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}>
                  {testing ? <Loader2 size={16} /> : <RefreshCcw size={14} />}
                  {testing ? 'Probando...' : 'Probar conexión'}
                </button>
                <button onClick={saveConfig} disabled={saving || testing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', background: '#f59e0b', color: '#000',
                    border: 'none', borderRadius: 10, fontWeight: 700,
                    fontSize: 13, cursor: saving ? 'wait' : 'pointer',
                  }}>
                  {saving ? <Loader2 size={16} /> : <Save size={14} />}
                  {saving ? 'Guardando...' : 'Guardar y aplicar'}
                </button>
              </div>
            </div>

            {message && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: status?.ok ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${status?.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: status?.ok ? '#22c55e' : '#f87171',
                fontSize: 13,
              }}>
                {message}
              </div>
            )}

            <button onClick={onBack} style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}>
              Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, marginLeft: 4 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
