import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ChevronRight,
  Database,
  FolderTree,
  Info,
  KeyRound,
  Layout,
  Palette,
  RefreshCcw,
  Save,
  Settings,
  Smile,
  Star,
  XCircle,
  DollarSign,
  TrendingUp,
  Fuel,
  Droplets,
} from 'lucide-react';
import { T } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const TABS_CONFIG = [
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    subtabs: [
      { id: 'empresa', label: 'Datos de Empresa', icon: Info },
      { id: 'base_datos', label: 'Base de Datos', icon: Database },
      { id: 'apis', label: 'APIs', icon: KeyRound },
      { id: 'tipo_cambio', label: 'Tipo de Cambio', icon: DollarSign },
      { id: 'combustibles', label: 'Precios Combustibles', icon: Fuel },
    ],
  },
];

const EMPTY_DB_FORM = {
  host: 'localhost',
  port: 5432,
  database: '',
  user: '',
  password: '',
  ssl: false,
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: T.card2,
  border: `1px solid ${T.bdr2}`,
  borderRadius: 8,
  color: T.txt,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.sub, marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: T.mute, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function StatusBadge({ ok, text }) {
  const Icon = ok ? CheckCircle : XCircle;
  const fg = ok ? T.GRN : T.RED;
  const bg = ok ? T.grnDim : T.redDim;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 999,
      background: bg,
      color: fg,
      fontSize: 12,
      fontWeight: 700,
    }}>
      <Icon size={14} />
      <span>{text}</span>
    </div>
  );
}

function DatosEmpresaPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({
    nombre: '',
    contacto_nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    proforma_intro: '',
    telefono_icon_svg: '',
    email_icon_svg: '',
    direccion_icon_svg: '',
    footer_icon_color: '#9aa8b8',
    logo: '',
    porcentaje_utilidad: 0,
    logo_scale: 1,
    fuente_empresa: 'Georgia, Times New Roman, serif',
    fuente_documento: 'Segoe UI, Arial, sans-serif',
    nombre_color: '#0f172a',
  });

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tms/config/empresa', { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({ ...prev, ...data.data }));
      }
    } catch (e) {
      console.error('Error loading empresa data:', e);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Guardando...');
    try {
      const res = await fetch('/api/tms/config/empresa', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('Datos guardados correctamente');
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStatus('Subiendo logo...');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/tms/uploads/logo', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            filename: file.name,
            dataUrl: reader.result
          }),
        });
        const data = await res.json();
        if (data.success) {
          setForm(prev => ({ ...prev, logo: data.path }));
          setStatus('Logo actualizado');
        } else {
          setStatus(`Error logo: ${data.error}`);
        }
      } catch (err) {
        setStatus(`Error al subir logo: ${err.message}`);
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => { loadData(); }, []);

  const footerIconPreviewStyle = {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: `1px solid ${T.bdr2}`,
    background: T.card2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: form.footer_icon_color || '#9aa8b8',
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 300px) 1fr', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.sub }}>LOGO DE EMPRESA</div>
          <div style={{ 
            width: '100%', height: 180, borderRadius: 12, border: `2px dashed ${T.bdr2}`, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.card2, overflow: 'hidden', position: 'relative' 
          }}>
            {form.logo ? (
              <img src={form.logo} alt="Logo" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: T.mute }}>
                <Palette size={32} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 12 }}>Sube el logo (.png, .jpg)</div>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload} 
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
            />
          </div>
          <div style={{ fontSize: 11, color: T.mute }}>Este logo aparecerá en el encabezado de las proformas PDF y vistas de cotización.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Nombre Legal de la Empresa" hint="Este nombre se usará en facturas y documentos oficiales.">
            <input 
              type="text" value={form.nombre} 
              onChange={e=>setForm({...form, nombre: e.target.value})} 
              style={inputStyle} placeholder="Ej: Transportes TransOP S.A." 
            />
          </Field>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Nombre de Contacto">
              <input 
                type="text" value={form.contacto_nombre} 
                onChange={e=>setForm({...form, contacto_nombre: e.target.value})} 
                style={inputStyle} placeholder="Nombre del encargado" 
              />
            </Field>
            <Field label="Teléfono / WhatsApp">
              <input 
                type="text" value={form.telefono} 
                onChange={e=>setForm({...form, telefono: e.target.value})} 
                style={inputStyle} placeholder="+506 0000-0000" 
              />
            </Field>
          </div>

          <Field label="Correo Electrónico de Contacto" hint="Para envío de proformas y notificaciones.">
            <input 
              type="email" value={form.email} 
              onChange={e=>setForm({...form, email: e.target.value})} 
              style={inputStyle} placeholder="contacto@transop.com" 
            />
          </Field>

          <Field label="Dirección de la empresa">
            <input
              type="text"
              value={form.direccion || ''}
              onChange={e=>setForm({...form, direccion: e.target.value})}
              style={inputStyle}
              placeholder="Dirección comercial"
            />
          </Field>

          <Field label="Introducción de proforma" hint="Texto general que aparecerá arriba del detalle del servicio en el PDF.">
            <textarea
              value={form.proforma_intro || ''}
              onChange={e=>setForm({...form, proforma_intro: e.target.value})}
              style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
              placeholder="Nos complace presentar la siguiente propuesta de transporte..."
            />
          </Field>

          <Field label="Color de íconos del pie">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={form.footer_icon_color || '#9aa8b8'}
                onChange={e=>setForm({...form, footer_icon_color: e.target.value})}
                style={{ width: 44, height: 40, padding: 0, border: `1px solid ${T.bdr2}`, borderRadius: 8, background: T.card2, cursor: 'pointer' }}
              />
              <input
                type="text"
                value={form.footer_icon_color || '#9aa8b8'}
                onChange={e=>setForm({...form, footer_icon_color: e.target.value})}
                style={inputStyle}
                placeholder="#9aa8b8"
              />
            </div>
          </Field>

          <Field label="Ícono SVG teléfono" hint="Usa currentColor dentro del SVG para que el color configurado se refleje en la proforma.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <textarea
                value={form.telefono_icon_svg || ''}
                onChange={e=>setForm({...form, telefono_icon_svg: e.target.value})}
                style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
                placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>'
              />
              <div style={footerIconPreviewStyle} dangerouslySetInnerHTML={{ __html: form.telefono_icon_svg || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.34 2.26a2 2 0 0 1-.57 1.72L7.6 8.99a16 16 0 0 0 7.41 7.41l1.29-1.28a2 2 0 0 1 1.72-.57l2.26.34A2 2 0 0 1 22 16.92z"/></svg>' }} />
            </div>
          </Field>

          <Field label="Ícono SVG correo">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <textarea
                value={form.email_icon_svg || ''}
                onChange={e=>setForm({...form, email_icon_svg: e.target.value})}
                style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
                placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>'
              />
              <div style={footerIconPreviewStyle} dangerouslySetInnerHTML={{ __html: form.email_icon_svg || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>' }} />
            </div>
          </Field>

          <Field label="Ícono SVG dirección">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <textarea
                value={form.direccion_icon_svg || ''}
                onChange={e=>setForm({...form, direccion_icon_svg: e.target.value})}
                style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
                placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>'
              />
              <div style={footerIconPreviewStyle} dangerouslySetInnerHTML={{ __html: form.direccion_icon_svg || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>' }} />
            </div>
          </Field>

          <Field label="Porcentaje de utilidad" hint="Se utilizará por defecto en cada nueva proforma.">
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.porcentaje_utilidad ?? 0}
                onChange={e=>setForm({...form, porcentaje_utilidad: Number(e.target.value || 0)})}
                style={{ ...inputStyle, paddingRight: 32 }}
                placeholder="Ej: 18"
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.mute, fontSize: 13 }}>%</span>
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Escala del logo" hint="Multiplica el tamaño del logo sin deformarlo.">
              <input
                type="number"
                min="0.5"
                max="3"
                step="0.05"
                value={form.logo_scale ?? 1}
                onChange={e=>setForm({...form, logo_scale: Number(e.target.value || 1)})}
                style={inputStyle}
              />
            </Field>
            <Field label="Color nombre empresa">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={form.nombre_color || '#0f172a'}
                  onChange={e=>setForm({...form, nombre_color: e.target.value})}
                  style={{ width: 44, height: 40, padding: 0, border: `1px solid ${T.bdr2}`, borderRadius: 8, background: T.card2, cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={form.nombre_color || '#0f172a'}
                  onChange={e=>setForm({...form, nombre_color: e.target.value})}
                  style={inputStyle}
                  placeholder="#0f172a"
                />
              </div>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Fuente nombre empresa">
              <select
                value={form.fuente_empresa || 'Georgia, Times New Roman, serif'}
                onChange={e=>setForm({...form, fuente_empresa: e.target.value})}
                style={inputStyle}
              >
                <option value="Georgia, Times New Roman, serif">Clásica elegante</option>
                <option value="Garamond, Baskerville, serif">Editorial</option>
                <option value="Trebuchet MS, Verdana, sans-serif">Corporativa suave</option>
                <option value="Helvetica Neue, Arial, sans-serif">Moderna ejecutiva</option>
              </select>
            </Field>
            <Field label="Fuente documento">
              <select
                value={form.fuente_documento || 'Segoe UI, Arial, sans-serif'}
                onChange={e=>setForm({...form, fuente_documento: e.target.value})}
                style={inputStyle}
              >
                <option value="Segoe UI, Arial, sans-serif">Limpia corporativa</option>
                <option value="Helvetica Neue, Arial, sans-serif">Ejecutiva moderna</option>
                <option value="Trebuchet MS, Verdana, sans-serif">Lectura amigable</option>
                <option value="Georgia, Times New Roman, serif">Serif formal</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderTop: `1px solid ${T.bdr}`, paddingTop: 24 }}>
        <button type="submit" disabled={loading} style={{
          padding: '12px 24px', borderRadius: 10, border: 'none', background: T.BLU, color: '#fff', 
          fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <Save size={18} /> Guardar Configuración
        </button>
        <div style={{ fontSize: 13, color: T.mute }}>{status}</div>
      </div>
    </form>
  );
}

function PlaceholderContent({ subtabId }) {
  return (
    <div style={{
      padding: 40,
      border: `2px dashed ${T.bdr}`,
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      textAlign: 'center',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: T.card2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Settings size={24} color={T.mute} />
      </div>
      <div>
        <div style={{ fontWeight: 600, color: T.sub }}>Editor de {subtabId.replace('_', ' ')}</div>
        <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>Esta sección sigue pendiente, pero la conexión a base de datos ya quedó operativa desde aquí.</div>
      </div>
    </div>
  );
}

function DatabaseConfigPanel() {
  const { token } = useAuth();
  const [form, setForm] = useState(EMPTY_DB_FORM);
  const [source, setSource] = useState('sin-configurar');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const cargarConfiguracion = async () => {
    setLoading(true);
    setMessage('');

    try {
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/system/db-config', { headers: authHeaders }),
        fetch('/api/system/db-config/status', { headers: authHeaders }),
      ]);

      const configData = await configRes.json();
      setForm(configData.config || EMPTY_DB_FORM);
      setSource(configData.source || 'sin-configurar');

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      } else {
        const errorData = await statusRes.json().catch(() => ({}));
        setStatus({ ok: false, error: errorData.error || 'No se pudo validar la conexión actual.' });
      }
    } catch (error) {
      setStatus({ ok: false, error: error.message || 'No se pudo consultar el estado de la conexión.' });
      setMessage('No se pudo cargar la configuración actual.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, [token]);

  const probarConexion = async () => {
    setTesting(true);
    setMessage('');

    try {
      const res = await fetch('/api/system/db-config/test', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status} al probar conexión`);
      }

      setStatus(data);
      setMessage('La prueba terminó correctamente.');
    } catch (error) {
      setStatus({ ok: false, error: error.message });
      setMessage(error.message || 'La prueba de conexión falló.');
    } finally {
      setTesting(false);
    }
  };

  const guardarConfiguracion = async () => {
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/system/db-config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error ${res.status} al guardar la configuración`);
      }

      setSource('archivo-local');
      setStatus(data.test);
      setForm(data.config || form);
      setMessage('Configuración guardada y aplicada.');
    } catch (error) {
      setStatus({ ok: false, error: error.message });
      setMessage(error.message || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        padding: 20,
        borderRadius: 14,
        background: T.card2,
        border: `1px solid ${T.bdr}`,
      }}>
        <div>
          <div style={{ fontSize: 12, color: T.mute, marginBottom: 6 }}>ESTADO DE CONEXIÓN</div>
          {status ? (
            <StatusBadge ok={status.ok} text={status.ok ? 'Conexión activa' : 'Conexión con error'} />
          ) : (
            <StatusBadge ok={false} text="Sin validar" />
          )}
          <div style={{ fontSize: 12, color: T.mute, marginTop: 8 }}>
            Fuente actual: {source}
          </div>
        </div>

        <button
          onClick={cargarConfiguracion}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'transparent',
            border: `1px solid ${T.bdr2}`,
            borderRadius: 8,
            color: T.sub,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <RefreshCcw size={14} />
          Recargar estado
        </button>
      </div>

      {status?.ok && status.meta && (
        <div style={{ padding: 16, borderRadius: 12, background: T.grnDim, border: `1px solid ${T.GRN}33`, color: T.sub }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.GRN, marginBottom: 6 }}>Última prueba exitosa</div>
          <div style={{ fontSize: 13 }}>Base de datos: {status.meta.database}</div>
          <div style={{ fontSize: 13 }}>Usuario: {status.meta.user}</div>
          <div style={{ fontSize: 13 }}>Servidor: {status.meta.host || form.host}:{status.meta.port || form.port}</div>
        </div>
      )}

      {status?.ok === false && status.error && (
        <div style={{ padding: 16, borderRadius: 12, background: T.redDim, border: `1px solid ${T.RED}33`, color: T.RED, fontSize: 13 }}>
          {status.error}
        </div>
      )}

      {message && (
        <div style={{ fontSize: 13, color: status?.ok ? T.GRN : T.sub }}>
          {message}
        </div>
      )}

      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${T.bdr}`, background: T.card }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Host">
            <input value={form.host || ''} onChange={e => setForm(prev => ({ ...prev, host: e.target.value }))} style={inputStyle} />
          </Field>

          <Field label="Puerto">
            <input value={form.port || ''} onChange={e => setForm(prev => ({ ...prev, port: e.target.value }))} style={inputStyle} />
          </Field>

          <Field label="Base de datos">
            <input value={form.database || ''} onChange={e => setForm(prev => ({ ...prev, database: e.target.value }))} style={inputStyle} />
          </Field>

          <Field label="Usuario">
            <input value={form.user || ''} onChange={e => setForm(prev => ({ ...prev, user: e.target.value }))} style={inputStyle} />
          </Field>

          <Field label="Contraseña">
            <input type="password" value={form.password || ''} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} style={inputStyle} />
          </Field>

          <Field label="SSL" hint="Actívalo si el servidor PostgreSQL exige certificado o conexión segura.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, color: T.sub }}>
              <input
                type="checkbox"
                checked={Boolean(form.ssl)}
                onChange={e => setForm(prev => ({ ...prev, ssl: e.target.checked }))}
              />
              Usar SSL para esta conexión
            </label>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
          <button
            onClick={probarConexion}
            disabled={testing || saving || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'transparent',
              border: `1px solid ${T.bdr2}`,
              borderRadius: 8,
              color: T.sub,
              cursor: testing ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <RefreshCcw size={14} />
            {testing ? 'Probando...' : 'Probar conexión'}
          </button>

          <button
            onClick={guardarConfiguracion}
            disabled={saving || testing || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: T.AMB,
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar y aplicar'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: T.mute }}>Cargando configuración de base de datos...</div>
      )}
    </div>
  );
}

function ApiKeysPanel() {
  const { token } = useAuth();
  const [groqApiKey, setGroqApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const cargarConfiguracion = async () => {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/tms/config/apis', { headers: authHeaders });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status} al cargar configuración de APIs`);
      }

      const savedKey = data?.groqApiKey || '';
      setGroqApiKey(savedKey);
      setHasStoredKey(Boolean(savedKey));
    } catch (error) {
      setMessage(error.message || 'No se pudo cargar la configuración de APIs.');
      setHasStoredKey(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, [token]);

  const guardarConfiguracion = async () => {
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/tms/config/apis', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          valor: {
            groqApiKey: groqApiKey.trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error ${res.status} al guardar la configuración de APIs`);
      }

      setHasStoredKey(Boolean(groqApiKey.trim()));
      setMessage(groqApiKey.trim() ? 'Llave de Groq guardada correctamente.' : 'La llave de Groq se eliminó de la configuración.');
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar la llave de Groq.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.8fr)',
        gap: 16,
        alignItems: 'stretch',
      }}>
        <div style={{
          padding: 20,
          borderRadius: 14,
          background: T.card2,
          border: `1px solid ${T.bdr}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.ambDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={18} color={T.AMB} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Integración de voz y transcripción</div>
              <div style={{ fontSize: 12, color: T.mute, marginTop: 2 }}>Aquí se guarda la llave que usará el asistente de cotizaciones por voz.</div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.6 }}>
            La llave se guardará dentro de la configuración del sistema para que el backend pueda usarla en las conexiones a Groq.
            Desde aquí podremos activar el flujo del micrófono sin depender de claves pegadas en el navegador.
          </div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 14,
          background: hasStoredKey ? T.grnDim : T.card2,
          border: `1px solid ${hasStoredKey ? `${T.GRN}33` : T.bdr}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ fontSize: 12, color: T.mute }}>ESTADO DE LA LLAVE</div>
          <StatusBadge ok={hasStoredKey} text={hasStoredKey ? 'Llave configurada' : 'Llave pendiente'} />
          <div style={{ fontSize: 12, color: T.mute }}>
            {hasStoredKey ? 'Hay una llave de Groq guardada lista para usarse.' : 'Todavía no se ha registrado una llave de Groq.'}
          </div>
        </div>
      </div>

      {message && (
        <div style={{ fontSize: 13, color: hasStoredKey ? T.GRN : T.sub }}>
          {message}
        </div>
      )}

      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${T.bdr}`, background: T.card }}>
        <div style={{ maxWidth: 720 }}>
          <Field
            label="Groq API Key"
            hint="Usa esta llave para las funciones de voz, transcripción e interpretación de solicitudes. Puedes dejar el campo vacío y guardar si quieres removerla."
          >
            <input
              type="password"
              value={groqApiKey}
              onChange={e => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          <button
            onClick={cargarConfiguracion}
            disabled={loading || saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'transparent',
              border: `1px solid ${T.bdr2}`,
              borderRadius: 8,
              color: T.sub,
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <RefreshCcw size={14} />
            {loading ? 'Recargando...' : 'Recargar'}
          </button>

          <button
            onClick={guardarConfiguracion}
            disabled={saving || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: T.AMB,
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar llave'}
          </button>
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: T.mute, marginTop: 14 }}>Cargando configuración de APIs...</div>
        )}
      </div>
    </div>
  );
}

