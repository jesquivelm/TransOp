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
} from 'lucide-react';
import { T } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const TABS_CONFIG = [
  {
    id: 'diseno',
    label: 'Diseño',
    icon: Palette,
    subtabs: [
      { id: 'pres_general', label: 'Presentación General', icon: Info },
      { id: 'repositorio', label: 'Repositorio', icon: FolderTree },
      { id: 'iconos', label: 'Iconos', icon: Smile },
      { id: 'colors_tabs', label: 'Colores de tabs', icon: Palette },
      { id: 'presentaciones', label: 'Presentaciones', icon: Layout },
      { id: 'favoritos', label: 'Favoritos', icon: Star },
    ],
  },
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    subtabs: [
      { id: 'empresa', label: 'Datos de Empresa', icon: Info },
      { id: 'seguridad', label: 'Políticas de Seguridad', icon: CheckCircle },
      { id: 'base_datos', label: 'Base de Datos', icon: Database },
      { id: 'apis', label: 'APIs', icon: KeyRound },
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

export default function ConfiguracionesView() {
  const [activeTab, setActiveTab] = useState('general');
  const [activeSubtab, setActiveSubtab] = useState('base_datos');

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

            {activeSubtab === 'base_datos'
              ? <DatabaseConfigPanel />
              : activeSubtab === 'apis'
                ? <ApiKeysPanel />
                : <PlaceholderContent subtabId={activeSubtab} />}
          </div>
        </div>
      </div>
    </div>
  );
}