function TipoCambioPanel() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('tasas');
  const [rates, setRates] = useState({ crc: null, eur: null });
  const [currentDate, setCurrentDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [historial, setHistorial] = useState([]);
  const [programacion, setProgramacion] = useState({ hora: '08:00', activo: false });

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const currencies = [
    { code: 'usd', name: 'Dólar estadounidense', flag: '🇺🇸', symbol: '$' },
    { code: 'crc', name: 'Colón (Costa Rica)', flag: '🇨🇷', symbol: '₡' },
    { code: 'eur', name: 'Euro', flag: '🇪🇺', symbol: '€' },
  ];

  const fetchRates = async () => {
    setLoading(true);
    setStatus('Obteniendo tipo de cambio...');
    try {
      const res = await fetch('/api/tms/tipos-cambio/actual', { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.rates) {
        setRates(data.rates);
        setCurrentDate(data.date);
        setStatus(`Actualizado · ${data.date || new Date().toISOString().split('T')[0]}`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const saveRate = async () => {
    if (!rates.crc) return;
    setLoading(true);
    setStatus('Guardando...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/tms/tipos-cambio', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ fecha: today, rates }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('Guardado correctamente');
        loadHistorial();
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const autoUpdate = async () => {
    setLoading(true);
    setStatus('Actualizando automáticamente...');
    try {
      const res = await fetch('/api/tms/tipos-cambio/auto-actualizar', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setRates(data.rates);
        setCurrentDate(data.date);
        setStatus(`Actualizado automáticamente · ${data.date}`);
        loadHistorial();
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const loadHistorial = async () => {
    try {
      const res = await fetch('/api/tms/tipos-cambio/historial?limit=30', { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setHistorial(data.historial);
      }
    } catch (e) {
      console.error('Error loading historial:', e);
    }
  };

  const loadProgramacion = async () => {
    try {
      const res = await fetch('/api/tms/tipos-cambio/programacion', { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setProgramacion(data.programacion);
      }
    } catch (e) {
      console.error('Error loading programacion:', e);
    }
  };

  const saveProgramacion = async (nuevaProg) => {
    // Optimismo: actualizamos primero en UI
    setProgramacion(nuevaProg);
    setLoading(true);
    setStatus('Guardando programación...');
    
    try {
      const res = await fetch('/api/tms/tipos-cambio/programacion', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(nuevaProg),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(`Programación ${nuevaProg.activo ? 'activada' : 'desactivada'} para las ${nuevaProg.hora}`);
      } else {
        setStatus(`Error al guardar: ${data.error}`);
        loadProgramacion(); // Revertir si hay error
      }
    } catch (e) {
      console.error('Error saving programacion:', e);
      setStatus(`Error de conexión al guardar programación`);
      loadProgramacion(); // Revertir
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRates();
    loadHistorial();
    loadProgramacion();
  }, []);

  const fmtRate = (v) => {
    if (v == null) return '—';
    return v.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderTasasTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, letterSpacing: 0.3, marginBottom: 8 }}>USD A CRC</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: T.BLU }}>₡ {fmtRate(rates.crc)}</div>
          <div style={{ fontSize: 12, color: T.mute, marginTop: 8 }}>{currentDate || 'Sin fecha'}</div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, letterSpacing: 0.3, marginBottom: 8 }}>USD A EUR</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: T.PUR }}>€ {fmtRate(rates.eur)}</div>
          <div style={{ fontSize: 12, color: T.mute, marginTop: 8 }}>{currentDate || 'Sin fecha'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={autoUpdate} disabled={loading} style={{
          flex: 1, padding: '12px 16px', borderRadius: 10, border: `1px solid ${T.AMB}`, background: T.ambDim, color: T.AMB,
          fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <TrendingUp size={16} /> Actualizar ahora
        </button>
        <button onClick={saveRate} disabled={loading || !rates.crc} style={{
          flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none', background: T.BLU, color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: (loading || !rates.crc) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Save size={16} /> Guardar
        </button>
      </div>

      <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, letterSpacing: 0.3, marginBottom: 12 }}>PROGRAMACIÓN AUTOMÁTICA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={programacion.activo} 
              onChange={(e) => saveProgramacion({ ...programacion, activo: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 13, color: T.txt }}>Actualizar automáticamente</span>
          </label>
          <input 
            type="time" 
            value={programacion.hora} 
            onChange={(e) => saveProgramacion({ ...programacion, hora: e.target.value })}
            disabled={!programacion.activo}
            style={{ 
              padding: '8px 12px', 
              borderRadius: 8, 
              border: `1px solid ${T.bdr2}`, 
              background: T.card, 
              color: T.txt,
              opacity: programacion.activo ? 1 : 0.5
            }} 
          />
        </div>
        <div style={{ fontSize: 11, color: T.mute, marginTop: 8 }}>
          {programacion.activo ? `Se actualizará diariamente a las ${programacion.hora}` : 'Programación deshabilitada'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.mute }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? T.AMB : T.GRN }} />
        <span>{status}</span>
      </div>

      <div style={{ marginTop: 10, padding: 20, borderRadius: 14, background: T.card, border: `1px solid ${T.bdr2}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} color={T.BLU} /> Conversor Rápido (USD)
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.mute, marginBottom: 4 }}>DÓLARES (USD)</div>
            <input 
              type="number" 
              placeholder="1.00"
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                document.getElementById('conv-crc').innerText = (val * (rates.crc || 0)).toLocaleString('es-CR');
                document.getElementById('conv-eur').innerText = (val * (rates.eur || 0)).toLocaleString('de-DE');
              }}
              style={inputStyle} 
            />
          </div>
          <div style={{ flex: 1, padding: '10px 14px', background: T.card2, borderRadius: 8, border: `1px solid ${T.bdr2}` }}>
            <div style={{ fontSize: 10, color: T.mute }}>A COLONES (CRC)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>₡ <span id="conv-crc">0.00</span></div>
          </div>
          <div style={{ flex: 1, padding: '10px 14px', background: T.card2, borderRadius: 8, border: `1px solid ${T.bdr2}` }}>
            <div style={{ fontSize: 10, color: T.mute }}>A EUROS (EUR)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>€ <span id="conv-eur">0.00</span></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistorialTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: T.mute }}>REGISTRO HISTÓRICO</div><div style={{ fontSize: 12, color: T.mute }}>{historial.length} registro{historial.length !== 1 ? 's' : ''}</div></div>
        </div>
        {historial.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: T.mute, fontSize: 13 }}>No hay registros. Haz clic en "Actualizar ahora" para comenzar.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: T.mute, borderBottom: `1px solid ${T.bdr}`, background: T.card }}>FECHA</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: T.mute, borderBottom: `1px solid ${T.bdr}`, background: T.card }}>HORA</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: T.mute, borderBottom: `1px solid ${T.bdr}`, background: T.card }}>CRC</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: T.mute, borderBottom: `1px solid ${T.bdr}`, background: T.card }}>EUR</th>
              </tr></thead>
              <tbody>
                {historial.map((row, i) => {
                  const ratesData = typeof row.rates === 'string' ? JSON.parse(row.rates) : row.rates;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.bdr}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.fecha}</td>
                      <td style={{ padding: '10px 12px', color: T.mute }}>
                        {row.created_at ? new Date(row.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: T.BLU }}>₡ {fmtRate(ratesData?.crc)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: T.PUR }}>€ {fmtRate(ratesData?.eur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: T.card2, borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        <button onClick={() => setActiveTab('tasas')} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: activeTab === 'tasas' ? T.card : 'transparent',
          color: activeTab === 'tasas' ? T.txt : T.mute, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>Tasas del día</button>
        <button onClick={() => setActiveTab('historial')} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: activeTab === 'historial' ? T.card : 'transparent',
          color: activeTab === 'historial' ? T.txt : T.mute, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>Historial</button>
      </div>
      {activeTab === 'tasas' && renderTasasTab()}
      {activeTab === 'historial' && renderHistorialTab()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PANEL: PRECIOS DE COMBUSTIBLES
// ─────────────────────────────────────────────────────────────
function CombustiblesPanel() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('precios');
  const [prices, setPrices] = useState({ super: 633, regular: 607, diesel: 530, kerosene: 478 });
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [historial, setHistorial] = useState([]);
  const [programacion, setProgramacion] = useState({ hora: '08:00', activo: false });

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tms/combustibles/actual', { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setPrices(data.prices);
        setCurrentDate(data.date);
      }
    } catch (e) {
      console.error('Error fetching fuels:', e);
    }
    setLoading(false);
  };

  const loadHistorial = async () => {
    try {
      const res = await fetch('/api/tms/combustibles/historial', { headers: authHeaders });
      const data = await res.json();
      if (data.success) setHistorial(data.history);
    } catch (e) {
      console.error('Error loading history:', e);
    }
  };

  const savePrices = async () => {
    setLoading(true);
    setStatus('Guardando...');
    try {
      const res = await fetch('/api/tms/combustibles', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ fecha: currentDate, prices }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('Guardado correctamente');
        loadHistorial();
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const loadProgramacion = async () => {
    try {
      const res = await fetch('/api/tms/combustibles/programacion', { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setProgramacion(data.programacion);
      }
    } catch (e) {
      console.error('Error loading fuel programacion:', e);
    }
  };

  const saveProgramacion = async (nuevaProg) => {
    setProgramacion(nuevaProg);
    setLoading(true);
    setStatus('Guardando programación...');
    try {
      const res = await fetch('/api/tms/combustibles/programacion', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(nuevaProg),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(`Programación ${nuevaProg.activo ? 'activada' : 'desactivada'} para las ${nuevaProg.hora}`);
      } else {
        setStatus(`Error al guardar: ${data.error}`);
        loadProgramacion();
      }
    } catch (e) {
      console.error('Error saving fuel programacion:', e);
      setStatus(`Error de conexión al guardar programación`);
      loadProgramacion();
    }
    setLoading(false);
  };

  const autoUpdate = async () => {
    setLoading(true);
    setStatus('Actualizando automáticamente...');
    try {
      const res = await fetch('/api/tms/combustibles/auto-actualizar', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setPrices(data.prices);
        setCurrentDate(data.date);
        setStatus(`Actualizado automáticamente · ${data.date}`);
        loadHistorial();
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrices();
    loadHistorial();
    loadProgramacion();
  }, []);

  const renderPreciosTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20, borderTop: '4px solid #185FA5' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, marginBottom: 8 }}>SÚPER</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, color: T.mute }}>₡</span>
            <input type="number" value={prices.super} onChange={e=>setPrices({...prices, super: e.target.value})} style={{...inputStyle, fontSize: 24, fontWeight: 700, padding: 4, background: 'transparent', border: 'none'}} />
          </div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20, borderTop: '4px solid #0F6E56' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, marginBottom: 8 }}>REGULAR</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, color: T.mute }}>₡</span>
            <input type="number" value={prices.regular} onChange={e=>setPrices({...prices, regular: e.target.value})} style={{...inputStyle, fontSize: 24, fontWeight: 700, padding: 4, background: 'transparent', border: 'none'}} />
          </div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20, borderTop: '4px solid #854F0B' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, marginBottom: 8 }}>DIÉSEL</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, color: T.mute }}>₡</span>
            <input type="number" value={prices.diesel} onChange={e=>setPrices({...prices, diesel: e.target.value})} style={{...inputStyle, fontSize: 24, fontWeight: 700, padding: 4, background: 'transparent', border: 'none'}} />
          </div>
        </div>
      </div>

      <div style={{ background: T.card, padding: 16, borderRadius: 12, border: `1px solid ${T.bdr}`, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: T.mute }}>Vigentes desde:</div>
        <input type="date" value={currentDate} onChange={e=>setCurrentDate(e.target.value)} style={{...inputStyle, width: 160}} />
        <button onClick={autoUpdate} disabled={loading} style={{
          marginLeft: 'auto', padding: '10px 18px', borderRadius: 8, border: `1px solid ${T.AMB}`, background: T.ambDim, color: T.AMB, fontSize: 13, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <RefreshCcw size={14} /> Actualizar ahora
        </button>
        <button onClick={savePrices} disabled={loading} style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', background: T.BLU, color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <Save size={16} /> Guardar Precios
        </button>
      </div>

      <div style={{ fontSize: 12, color: T.mute }}>{status}</div>
    </div>
  );

  const renderHistorialTab = () => (
    <div style={{ background: T.card2, borderRadius: 12, border: `1px solid ${T.bdr}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ background: T.card }}>
          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: T.mute }}>FECHA</th>
          <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, color: T.mute }}>SÚPER</th>
          <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, color: T.mute }}>REGULAR</th>
          <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, color: T.mute }}>DIÉSEL</th>
        </tr></thead>
        <tbody>
          {historial.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.bdr}` }}>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.fecha}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#185FA5' }}>₡ {row.super}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0F6E56' }}>₡ {row.regular}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#854F0B' }}>₡ {row.diesel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderProgramacionTab = () => (
    <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.mute, letterSpacing: 0.3, marginBottom: 16 }}>PROGRAMACIÓN AUTOMÁTICA (RECOPE)</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={programacion.activo} 
            onChange={(e) => saveProgramacion({ ...programacion, activo: e.target.checked })}
            style={{ width: 20, height: 20 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: T.txt }}>Activar actualización automática de precios</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <div style={{ fontSize: 13, color: T.mute }}>Ejecutar diariamente a las:</div>
          <input 
            type="time" 
            value={programacion.hora} 
            onChange={(e) => saveProgramacion({ ...programacion, hora: e.target.value })}
            disabled={!programacion.activo}
            style={{ 
              padding: '10px 14px', 
              borderRadius: 8, 
              border: `1px solid ${T.bdr2}`, 
              background: T.card, 
              color: T.txt,
              opacity: programacion.activo ? 1 : 0.5,
              fontSize: 14,
              fontWeight: 700
            }} 
          />
        </div>
      </div>
      <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: T.ambDim, border: `1px solid ${T.AMB}22`, color: T.AMB, fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Info size={16}/> Nota sobre fuentes de datos</div>
        El sistema intentará sincronizar los precios nacionales vigentes publicados por la ARESEP/RECOPE. Si la fuente automática no está disponible, el sistema mantendrá los últimos precios guardados.
      </div>
      <div style={{ fontSize: 12, color: T.mute, marginTop: 16 }}>
        {programacion.activo ? `Próxima ejecución programada para las ${programacion.hora}` : 'La actualización automática está desactivada actualmente.'}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 4, background: T.card2, borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button onClick={() => setActiveTab('precios')} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
          background: activeTab === 'precios' ? T.card : 'transparent', color: activeTab === 'precios' ? T.BLU : T.mute, cursor: 'pointer'
        }}>Precios actuales</button>
        <button onClick={() => setActiveTab('historial')} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
          background: activeTab === 'historial' ? T.card : 'transparent', color: activeTab === 'historial' ? T.BLU : T.mute, cursor: 'pointer'
        }}>Historial</button>
        <button onClick={() => setActiveTab('programacion')} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
          background: activeTab === 'programacion' ? T.card : 'transparent', color: activeTab === 'programacion' ? T.BLU : T.mute, cursor: 'pointer'
        }}>Programación</button>
      </div>
      {activeTab === 'precios' ? renderPreciosTab() : activeTab === 'historial' ? renderHistorialTab() : renderProgramacionTab()}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.mute }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? T.AMB : T.GRN }} />
        <span>{status || 'Sistema listo'}</span>
      </div>
    </div>
  );
}

export default function ConfiguracionesView() {
  const [activeTab, setActiveTab] = useState('general');
  const [activeSubtab, setActiveSubtab] = useState('empresa');

  const currentTab = TABS_CONFIG.find(t => t.id === activeTab);
  const currentSubtab = currentTab?.subtabs.find(s => s.id === activeSubtab);

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 160px)' }}>
      <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.mute, marginBottom: 8, paddingLeft: 12 }}>CATEGORÍAS</div>
        {TABS_CONFIG.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveSubtab(tab.subtabs[0].id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? T.ambDim : 'transparent',
                color: isActive ? T.AMB : T.sub,
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
              }}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>{tab.label}</span>
              {isActive && <ChevronRight size={14} />}
            </button>
          );
        })}
      </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.card, borderRadius: 16, border: `1px solid ${T.bdr}`, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${currentTab.subtabs.length}, minmax(170px, 1fr))`,
              background: T.card2,
              borderBottom: `1px solid ${T.bdr}`,
              padding: '0 12px',
              gap: 6,
            }}
          >
            {currentTab.subtabs.map(sub => {
              const Icon = sub.icon;
              const isActive = activeSubtab === sub.id;

            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubtab(sub.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? T.AMB : 'transparent'}`,
                  color: isActive ? T.txt : T.mute,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                <Icon size={14} />
                {sub.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <div style={{ maxWidth: 860 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.txt }}>{currentSubtab?.label}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: T.mute }}>
                {activeSubtab === 'base_datos'
                  ? 'Configura la conexión a PostgreSQL, valida el acceso y aplica cambios sin salir del sistema.'
                  : activeSubtab === 'apis'
                    ? 'Administra las llaves de integración que usarán los servicios inteligentes y de voz del sistema.'
                  : 'Ajusta los parámetros visuales y de comportamiento del módulo.'}
              </p>
            </div>

            {activeSubtab === 'empresa'
              ? <DatosEmpresaPanel />
              : activeSubtab === 'base_datos'
                ? <DatabaseConfigPanel />
                : activeSubtab === 'apis'
                  ? <ApiKeysPanel />
                  : activeSubtab === 'tipo_cambio'
                    ? <TipoCambioPanel />
                    : activeSubtab === 'combustibles'
                      ? <CombustiblesPanel />
                      : <PlaceholderContent subtabId={activeSubtab} />}
          </div>
        </div>
      </div>
    </div>
  );
}
