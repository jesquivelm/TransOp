import { createElement, useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, CheckSquare, Users, Bus, Receipt,
  BarChart3, AlertTriangle, CheckCircle, XCircle, Clock, MapPin,
  Phone, Plus, Search, ChevronRight, ChevronLeft, Shield, Wrench, X, User,
  MessageSquare, Zap, Eye, RefreshCcw, ChevronDown, Moon, Sun, Calculator, Settings, Trash2
} from "lucide-react";

import CotizadorView from './components/Cotizador/CotizadorView';
import SociosView, { SocioDetailView } from './components/SociosView';
import LoginView from './components/Auth/LoginView';
import UsuarioMgmtView from './components/Admin/UsuarioMgmtView';
import ConfiguracionesView from './components/Admin/ConfiguracionesView';
import FlotaGanttView from './components/FlotaGanttView';
import VoiceAssistantButton from './components/VoiceAssistantButton';
import GlobalTabs from './components/GlobalTabs';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TabsProvider, useTabs } from './context/TabsContext';
import { T } from './theme';
import { normalizeTimeInput, normalizeVoiceInterpretation } from './utils/voiceDrafts';

// ─────────────────────────────────────────────────────────────
// TOKENS DE COLOR
// ─────────────────────────────────────────────────────────────
export { T };

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const API = '/api/tms';

// Fecha de hoy en YYYY-MM-DD (dinámica)
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonthKey = () => new Date().toISOString().slice(0, 7);
const addDaysISO = (dateStr, days) => {
  const base = new Date(`${dateStr}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};
const formatLongDate = (dateStr, opts = {}) => (
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...opts,
  })
);
const startOfWeekISO = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};
const endOfWeekISO = (dateStr) => addDaysISO(startOfWeekISO(dateStr), 6);
const startOfMonthISO = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};
const endOfMonthISO = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
};
const addMonthsKey = (monthKey, diff) => {
  const [year, month] = String(monthKey || currentMonthKey()).split('-').map(Number);
  const next = new Date(year, (month - 1) + diff, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};
const formatMonthLabel = (monthKey) => (
  new Date(`${monthKey || currentMonthKey()}-01T00:00:00`).toLocaleDateString('es-CR', {
    month: 'long',
    year: 'numeric',
  })
);
const buildMonthGrid = (monthKey) => {
  const [year, month] = String(monthKey || currentMonthKey()).split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};
const VEHICLE_TYPE_OPTIONS = [
  { value: 'sedan', label: 'Automóvil' },
  { value: 'van', label: 'Van' },
  { value: 'buseta', label: 'Buseta' },
  { value: 'bus', label: 'Bus' },
  { value: 'microbus', label: 'Microbús' },
  { value: 'otro', label: 'Otro' },
];
const getTaskRangeBounds = (dateStr, scope) => {
  if (scope === 'week') return { desde: startOfWeekISO(dateStr), hasta: endOfWeekISO(dateStr) };
  if (scope === 'month') return { desde: startOfMonthISO(dateStr), hasta: endOfMonthISO(dateStr) };
  return { desde: dateStr, hasta: dateStr };
};
const formatRangeLabel = (dateStr, scope) => {
  if (scope === 'week') {
    const { desde, hasta } = getTaskRangeBounds(dateStr, scope);
    return `${formatLongDate(desde, { month: 'short' })} → ${formatLongDate(hasta, { month: 'short' })}`;
  }
  if (scope === 'month') {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  }
  return formatLongDate(dateStr);
};
const sortTasksByStart = (items) => (
  [...items].sort((a, b) => {
    const dateA = `${a.fecha || todayISO()}T${a.hora || '00:00'}:00`;
    const dateB = `${b.fecha || todayISO()}T${b.hora || '00:00'}:00`;
    return dateA.localeCompare(dateB);
  })
);

function stringToHue(value) {
  const text = String(value || 'sin-evento');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = text.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

function eventPalette(evento) {
  if (!evento?.id) {
    return {
      border: 'rgba(148,163,184,0.2)',
      glow: 'rgba(148,163,184,0.12)',
      bg: 'rgba(15,23,42,0.55)',
      pill: 'rgba(51,65,85,0.88)',
      text: T.sub,
    };
  }

  const hue = stringToHue(evento.id);
  return {
    border: `hsla(${hue}, 72%, 58%, 0.52)`,
    glow: `hsla(${hue}, 72%, 58%, 0.18)`,
    bg: `linear-gradient(135deg, hsla(${hue}, 68%, 16%, 0.92), rgba(15,23,42,0.96))`,
    pill: `hsla(${hue}, 72%, 58%, 0.14)`,
    text: `hsl(${hue}, 84%, 74%)`,
  };
}

function getEventClientSummary(evento) {
  if (!evento) return { clientLine: '', contactLine: '' };
  const clientPrimary = evento.clienteEmpresa || evento.cliente || evento.clienteNombre || '';
  const clientSecondary = !evento.clienteEmpresa || evento.clienteNombre === evento.clienteEmpresa
    ? ''
    : evento.clienteNombre || '';
  const clientLine = [clientPrimary, clientSecondary].filter(Boolean).join(' · ');
  const contactLine = [evento.contactoNombre, evento.contactoTelefono].filter(Boolean).join(' · ');
  return { clientLine, contactLine };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return 9999;
  // Acepta DD/MM/YYYY o YYYY-MM-DD
  let d;
  if (dateStr.includes('-')) {
    d = new Date(dateStr + 'T00:00:00');
  } else {
    const parts = dateStr.split('/');
    d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T00:00:00`);
  }
  return Math.round((d - new Date()) / 86400000);
}

function nextAnnualOccurrence(dateStr, fallbackMonth = null, fallbackDay = null) {
  const raw = String(dateStr || '').trim();
  const now = new Date();
  const currentYear = now.getFullYear();
  let month = fallbackMonth;
  let day = fallbackDay;

  if (raw) {
    if (raw.includes('-')) {
      const parts = raw.split('-').map(Number);
      if (parts.length === 3) {
        month = parts[1];
        day = parts[2];
      } else if (parts.length === 2) {
        month = parts[0];
        day = parts[1];
      }
    } else if (raw.includes('/')) {
      const parts = raw.split('/').map(Number);
      if (parts.length === 3) {
        day = parts[0];
        month = parts[1];
      } else if (parts.length === 2) {
        day = parts[0];
        month = parts[1];
      }
    }
  }

  if (!month || !day) return '';

  let candidate = new Date(currentYear, month - 1, day);
  candidate.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < today) {
    candidate = new Date(currentYear + 1, month - 1, day);
    candidate.setHours(0, 0, 0, 0);
  }
  return candidate.toISOString().slice(0, 10);
}

function formatRecurringDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRecurringDayMonth(dateStr) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'long',
  });
}

function getVehicleRegulatoryDates(vehiculo = {}) {
  const revTecPrimary = nextAnnualOccurrence(vehiculo.revTec);
  const revTecSecondary = nextAnnualOccurrence(vehiculo.revTec2);
  const technicalDates = [revTecPrimary, revTecSecondary].filter(Boolean).sort();
  const nextRevision = technicalDates[0] || '';
  const marchamoLimit = nextAnnualOccurrence(vehiculo.march, 12, 31);
  return {
    revTecPrimary,
    revTecSecondary,
    nextRevision,
  };
}

function toDate(dateISO, timeStr) {
  return new Date(`${dateISO}T${timeStr}:00`);
}

function checkConductorConflicts(condId, startT, endT, tareas, excludeId = null) {
  if (!condId) return [];
  const today = todayISO();
  const s = toDate(today, startT), e = toDate(today, endT);
  return tareas.filter(t => {
    if (t.id === excludeId || t.condId !== condId) return false;
    if (['cancelada','completada'].includes(t.estado)) return false;
    return toDate(today, t.hora) < e && toDate(today, t.fin) > s;
  });
}

function checkVehicleConflicts(vehId, startT, endT, tareas, excludeId = null) {
  if (!vehId) return [];
  const today = todayISO();
  const s = toDate(today, startT), e = toDate(today, endT);
  return tareas.filter(t => {
    if (t.id === excludeId || t.vehId !== vehId) return false;
    if (['cancelada','completada'].includes(t.estado)) return false;
    return toDate(today, t.hora) < e && toDate(today, t.fin) > s;
  });
}

// ─────────────────────────────────────────────────────────────
// LABEL / COLOR MAPS
// ─────────────────────────────────────────────────────────────
const LC = {
  disponible:       ['Disponible',   T.GRN, T.grnDim],
  en_servicio:      ['En servicio',  T.BLU, T.bluDim],
  vacaciones:       ['Vacaciones',   T.PUR, T.purDim],
  enfermo:          ['Enfermo/a',    T.AMB, T.ambDim],
  suspendido:       ['Suspendido',   T.RED, T.redDim],
  inactivo:         ['Inactivo',     T.mute,'rgba(100,116,139,0.14)'],
  mantenimiento:    ['Mantenimiento',T.AMB, T.ambDim],
  fuera_de_servicio:['Fuera servicio',T.RED, T.redDim],
  pendiente:        ['Pendiente',    T.mute,'rgba(100,116,139,0.14)'],
  asignada:         ['Asignada',     T.AMB, T.ambDim],
  en_ruta:          ['En ruta',      T.BLU, T.bluDim],
  completada:       ['Completada',   T.GRN, T.grnDim],
  cancelada:        ['Cancelada',    T.RED, T.redDim],
  incidencia:       ['Incidencia',   T.ORG, T.orgDim],
  planificado:      ['Planificado',  T.mute,'rgba(100,116,139,0.14)'],
  confirmado:       ['Confirmado',   T.AMB, T.ambDim],
  en_curso:         ['En curso',     T.BLU, T.bluDim],
  finalizado:       ['Finalizado',   T.GRN, T.grnDim],
  cancelado:        ['Cancelado',    T.RED, T.redDim],
};

// ─────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────
function Badge({ estado }) {
  const [label, color, bg] = LC[estado] ?? ['?', T.mute, T.bdr];
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
      letterSpacing:.3, color, background:bg, whiteSpace:'nowrap', display:'inline-block' }}>
      {label}
    </span>
  );
}

function PriorityDot({ prio }) {
  const c = { alta: T.RED, urgente: T.ORG, normal: T.AMB, baja: T.mute }[prio] ?? T.mute;
  return <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block', marginRight:6 }} />;
}

function StatCard({ label, value, color = T.txt, sub, icon: Icon }) {
  return (
    <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 20px', flex:1, minWidth:120 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:12, color:T.mute, marginBottom:6, fontWeight:500 }}>{label}</div>
          <div style={{ fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:12, color:T.mute, marginTop:4 }}>{sub}</div>}
        </div>
        {Icon && <Icon size={20} color={color} style={{ opacity:.7 }} />}
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
      <h2 style={{ margin:0, fontSize:15, fontWeight:600, color:T.txt }}>{title}</h2>
      {action && (
        <button onClick={onAction} style={{ fontSize:12, color:T.AMB, background:'transparent', border:'none', cursor:'pointer', fontWeight:500, padding:'4px 8px' }}>
          {action}
        </button>
      )}
    </div>
  );
}

function ConflictBlock({ conflicts, label }) {
  if (conflicts.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:T.grnDim, borderRadius:8, marginTop:8 }}>
        <CheckCircle size={16} color={T.GRN} />
        <span style={{ fontSize:13, color:T.GRN, fontWeight:500 }}>Sin conflictos — {label} disponible</span>
      </div>
    );
  }

  return (
    <div style={{ padding:'12px 14px', background:T.redDim, borderRadius:8, marginTop:8, border:`1px solid rgba(239,68,68,.2)` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <AlertTriangle size={16} color={T.RED} />
        <span style={{ fontSize:13, color:T.RED, fontWeight:600 }}>CONFLICTO DETECTADO</span>
      </div>
      {conflicts.map(c => (
        <div key={c.id} style={{ fontSize:12, color:T.sub, marginLeft:24, marginBottom:4 }}>
          ↳ <strong style={{ color:T.txt }}>{c.nombre}</strong> · {c.hora}–{c.fin}
        </div>
      ))}
    </div>
  );
}

function TaskStatusModal({ tarea, onClose, onConfirm }) {
  const [estado, setEstado] = useState(tarea?.estado || 'pendiente');
  const [notas, setNotas] = useState(tarea?.notas || '');

  if (!tarea) return null;

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16, width:'100%', maxWidth:520, padding:28 };
  const input = { width:'100%', padding:'10px 12px', background:T.card2, border:`1px solid ${T.bdr2}`, borderRadius:8, color:T.txt, fontSize:13, boxSizing:'border-box' };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:T.txt }}>Actualizar estado</div>
            <div style={{ fontSize:12, color:T.mute, marginTop:4 }}>{tarea.nombre}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:T.mute, cursor:'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ display:'grid', gap:14 }}>
          <div>
            <label style={{ fontSize:12, color:T.sub, fontWeight:700, display:'block', marginBottom:6 }}>ESTADO</label>
            <select value={estado} onChange={e => setEstado(e.target.value)} style={{ ...input, cursor:'pointer' }}>
              <option value="pendiente">Pendiente</option>
              <option value="asignada">Asignada</option>
              <option value="en_ruta">En ruta</option>
              <option value="completada">Completada</option>
              <option value="incidencia">Incidencia</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, color:T.sub, fontWeight:700, display:'block', marginBottom:6 }}>COMENTARIOS</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} style={{ ...input, resize:'vertical' }} placeholder="Ej: Servicio completado sin novedad, pasajero esperó 10 min, se reportó incidencia, etc." />
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'transparent', border:`1px solid ${T.bdr2}`, borderRadius:8, color:T.sub, cursor:'pointer' }}>Cancelar</button>
          <button onClick={() => onConfirm({ estado, notas })} style={{ padding:'10px 16px', background:T.AMB, border:'none', borderRadius:8, color:'#111827', cursor:'pointer', fontWeight:800 }}>Guardar estado</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL DE ASIGNACIÓN (con detección de conflictos)
// ─────────────────────────────────────────────────────────────
function AsignacionModal({ tarea, conductores, vehiculos, tareas, eventos, onClose, onConfirm }) {
  const evento = eventos.find(e => e.id === tarea.eventoId);
  const [selCond, setSelCond] = useState(tarea.condId || '');
  const [selVeh,  setSelVeh]  = useState(tarea.vehId  || '');

  const condConf = useMemo(() => checkConductorConflicts(selCond, tarea.hora, tarea.fin, tareas, tarea.id), [selCond, tarea.hora, tarea.fin, tarea.id, tareas]);
  const vehConf  = useMemo(() => checkVehicleConflicts(selVeh, tarea.hora, tarea.fin, tareas, tarea.id),  [selVeh, tarea.hora, tarea.fin, tarea.id, tareas]);
  const selVehObj = vehiculos.find(v => v.id === selVeh);
  const licenciaRequerida = selVehObj?.licenciaRequerida || '';
  const conductoresCompatibles = conductores.filter(c => {
    if (['vacaciones','suspendido','inactivo','enfermo'].includes(c.estado)) return false;
    if (!licenciaRequerida) return true;
    return Array.isArray(c.lic) && c.lic.includes(licenciaRequerida);
  });
  const capOk = selVehObj ? selVehObj.cap >= tarea.pax : true;
  const hasAssignment = Boolean(tarea.condId || tarea.vehId);
  const wantsAssignment = Boolean(selCond || selVeh);
  const canConfirm = wantsAssignment && selCond && selVeh && condConf.length === 0 && vehConf.length === 0 && capOk;
  const canClear = hasAssignment;

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center',
    justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16, width:'100%', maxWidth:540,
    maxHeight:'90vh', overflow:'auto', padding:28 };

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>{tarea.nombre}</div>
            <div style={{ fontSize:12, color:T.mute, marginTop:3 }}>{evento?.nombre} · {tarea.hora}–{tarea.fin} · {tarea.pax} pax</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute, padding:4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:16, padding:'10px 12px', background:T.card2, borderRadius:8 }}>
          <MapPin size={14} color={T.mute} style={{ marginTop:2, flexShrink:0 }} />
          <div style={{ fontSize:12, color:T.sub }}><strong style={{ color:T.txt }}>{tarea.origen}</strong> → {tarea.destino}</div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:8 }}>CONDUCTOR</label>
          <select value={selCond} onChange={e => setSelCond(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.txt, fontSize:14, cursor:'pointer' }}>
            <option value="">— Seleccionar conductor —</option>
            {conductoresCompatibles.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({LC[c.estado]?.[0]})</option>
            ))}
          </select>
          {licenciaRequerida && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.mute }}>
              Se muestran solo conductores con licencia <strong style={{ color: T.AMB }}>{licenciaRequerida}</strong>.
            </div>
          )}
          {selCond && <ConflictBlock conflicts={condConf} label="Conductor" />}
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:8 }}>
            VEHÍCULO <span style={{ color:T.mute, fontWeight:400 }}>— se requieren ≥{tarea.pax} plazas</span>
          </label>
          <select value={selVeh} onChange={e => setSelVeh(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.txt, fontSize:14, cursor:'pointer' }}>
            <option value="">— Seleccionar vehículo —</option>
            {vehiculos.filter(v => v.estado !== 'fuera_de_servicio').map(v => (
              <option key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo} · {v.cap} plazas ({LC[v.estado]?.[0]})</option>
            ))}
          </select>
          {selVeh && (
            <>
              {!capOk && (
                <div style={{ display:'flex', gap:8, padding:'10px 14px', background:T.orgDim, borderRadius:8, marginTop:8 }}>
                  <AlertTriangle size={16} color={T.ORG} />
                  <span style={{ fontSize:13, color:T.ORG, fontWeight:500 }}>
                    Capacidad insuficiente: {selVehObj?.cap} plazas para {tarea.pax} pasajeros
                  </span>
                </div>
              )}
              <ConflictBlock conflicts={vehConf} label="Vehículo" />
            </>
          )}
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.sub, cursor:'pointer', fontSize:14 }}>
            Cancelar
          </button>
          <button onClick={() => canConfirm && onConfirm(tarea.id, selCond, selVeh)} disabled={!canConfirm}
            style={{ padding:'10px 20px', background: canConfirm ? T.AMB : 'rgba(245,158,11,0.2)',
              border:'none', borderRadius:8, color: canConfirm ? '#000' : T.mute,
              cursor: canConfirm ? 'pointer' : 'not-allowed', fontSize:14, fontWeight:600 }}>
            {hasAssignment ? 'Guardar cambios' : 'Confirmar asignacion'}
          </button>
          <button onClick={() => onConfirm(tarea.id, null, null)} disabled={!canClear}
            style={{ padding:'10px 20px', background: canClear ? T.redDim : 'rgba(239,68,68,0.12)',
              border:`1px solid ${canClear ? `${T.RED}33` : T.bdr2}`, borderRadius:8,
              color: canClear ? T.RED : T.mute, cursor: canClear ? 'pointer' : 'not-allowed',
              fontSize:14, fontWeight:600 }}>
            Desasignar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: DASHBOARD
// ─────────────────────────────────────────────────────────────
function Dashboard({ tareas, conductores, vehiculos, eventos, onAsignar }) {
  const total     = tareas.length;
  const enRuta    = tareas.filter(t => t.estado === 'en_ruta').length;
  const complet   = tareas.filter(t => t.estado === 'completada').length;
  const pendient  = tareas.filter(t => t.estado === 'pendiente').length;
  const sinAsig   = tareas.filter(t => t.estado === 'pendiente' && !t.condId).length;
  const dispCond  = conductores.filter(c => c.estado === 'disponible').length;
  const dispVeh   = vehiculos.filter(v => v.estado === 'disponible').length;

  const tableRow = { borderBottom:`1px solid ${T.bdr}`, padding:'12px 0' };
  const tdSt = (w) => ({ width:w, padding:'0 8px', verticalAlign:'middle', color:T.txt, fontSize:13 });

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Tareas hoy"     value={total}    sub={`${complet} completadas`}    icon={CheckSquare} color={T.txt} />
        <StatCard label="En ruta ahora"  value={enRuta}   sub="vehículos activos"           icon={Zap}         color={T.BLU} />
        <StatCard label="Pendientes"     value={pendient} sub={`${sinAsig} sin conductor`}  icon={Clock}       color={sinAsig > 0 ? T.AMB : T.GRN} />
        <StatCard label="Conductores disponibles" value={dispCond} sub={`${dispVeh} vehículos libres`} icon={Users} color={T.GRN} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px', marginBottom:20 }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.bdr2}` }}>
                {['Hora','Tarea','Evento','Conductor','Vehículo','Pax','Estado',''].map(h => (
                  <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:11, fontWeight:600, color:T.mute, letterSpacing:.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tareas.map(t => {
                const cond = conductores.find(c => c.id === t.condId);
                const veh  = vehiculos.find(v => v.id === t.vehId);
                const ev   = eventos.find(e => e.id === t.eventoId);
                return (
                  <tr key={t.id} style={tableRow}>
                    <td style={tdSt(70)}>
                      <span style={{ fontFamily:'monospace', fontSize:13, color:T.AMB, fontWeight:600 }}>{t.hora}</span>
                    </td>
                    <td style={{ ...tdSt(180) }}>
                      <div style={{ fontWeight:500, color:T.txt }}>{t.nombre}</div>
                      <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>{t.origen} → {t.destino}</div>
                    </td>
                    <td style={{ ...tdSt(150), fontSize:12, color:T.sub }}>{ev?.nombre}</td>
                    <td style={tdSt(140)}>
                      {cond
                        ? <span style={{ fontSize:13 }}>{cond.alias || cond.nombre}</span>
                        : <span style={{ fontSize:12, color:T.RED }}>Sin asignar</span>}
                    </td>
                    <td style={tdSt(100)}>
                      {veh
                        ? <span style={{ fontFamily:'monospace', fontSize:12, color:T.sub }}>{veh.placa}</span>
                        : <span style={{ fontSize:12, color:t.condId ? T.AMB : T.mute }}>—</span>}
                    </td>
                    <td style={{ ...tdSt(50), textAlign:'center' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:T.sub }}>{t.pax}</span>
                    </td>
                    <td style={tdSt(110)}><Badge estado={t.estado} /></td>
                    <td style={tdSt(80)}>
                      {['pendiente', 'asignada'].includes(t.estado) && (
                        <button onClick={() => onAsignar(t)}
                          style={{ fontSize:12, padding:'4px 10px', background:T.ambDim, border:`1px solid ${T.AMB}33`,
                            borderRadius:6, color:T.AMB, cursor:'pointer', fontWeight:500 }}>
                          {t.condId || t.vehId ? 'Gestionar' : 'Asignar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {eventos.filter(e => ['en_curso','confirmado'].includes(e.estado)).map(e => {
            const pct = e.tareas > 0 ? Math.round((e.ok / e.tareas) * 100) : 0;
            return (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 14px',
                background:T.card2, borderRadius:10, border:`1px solid ${T.bdr}` }}>
                <PriorityDot prio={e.prio} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:T.txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.nombre}</div>
                  <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>{e.cliente}</div>
                </div>
                <div style={{ fontSize:12, color:T.mute, whiteSpace:'nowrap' }}>{e.ok}/{e.tareas} tareas</div>
                <div style={{ width:80 }}>
                  <div style={{ height:4, background:T.bdr2, borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:pct === 100 ? T.GRN : T.BLU, borderRadius:4 }} />
                  </div>
                </div>
                <Badge estado={e.estado} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVO CONDUCTOR
// ─────────────────────────────────────────────────────────────
function NuevoConductorModal({ onClose, onConfirm }) {
  const EMPTY = { nombre:'', cedula:'', tel:'', alias:'', lic:[] };
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const LICS = ['B','C','D','E'];
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleLic = (l) => setForm(prev => ({
    ...prev, lic: prev.lic.includes(l) ? prev.lic.filter(x => x !== l) : [...prev.lic, l]
  }));

  function submit() {
    if (!form.nombre.trim()) return setError('El nombre es requerido.');
    if (!form.cedula.trim()) return setError('La cédula es requerida.');
    if (!form.tel.trim())    return setError('El teléfono es requerido.');
    if (form.lic.length === 0) return setError('Seleccione al menos una licencia.');
    setError('');
    onConfirm({ ...form, nombre: form.nombre.trim(), cedula: form.cedula.trim(), tel: form.tel.trim(), alias: form.alias.trim() || form.nombre.split(' ')[0] });
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel   = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16,
    width:'100%', maxWidth:480, padding:28 };
  const inp = { width:'100%', padding:'9px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
    borderRadius:8, color:T.txt, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:6 };

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>Nuevo conductor</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>NOMBRE COMPLETO *</label>
            <input style={inp} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Juan Pérez Mora" />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>CÉDULA *</label>
              <input style={inp} value={form.cedula} onChange={e => set('cedula', e.target.value)} placeholder="1-1234-5678" />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>TELÉFONO *</label>
              <input style={inp} value={form.tel} onChange={e => set('tel', e.target.value)} placeholder="8888-0000" />
            </div>
          </div>
          <div>
            <label style={lbl}>ALIAS / APODO</label>
            <input style={inp} value={form.alias} onChange={e => set('alias', e.target.value)} placeholder="Nombre corto (opcional)" />
          </div>
          <div>
            <label style={lbl}>TIPOS DE LICENCIA *</label>
            <div style={{ display:'flex', gap:8 }}>
              {LICS.map(l => (
                <button key={l} onClick={() => toggleLic(l)}
                  style={{ padding:'7px 16px', borderRadius:8, border:`1px solid ${form.lic.includes(l) ? T.BLU : T.bdr2}`,
                    background: form.lic.includes(l) ? T.bluDim : 'transparent',
                    color: form.lic.includes(l) ? T.BLU : T.mute,
                    fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && (
          <div style={{ marginTop:14, padding:'8px 12px', background:T.redDim, borderRadius:8,
            fontSize:12, color:T.RED, border:`1px solid ${T.RED}33` }}>
            {error}
          </div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
          <button onClick={onClose}
            style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={submit}
            style={{ padding:'10px 20px', background:T.AMB, border:'none',
              borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>
            Guardar conductor
          </button>
        </div>
      </div>
    </div>
  );
}

function EditarConductorModal({ conductor, onClose, onConfirm, onDelete, canDelete = false }) {
  const EMPTY = {
    nombre: conductor?.nombre || '',
    cedula: conductor?.cedula || '',
    tel: conductor?.tel || '',
    alias: conductor?.alias || '',
    lic: Array.isArray(conductor?.lic) ? conductor.lic : [],
    estado: conductor?.estado || 'disponible',
  };
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const LICS = ['B','C','D','E'];
  const ESTADOS = ['disponible', 'en_servicio', 'vacaciones', 'enfermo', 'suspendido', 'inactivo'];
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleLic = (l) => setForm(prev => ({
    ...prev, lic: prev.lic.includes(l) ? prev.lic.filter(x => x !== l) : [...prev.lic, l]
  }));

  function submit() {
    if (!form.cedula.trim()) return setError('La cédula es requerida.');
    if (!form.tel.trim()) return setError('El teléfono es requerido.');
    if (form.lic.length === 0) return setError('Seleccione al menos una licencia.');
    setError('');
    onConfirm(conductor.id, {
      cedula: form.cedula.trim(),
      tel: form.tel.trim(),
      alias: form.alias.trim() || conductor.nombre.split(' ')[0],
      lic: form.lic,
      estado: form.estado,
    });
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16,
    width:'100%', maxWidth:480, padding:28 };
  const inp = { width:'100%', padding:'9px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
    borderRadius:8, color:T.txt, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:6 };

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>Editar conductor</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>NOMBRE COMPLETO</label>
            <input style={{ ...inp, color:T.mute, background:T.card3, cursor:'default' }} value={form.nombre} readOnly />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>CÉDULA *</label>
              <input style={inp} value={form.cedula} onChange={e => set('cedula', e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>TELÉFONO *</label>
              <input style={inp} value={form.tel} onChange={e => set('tel', e.target.value)} />
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>ALIAS / APODO</label>
              <input style={inp} value={form.alias} onChange={e => set('alias', e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>ESTADO</label>
              <select style={{ ...inp, cursor:'pointer' }} value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>TIPOS DE LICENCIA *</label>
            <div style={{ display:'flex', gap:8 }}>
              {LICS.map(l => (
                <button key={l} onClick={() => toggleLic(l)}
                  style={{ padding:'7px 16px', borderRadius:8, border:`1px solid ${form.lic.includes(l) ? T.BLU : T.bdr2}`,
                    background: form.lic.includes(l) ? T.bluDim : 'transparent',
                    color: form.lic.includes(l) ? T.BLU : T.mute,
                    fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && (
          <div style={{ marginTop:14, padding:'8px 12px', background:T.redDim, borderRadius:8,
            fontSize:12, color:T.RED, border:`1px solid ${T.RED}33` }}>
            {error}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:22 }}>
          <div>
            {canDelete && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Eliminar permanentemente a ${conductor.nombre}? Esta acción no se puede deshacer.`)) return;
                  await onDelete?.(conductor.id);
                  onClose();
                }}
                style={{ width:34, height:34, display:'inline-flex', alignItems:'center', justifyContent:'center',
                  background:T.redDim, border:`1px solid ${T.RED}33`, borderRadius:8, color:T.RED, cursor:'pointer' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={submit}
            style={{ padding:'10px 20px', background:T.AMB, border:'none',
              borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>
            Guardar cambios
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL CONFIRMAR BAJA
// ─────────────────────────────────────────────────────────────
function ConfirmBajaModal({ nombre, tipo, onClose, onConfirm }) {
  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16,
    width:'100%', maxWidth:400, padding:28, textAlign:'center' };
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:T.redDim,
          display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <AlertTriangle size={24} color={T.RED} />
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:T.txt, marginBottom:8 }}>Confirmar baja</div>
        <div style={{ fontSize:13, color:T.sub, marginBottom:22 }}>
          ¿Dar de baja a <strong style={{ color:T.txt }}>{nombre}</strong>?<br/>
          <span style={{ fontSize:12, color:T.mute }}>El {tipo} pasará a estado <em>Inactivo / Fuera de servicio</em>.</span>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={onClose}
            style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={onConfirm}
            style={{ padding:'9px 20px', background:T.RED, border:'none',
              borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>
            Sí, dar de baja
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleImageInput({ imageUrl, onFileSelect, loading = false }) {
  const inputRef = useRef(null);
  const previewStyle = {
    width: '100%',
    height: 180,
    borderRadius: 14,
    border: `1px dashed ${T.bdr2}`,
    background: `linear-gradient(180deg, ${T.card2}, ${T.card3})`,
    overflow: 'hidden',
    cursor: loading ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: imageUrl ? 14 : 0,
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div
        onClick={() => !loading && inputRef.current?.click()}
        style={previewStyle}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Unidad"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              borderRadius: 10,
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: T.mute, fontSize: 13, padding: 16 }}>
            <div style={{ fontWeight: 700, color: T.sub }}>{loading ? 'Subiendo imagen...' : 'Agregar imagen de la unidad'}</div>
            <div style={{ marginTop: 6 }}>Toca aqui para elegir una foto local</div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFileSelect?.(file);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

function AdjuntosList({ adjuntos = [] }) {
  if (!adjuntos.length) {
    return <div style={{ fontSize: 13, color: T.mute }}>Sin adjuntos registrados.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {adjuntos.map(adjunto => (
        <a
          key={adjunto.id || adjunto.archivoPath}
          href={adjunto.archivoPath}
          target="_blank"
          rel="noreferrer"
          style={{ padding: '10px 12px', borderRadius: 10, background: T.card2, border: `1px solid ${T.bdr}`, color: T.txt, textDecoration: 'none', fontSize: 13 }}
        >
          {adjunto.nombreOriginal || 'Adjunto'}
        </a>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: CONDUCTORES
// ─────────────────────────────────────────────────────────────
function ConductoresView({ conductores, tareas, vehiculos, onAdd, onUpdate, onBaja, onDelete, canDelete = false, apiFetch, onFocusTask }) {
  const [search, setSearch]     = useState('');
  const [filtroEst, setFiltro]  = useState('todos');
  const [expandido, setExpand]  = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [bajaTarget, setBajaTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);

  const filtrados = useMemo(() => conductores.filter(c => {
    const matchS = c.nombre.toLowerCase().includes(search.toLowerCase()) ||
                   (c.alias || '').toLowerCase().includes(search.toLowerCase());
    const matchE = filtroEst === 'todos' || c.estado === filtroEst;
    return matchS && matchE;
  }), [conductores, search, filtroEst]);

  const counts = useMemo(() => {
    const r = { todos: conductores.length };
    conductores.forEach(c => { r[c.estado] = (r[c.estado] || 0) + 1; });
    return r;
  }, [conductores]);

  const filtros = [
    { val:'todos',       label:`Todos (${counts.todos})` },
    { val:'disponible',  label:`Disponibles (${counts.disponible || 0})` },
    { val:'en_servicio', label:`En servicio (${counts.en_servicio || 0})` },
    { val:'vacaciones',  label:`Vacaciones (${counts.vacaciones || 0})` },
    { val:'enfermo',     label:`Bajas (${counts.enfermo || 0})` },
    { val:'inactivo',    label:`Inactivos (${counts.inactivo || 0})` },
  ];

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total conductores"  value={conductores.length}                                     icon={Users}  color={T.txt} />
        <StatCard label="Disponibles"        value={counts.disponible || 0}   sub="listos para asignar"     icon={CheckCircle} color={T.GRN} />
        <StatCard label="En servicio"        value={counts.en_servicio || 0}  sub="activos ahora"           icon={Zap}    color={T.BLU} />
        <StatCard label="No disponibles"     value={(counts.vacaciones||0)+(counts.enfermo||0)} sub="bajas + vacaciones" icon={AlertTriangle} color={T.AMB} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:200, background:T.card2,
            border:`1px solid ${T.bdr2}`, borderRadius:8, padding:'8px 12px' }}>
            <Search size={14} color={T.mute} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conductor..."
              style={{ background:'transparent', border:'none', outline:'none', color:T.txt, fontSize:13, flex:1 }} />
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {filtros.map(f => (
              <button key={f.val} onClick={() => setFiltro(f.val)}
                style={{ padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer',
                  background: filtroEst === f.val ? T.AMB : T.card2,
                  border: `1px solid ${filtroEst === f.val ? T.AMB : T.bdr2}`,
                  color: filtroEst === f.val ? '#000' : T.sub }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModalNuevo(true)}
            style={{ padding:'8px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`,
              borderRadius:8, color:T.AMB, cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Nuevo conductor
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {filtrados.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:T.mute, fontSize:13 }}>No se encontraron conductores.</div>
          )}
          {filtrados.map(c => {
            const veh = vehiculos.find(v => v.id === c.vehId);
            const tareasHoy = tareas.filter(t => t.condId === c.id);
            const open = expandido === c.id;
            const inactivo = c.estado === 'inactivo';
            return (
              <div key={c.id}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 10px', borderRadius:10,
                  cursor:'pointer', transition:'background .15s',
                  background: open ? T.card2 : 'transparent',
                  border: `1px solid ${open ? T.bdr2 : 'transparent'}`,
                  opacity: inactivo ? 0.5 : 1 }}
                  onClick={() => setExpand(open ? null : c.id)}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background:T.card3,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    fontSize:14, fontWeight:700, color: inactivo ? T.mute : T.AMB }}>
                    {c.nombre.split(' ').map(n => n[0]).slice(0,2).join('')}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:T.txt }}>{c.nombre}</div>
                    <div style={{ fontSize:11, color:T.mute }}>{c.alias} · {c.cedula}</div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {(c.lic || []).map(l => (
                      <span key={l} style={{ fontSize:10, fontWeight:700, padding:'2px 6px',
                        borderRadius:4, background:T.bluDim, color:T.BLU }}>{l}</span>
                    ))}
                  </div>
                  <div style={{ width:100, textAlign:'center' }}>
                    {veh ? (
                      <span style={{ fontFamily:'monospace', fontSize:12, color:T.sub }}>{veh.placa}</span>
                    ) : (
                      <span style={{ fontSize:12, color:T.bdr2 }}>Sin asignar</span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, width:110 }}>
                    <Phone size={12} color={T.mute} />
                    <span style={{ fontSize:12, color:T.sub }}>{c.tel}</span>
                  </div>
                  <div style={{ width:110 }}><Badge estado={c.estado} /></div>
                  <button
                    onClick={e => { e.stopPropagation(); setReportTarget(c); }}
                    style={{ padding:'5px 10px', background:T.bluDim,
                      border:`1px solid ${T.BLU}44`,
                      borderRadius:6, color:T.BLU,
                      cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                    Reporte
                  </button>
                  <button
                    disabled={inactivo}
                    onClick={e => { e.stopPropagation(); setEditTarget(c); }}
                    style={{ padding:'5px 10px', background: inactivo ? 'transparent' : T.ambDim,
                      border:`1px solid ${inactivo ? T.bdr : T.AMB+'44'}`,
                      borderRadius:6, color: inactivo ? T.mute : T.AMB,
                      cursor: inactivo ? 'default' : 'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                    {inactivo ? 'Sin edicion' : 'Editar'}
                  </button>
                  <button
                    disabled={inactivo}
                    onClick={e => { e.stopPropagation(); setBajaTarget({ id: c.id, nombre: c.nombre }); }}
                    style={{ padding:'5px 10px', background: inactivo ? 'transparent' : T.redDim,
                      border:`1px solid ${inactivo ? T.bdr : T.RED+'44'}`,
                      borderRadius:6, color: inactivo ? T.mute : T.RED,
                      cursor: inactivo ? 'default' : 'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                    {inactivo ? 'Inactivo' : 'Dar baja'}
                  </button>
                  <ChevronDown size={14} color={T.mute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0 }} />
                </div>
                {open && (
                  <div style={{ margin:'0 10px 8px', padding:'14px 16px', background:T.card3,
                    borderRadius:'0 0 10px 10px', border:`1px solid ${T.bdr}`, borderTop:'none' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:T.mute, marginBottom:10 }}>AGENDA HOY</div>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
                      <div style={{ fontSize:12, color:T.sub }}>
                        Vista rápida del día. El reporte mensual abre calendario, carga operativa y detalle histórico confiable.
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setReportTarget(c); }} style={{ padding:'8px 12px', background:T.bluDim, border:`1px solid ${T.BLU}44`, borderRadius:8, color:T.BLU, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        Abrir reporte mensual
                      </button>
                    </div>
                    {tareasHoy.length === 0 ? (
                      <div style={{ fontSize:13, color:T.mute }}>Sin tareas asignadas para hoy.</div>
                    ) : (
                      tareasHoy.map(t => (
                        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0',
                          borderBottom:`1px solid ${T.bdr}` }}>
                          <span style={{ fontFamily:'monospace', fontSize:12, color:T.AMB, width:50 }}>{t.hora}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:T.txt }}>{t.nombre}</div>
                            <div style={{ fontSize:11, color:T.mute }}>{t.origen} → {t.destino}</div>
                          </div>
                          <Badge estado={t.estado} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalNuevo && (
        <NuevoConductorModal
          onClose={() => setModalNuevo(false)}
          onConfirm={datos => { onAdd(datos); setModalNuevo(false); }}
        />
      )}
      {editTarget && (
        <EditarConductorModal
          conductor={editTarget}
          onClose={() => setEditTarget(null)}
          onDelete={onDelete}
          canDelete={canDelete}
          onConfirm={async (id, datos) => {
            await onUpdate(id, datos);
            setEditTarget(null);
          }}
        />
      )}
      {bajaTarget && (
        <ConfirmBajaModal
          nombre={bajaTarget.nombre}
          tipo="conductor"
          onClose={() => setBajaTarget(null)}
          onConfirm={() => { onBaja(bajaTarget.id); setBajaTarget(null); }}
        />
      )}
      {reportTarget && <MonthlyReportModal apiFetch={apiFetch} type="conductor" target={reportTarget} onClose={() => setReportTarget(null)} onFocusTask={onFocusTask} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVO VEHÍCULO
// ─────────────────────────────────────────────────────────────
function NuevoVehiculoModal({ onClose, onConfirm, onUploadImage }) {
  const EMPTY = { placa:'', marca:'', modelo:'', tipo:'buseta', cap:'', km:'', revTec:'', revTec2:'', foto_url:'', licenciaRequerida:'', combustibleTipo: 'Diésel', rendimiento: 10 };
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inp = { width:'100%', padding:'9px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
    borderRadius:8, color:T.txt, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:6 };

  async function handleImageSelect(file) {
    try {
      setUploading(true);
      const uploadedPath = await onUploadImage(file);
      set('foto_url', uploadedPath);
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!form.placa.trim())  return setError('La placa es requerida.');
    if (!form.marca.trim())  return setError('La marca es requerida.');
    if (!form.modelo.trim()) return setError('El modelo es requerido.');
    if (!form.cap || isNaN(+form.cap) || +form.cap < 1) return setError('Capacidad inválida.');
    if (!form.revTec) return setError('La primera fecha de revisión técnica es requerida.');
    if (!form.revTec2) return setError('La segunda fecha de revisión técnica es requerida.');
    setError('');
    onConfirm({
      placa:  form.placa.trim().toUpperCase(),
      marca:  form.marca.trim(),
      modelo: form.modelo.trim(),
      tipo:   form.tipo,
      cap:    +form.cap,
      km:     +form.km || 0,
      revTec: form.revTec,
      revTec2: form.revTec2,
      march:  null,
      licenciaRequerida: form.licenciaRequerida || null,
      foto_url: form.foto_url.trim() || null,
      combustibleTipo: form.combustibleTipo,
      rendimiento: Number(form.rendimiento) || 0,
    });
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16,
    width:'100%', maxWidth:520, padding:28, maxHeight:'90vh', overflowY:'auto' };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>Registrar vehículo</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>IMAGEN DE LA UNIDAD</label>
            <VehicleImageInput imageUrl={form.foto_url} onFileSelect={handleImageSelect} loading={uploading} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>PLACA *</label>
              <input style={inp} value={form.placa} onChange={e => set('placa', e.target.value)} placeholder="SJB-0000" />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>TIPO *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                {VEHICLE_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>TIPO DE COMBUSTIBLE *</label>
              <select value={form.combustibleTipo} onChange={e => set('combustibleTipo', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                <option value="Súper">Súper</option>
                <option value="Regular">Regular (Plus 91)</option>
                <option value="Diésel">Diésel</option>
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>RENDIMIENTO (KM/L) *</label>
              <input type="number" step="0.1" style={inp} value={form.rendimiento} onChange={e => set('rendimiento', e.target.value)} placeholder="Ej: 10" />
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>MARCA *</label>
              <input style={inp} value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Ej: Toyota" />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>MODELO *</label>
              <input style={inp} value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Ej: Coaster" />
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>CAPACIDAD (pasajeros) *</label>
              <input style={inp} type="number" min="1" max="60" value={form.cap} onChange={e => set('cap', e.target.value)} placeholder="Ej: 20" />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>KILOMETRAJE ACTUAL</label>
              <input style={inp} type="number" min="0" value={form.km} onChange={e => set('km', e.target.value)} placeholder="Ej: 75000" />
            </div>
          </div>
          <div>
            <label style={lbl}>LICENCIA REQUERIDA</label>
            <select value={form.licenciaRequerida} onChange={e => set('licenciaRequerida', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              <option value="">Sin filtro de licencia</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>REV. TÉCNICA 1 *</label>
              <input style={inp} type="date" value={form.revTec} onChange={e => set('revTec', e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>REV. TÉCNICA 2 *</label>
              <input style={inp} type="date" value={form.revTec2} onChange={e => set('revTec2', e.target.value)} />
            </div>
          </div>
        </div>
        {error && (
          <div style={{ marginTop:14, padding:'8px 12px', background:T.redDim, borderRadius:8,
            fontSize:12, color:T.RED, border:`1px solid ${T.RED}33` }}>
            {error}
          </div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
          <button onClick={onClose}
            style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={submit}
            style={{ padding:'10px 20px', background:T.AMB, border:'none',
              borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>
            Registrar vehículo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: VEHÍCULOS
// ─────────────────────────────────────────────────────────────
function EditarVehiculoModal({ vehiculo, onClose, onConfirm, onUploadImage, gastos = [], onAddGasto, onUploadGastoAdjunto, onDelete, canDelete = false }) {
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({
    km: vehiculo?.km ?? 0,
    revTec: (vehiculo?.revTec || '').split('T')[0],
    revTec2: (vehiculo?.revTec2 || '').split('T')[0],
    foto_url: vehiculo?.foto_url || '',
    licenciaRequerida: vehiculo?.licenciaRequerida || '',
    estado: vehiculo?.estado || 'disponible',
    combustibleTipo: vehiculo?.combustibleTipo || 'Diésel',
    rendimiento: vehiculo?.rendimiento || 10
  });
  const [gastoForm, setGastoForm] = useState({ tipo: 'reparacion', detalle: '', monto: '', fecha: todayISO(), files: [] });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingGasto, setSavingGasto] = useState(false);

  const gastosVehiculo = gastos.filter(item => item.vehiculoId === vehiculo.id);
  const adjuntosVehiculo = gastosVehiculo.flatMap(item => item.adjuntos || []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setGasto = (k, v) => setGastoForm(prev => ({ ...prev, [k]: v }));
  const inp = { width:'100%', padding:'9px 12px', background:T.card2, border:`1px solid ${T.bdr2}`, borderRadius:8, color:T.txt, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:6 };
  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16, width:'100%', maxWidth:760, padding:28, maxHeight:'90vh', overflowY:'auto' };

  async function handleImageSelect(file) {
    try {
      setUploading(true);
      const uploadedPath = await onUploadImage(file);
      set('foto_url', uploadedPath);
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  async function submitGasto() {
    if (!gastoForm.detalle.trim()) return setError('El detalle del gasto es requerido.');
    if (!gastoForm.monto || isNaN(Number(gastoForm.monto))) return setError('El monto del gasto es invalido.');
    try {
      setSavingGasto(true);
      const adjuntos = [];
      for (const file of gastoForm.files) {
        const path = await onUploadGastoAdjunto(file);
        adjuntos.push({ nombreOriginal: file.name, archivoPath: path, mimeType: file.type || null });
      }
      await onAddGasto({
        vehiculoId: vehiculo.id,
        tipo: gastoForm.tipo,
        detalle: gastoForm.detalle.trim(),
        monto: Number(gastoForm.monto),
        fecha: gastoForm.fecha,
        adjuntos,
      });
      setGastoForm({ tipo: 'reparacion', detalle: '', monto: '', fecha: todayISO(), files: [] });
      setError('');
      setTab('gastos');
    } catch (err) {
      setError(err.message || 'No se pudo guardar el gasto.');
    } finally {
      setSavingGasto(false);
    }
  }

  function submit() {
    if (form.km === '' || isNaN(Number(form.km)) || Number(form.km) < 0) {
      return setError('El kilometraje actual debe ser un número válido mayor o igual a 0.');
    }
    setError('');
    onConfirm(vehiculo.id, {
      km: Number(form.km),
      revTec: form.revTec || null,
      revTec2: form.revTec2 || null,
      march: null,
      licenciaRequerida: form.licenciaRequerida || null,
      estado: form.estado,
      foto_url: form.foto_url.trim() || null,
      combustibleTipo: form.combustibleTipo,
      rendimiento: Number(form.rendimiento) || 0,
    });
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>Gestionar vehiculo</div>
            <div style={{ fontSize:12, color:T.mute, marginTop:4 }}>{vehiculo.placa} · {vehiculo.marca} {vehiculo.modelo}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
          {[
            ['general', 'General'],
            ['gastos', 'Gastos y reparaciones'],
            ['adjuntos', 'Adjuntos'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding:'8px 12px', borderRadius:10, border:`1px solid ${tab === id ? T.AMB : T.bdr2}`, background:tab === id ? T.ambDim : T.card2, color:tab === id ? T.AMB : T.sub, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ width:'100%', maxWidth:460, alignSelf:'center' }}>
              <label style={lbl}>IMAGEN DE LA UNIDAD</label>
              <VehicleImageInput imageUrl={form.foto_url} onFileSelect={handleImageSelect} loading={uploading} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(12, minmax(0,1fr))', gap:12 }}>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>ESTADO</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="disponible">disponible</option>
                  <option value="en_servicio">en_servicio</option>
                  <option value="mantenimiento">mantenimiento</option>
                  <option value="fuera_de_servicio">fuera_de_servicio</option>
                </select>
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>KILOMETRAJE ACTUAL</label>
                <input style={inp} type="number" min="0" value={form.km} onChange={e => set('km', e.target.value)} />
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>LICENCIA REQUERIDA</label>
                <select value={form.licenciaRequerida} onChange={e => set('licenciaRequerida', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Sin filtro de licencia</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>TIPO DE COMBUSTIBLE</label>
                <select value={form.combustibleTipo} onChange={e => set('combustibleTipo', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="Súper">Súper</option>
                  <option value="Regular">Regular (Plus 91)</option>
                  <option value="Diésel">Diésel</option>
                </select>
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>RENDIMIENTO (KM/L)</label>
                <input style={inp} type="number" step="0.1" value={form.rendimiento} onChange={e => set('rendimiento', e.target.value)} />
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>REV. TÉCNICA 1</label>
                <input style={inp} type="date" value={form.revTec} onChange={e => set('revTec', e.target.value)} />
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>REV. TÉCNICA 2</label>
                <input style={inp} type="date" value={form.revTec2} onChange={e => set('revTec2', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'gastos' && (
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 320px', gap:18 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {gastosVehiculo.length === 0 && <div style={{ fontSize:13, color:T.mute }}>No hay gastos registrados para esta unidad.</div>}
              {gastosVehiculo.map(gasto => (
                <div key={gasto.id} style={{ padding:'12px 14px', borderRadius:12, background:T.card2, border:`1px solid ${T.bdr}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:T.txt }}>{gasto.detalle}</div>
                      <div style={{ fontSize:11, color:T.mute, marginTop:4 }}>{gasto.fecha} · {gasto.tipo}</div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:800, color:T.AMB }}>${Number(gasto.monto || 0).toFixed(2)}</div>
                  </div>
                  {!!gasto.adjuntos?.length && <div style={{ marginTop:10 }}><AdjuntosList adjuntos={gasto.adjuntos} /></div>}
                </div>
              ))}
            </div>
            <div style={{ padding:'14px', borderRadius:12, background:T.card2, border:`1px solid ${T.bdr}`, height:'fit-content' }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.txt, marginBottom:12 }}>Agregar gasto</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>TIPO</label>
                  <select value={gastoForm.tipo} onChange={e => setGasto('tipo', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="reparacion">reparacion</option>
                    <option value="repuesto">repuesto</option>
                    <option value="mantenimiento">mantenimiento</option>
                    <option value="otro">otro</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>DETALLE</label>
                  <textarea value={gastoForm.detalle} onChange={e => setGasto('detalle', e.target.value)} style={{ ...inp, minHeight:90, resize:'vertical' }} />
                </div>
                <div style={{ display:'flex', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <label style={lbl}>MONTO</label>
                    <input type="number" value={gastoForm.monto} onChange={e => setGasto('monto', e.target.value)} style={inp} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={lbl}>FECHA</label>
                    <input type="date" value={gastoForm.fecha} onChange={e => setGasto('fecha', e.target.value)} style={inp} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>ADJUNTOS</label>
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e => setGasto('files', Array.from(e.target.files || []))} style={inp} />
                  {gastoForm.files.length > 0 && <div style={{ marginTop:8, fontSize:12, color:T.mute }}>{gastoForm.files.length} archivo(s) seleccionado(s)</div>}
                </div>
                <button onClick={submitGasto} disabled={savingGasto} style={{ padding:'10px 16px', background:T.AMB, border:'none', borderRadius:10, color:'#000', cursor:savingGasto ? 'wait' : 'pointer', fontWeight:700 }}>
                  {savingGasto ? 'Guardando...' : 'Guardar gasto'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'adjuntos' && <AdjuntosList adjuntos={adjuntosVehiculo} />}

        {error && <div style={{ marginTop:14, padding:'8px 12px', background:T.redDim, borderRadius:8, fontSize:12, color:T.RED, border:`1px solid ${T.RED}33` }}>{error}</div>}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:22 }}>
          <div>
            {canDelete && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Eliminar permanentemente el vehículo ${vehiculo.placa}? Esta acción no se puede deshacer.`)) return;
                  await onDelete?.(vehiculo.id);
                  onClose();
                }}
                style={{ width:34, height:34, display:'inline-flex', alignItems:'center', justifyContent:'center',
                  background:T.redDim, border:`1px solid ${T.RED}33`, borderRadius:8, color:T.RED, cursor:'pointer' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`, borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>Cancelar</button>
            {tab === 'general' && <button onClick={submit} style={{ padding:'10px 20px', background:T.AMB, border:'none', borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>{form.estado === 'disponible' && vehiculo.estado === 'fuera_de_servicio' ? 'Reactivar unidad' : 'Guardar cambios'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function VehiculosView({ vehiculos, conductores, onAdd, onBaja, onUpdate, onUploadImage, gastos, onAddGasto, onUploadGastoAdjunto, onDelete, canDelete = false, apiFetch, onFocusTask }) {
  const [filtroEst, setFiltro] = useState('todos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [bajaTarget, setBajaTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);

  const filtrados = filtroEst === 'todos' ? vehiculos : vehiculos.filter(v => v.estado === filtroEst);

  function alertLevel(dateStr) {
    const d = daysUntil(dateStr);
    if (d < 0)  return [T.RED,   T.redDim, 'Vencida'];
    if (d < 30) return [T.AMB,   T.ambDim, `${d}d`];
    if (d < 60) return [T.ORG,   T.orgDim, `${d}d`];
    return [T.GRN, T.grnDim, `${d}d`];
  }

  const fmtDate = (s) => {
    if (!s) return '—';
    if (s.includes('-')) return s.split('-').reverse().join('/');
    return s;
  };

  const counts = { todos: vehiculos.length };
  vehiculos.forEach(v => { counts[v.estado] = (counts[v.estado] || 0) + 1; });

  const filtros = [
    { val:'todos',            label:`Todos (${counts.todos})` },
    { val:'disponible',       label:`Disponibles (${counts.disponible || 0})` },
    { val:'en_servicio',      label:`En servicio (${counts.en_servicio || 0})` },
    { val:'mantenimiento',    label:`Mantenimiento (${counts.mantenimiento || 0})` },
    { val:'fuera_de_servicio',label:`Fuera servicio (${counts.fuera_de_servicio || 0})` },
  ];

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total unidades"    value={vehiculos.length}               icon={Bus}         color={T.txt} />
        <StatCard label="Disponibles"       value={counts.disponible || 0}         icon={CheckCircle} color={T.GRN} />
        <StatCard label="En servicio"       value={counts.en_servicio || 0}        icon={Zap}         color={T.BLU} />
        <StatCard label="En mantenimiento"  value={counts.mantenimiento || 0}      icon={Wrench}      color={T.AMB} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {filtros.map(f => (
              <button key={f.val} onClick={() => setFiltro(f.val)}
                style={{ padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer',
                  background: filtroEst === f.val ? T.AMB : T.card2,
                  border:`1px solid ${filtroEst === f.val ? T.AMB : T.bdr2}`,
                  color: filtroEst === f.val ? '#000' : T.sub }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModalNuevo(true)}
            style={{ padding:'8px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`,
              borderRadius:8, color:T.AMB, cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Registrar vehículo
          </button>
        </div>

        {filtrados.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:T.mute, fontSize:13 }}>No hay vehículos en esta categoría.</div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
          {filtrados.map(v => {
            const cond = conductores.find(c => c.id === v.condId);
            const regulatoryDates = getVehicleRegulatoryDates(v);
            const [rcol, rbg, rdias] = alertLevel(regulatoryDates.nextRevision);
            const fuera = v.estado === 'fuera_de_servicio';
            return (
              <div key={v.id} style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px', opacity: fuera ? 0.55 : 1 }}>
                {v.foto_url && (
                  <div style={{
                    marginBottom:14,
                    borderRadius:10,
                    overflow:'hidden',
                    border:`1px solid ${T.bdr}`,
                    background:`linear-gradient(180deg, ${T.card}, ${T.card3})`,
                    height:170,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    padding:12,
                    boxSizing:'border-box',
                  }}>
                    <img
                      src={v.foto_url}
                      alt={`${v.marca} ${v.modelo}`}
                      style={{
                        width:'100%',
                        height:'100%',
                        objectFit:'contain',
                        objectPosition:'center',
                        display:'block',
                        borderRadius:8,
                      }}
                    />
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div>
                    <div style={{ fontFamily:'monospace', fontSize:16, fontWeight:700, color: fuera ? T.mute : T.AMB, letterSpacing:.5 }}>{v.placa}</div>
                    <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{v.marca} {v.modelo}</div>
                  </div>
                  <Badge estado={v.estado} />
                </div>
                <div style={{ display:'flex', gap:12, marginBottom:14, fontSize:12 }}>
                  <span style={{ background:T.card3, padding:'3px 8px', borderRadius:6, color:T.sub }}>{v.tipo}</span>
                  <span style={{ background:T.card3, padding:'3px 8px', borderRadius:6, color:T.sub }}>{v.cap} plazas</span>
                  <span style={{ background:T.card3, padding:'3px 8px', borderRadius:6, color:T.mute }}>{(v.km||0).toLocaleString()} km</span>
                </div>
                {v.licenciaRequerida && (
                  <div style={{ marginBottom:12, fontSize:12, color:T.sub }}>
                    Licencia requerida: <strong style={{ color:T.AMB }}>{v.licenciaRequerida}</strong>
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, padding:'8px 10px',
                  background:T.card3, borderRadius:8 }}>
                  <User size={13} color={T.mute} />
                  <span style={{ fontSize:12, color: cond ? T.txt : T.mute }}>
                    {cond ? cond.nombre : 'Sin conductor asignado'}
                  </span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px',
                    background:rbg, borderRadius:6, border:`1px solid ${rcol}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Shield size={12} color={rcol} />
                      <span style={{ fontSize:11, color:T.sub }}>
                        Rev. técnica · {regulatoryDates.nextRevision ? fmtDate(regulatoryDates.nextRevision) : 'Sin fechas'}
                      </span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:rcol }}>{rdias === 'Vencida' ? '⚠ VENCIDA' : rdias}</span>
                  </div>
                  {(regulatoryDates.revTecPrimary || regulatoryDates.revTecSecondary) && (
                    <div style={{ fontSize:11, color:T.mute, padding:'0 2px' }}>
                      Rev. técnica anual: {[
                        regulatoryDates.revTecPrimary ? formatRecurringDayMonth(regulatoryDates.revTecPrimary) : null,
                        regulatoryDates.revTecSecondary ? formatRecurringDayMonth(regulatoryDates.revTecSecondary) : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button
                    onClick={() => setReportTarget(v)}
                    style={{ flex:'1 1 100%', padding:'7px 0', background:T.bluDim,
                      border:`1px solid ${T.BLU}44`,
                      borderRadius:7, color:T.BLU,
                      cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    Ver reporte mensual
                  </button>
                  <button
                    disabled={false}
                    onClick={() => setEditTarget(v)}
                    style={{ flex:1, padding:'7px 0', background: fuera ? T.bluDim : T.ambDim,
                      border:`1px solid ${fuera ? T.BLU+'44' : T.AMB+'44'}`,
                      borderRadius:7, color: fuera ? T.BLU : T.AMB,
                      cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    {fuera ? 'Reactivar' : 'Editar'}
                  </button>
                  <button
                    disabled={fuera}
                    onClick={() => setBajaTarget({ id: v.id, nombre: v.placa })}
                    style={{ flex:1, padding:'7px 0', background: fuera ? 'transparent' : T.redDim,
                      border:`1px solid ${fuera ? T.bdr : T.RED+'44'}`,
                      borderRadius:7, color: fuera ? T.mute : T.RED,
                      cursor: fuera ? 'default' : 'pointer', fontSize:12, fontWeight:600 }}>
                    {fuera ? 'Fuera de servicio' : 'Dar de baja'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalNuevo && (
        <NuevoVehiculoModal
          onClose={() => setModalNuevo(false)}
          onUploadImage={onUploadImage}
          onConfirm={datos => { onAdd(datos); setModalNuevo(false); }}
        />
      )}
      {editTarget && (
        <EditarVehiculoModal
          vehiculo={editTarget}
          onClose={() => setEditTarget(null)}
          onUploadImage={onUploadImage}
          gastos={gastos}
          onAddGasto={onAddGasto}
          onUploadGastoAdjunto={onUploadGastoAdjunto}
          onDelete={onDelete}
          canDelete={canDelete}
          onConfirm={async (id, datos) => {
            await onUpdate(id, datos);
            setEditTarget(null);
          }}
        />
      )}
      {bajaTarget && (
        <ConfirmBajaModal
          nombre={bajaTarget.nombre}
          tipo="vehículo"
          onClose={() => setBajaTarget(null)}
          onConfirm={() => { onBaja(bajaTarget.id); setBajaTarget(null); }}
        />
      )}
      {reportTarget && <MonthlyReportModal apiFetch={apiFetch} type="vehiculo" target={reportTarget} onClose={() => setReportTarget(null)} onFocusTask={onFocusTask} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVO EVENTO
// ─────────────────────────────────────────────────────────────
function NuevoEventoModal({
  onClose,
  onConfirm,
  title = 'Nuevo evento',
  submitLabel = 'Crear evento',
  initialValues,
  description,
}) {
  const EMPTY = { nombre:'', cliente:'', inicio:'', fin:'', pax:'', prio:'normal', estado:'planificado' };
  const [form, setForm] = useState({ ...EMPTY, ...(initialValues || {}) });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inp  = { width:'100%', padding:'9px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
    borderRadius:8, color:T.txt, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl  = { fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:6 };
  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16,
    width:'100%', maxWidth:520, padding:28, maxHeight:'90vh', overflowY:'auto' };

  function submit() {
    if (!form.nombre.trim()) return setError('El nombre es requerido.');
    if (!form.cliente.trim()) return setError('El cliente es requerido.');
    if (!form.inicio || !form.fin) return setError('Las fechas son requeridas.');
    if (!form.pax || isNaN(+form.pax)) return setError('El número de pasajeros es inválido.');
    setError('');
    // Convertir YYYY-MM-DD → DD/MM para el backend
    const toSlash = (d) => d.split('-').slice(1).reverse().join('/');
    onConfirm({
      nombre: form.nombre.trim(),
      cliente: form.cliente.trim(),
      inicio: toSlash(form.inicio),
      fin: toSlash(form.fin),
      pax: +form.pax,
      prio: form.prio,
      estado: form.estado,
    });
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>{title}</div>
              {description && <div style={{ fontSize:12, color:T.mute, marginTop:4 }}>{description}</div>}
            </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>NOMBRE DEL EVENTO *</label>
            <input style={inp} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Tour Volcán Poás – Grupo Alemania" />
          </div>
          <div>
            <label style={lbl}>CLIENTE *</label>
            <input style={inp} value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nombre del cliente o empresa" />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>FECHA INICIO *</label>
              <input style={inp} type="date" value={form.inicio} onChange={e => set('inicio', e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>FECHA FIN *</label>
              <input style={inp} type="date" value={form.fin} onChange={e => set('fin', e.target.value)} />
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>PASAJEROS *</label>
              <input style={inp} type="number" min="1" value={form.pax} onChange={e => set('pax', e.target.value)} placeholder="Ej: 20" />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>PRIORIDAD</label>
              <select style={{ ...inp, cursor:'pointer' }} value={form.prio} onChange={e => set('prio', e.target.value)}>
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>ESTADO</label>
              <select style={{ ...inp, cursor:'pointer' }} value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="planificado">Planificado</option>
                <option value="confirmado">Confirmado</option>
                <option value="en_curso">En curso</option>
              </select>
            </div>
          </div>
        </div>
        {error && (
          <div style={{ marginTop:14, padding:'8px 12px', background:T.redDim, borderRadius:8,
            fontSize:12, color:T.RED, border:`1px solid ${T.RED}33` }}>{error}</div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
          <button onClick={onClose} style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
            borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={submit} style={{ padding:'10px 20px', background:T.AMB, border:'none',
            borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVA TAREA
// ─────────────────────────────────────────────────────────────
function NuevaTareaModal({ onClose, onConfirm, eventos, conductores, vehiculos }) {
  const EMPTY = { nombre:'', hora:'08:00', fin:'09:00', eventoId:'', condId:'', vehId:'', pax:'', origen:'', destino:'' };
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inp = { width:'100%', padding:'9px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
    borderRadius:8, color:T.txt, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:6 };
  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:999, padding:20 };
  const panel = { background:T.card, border:`1px solid ${T.bdr2}`, borderRadius:16,
    width:'100%', maxWidth:540, padding:28, maxHeight:'90vh', overflowY:'auto' };

  function submit() {
    if (!form.nombre.trim()) return setError('El nombre de la tarea es requerido.');
    const hora = normalizeTimeInput(form.hora);
    const fin = normalizeTimeInput(form.fin);
    if (!hora || !fin) return setError('Las horas de inicio y fin deben tener un formato valido.');
    if (hora >= fin) return setError('La hora de fin debe ser mayor que la de inicio.');
    if (!form.pax || isNaN(+form.pax) || +form.pax < 1) return setError('El número de pasajeros es inválido.');
    setError('');
    onConfirm({
      nombre:   form.nombre.trim(),
      hora,
      fin,
      eventoId: form.eventoId || null,
      condId:   form.condId   || null,
      vehId:    form.vehId    || null,
      pax:      +form.pax,
      origen:   form.origen.trim(),
      destino:  form.destino.trim(),
    });
  }

  const condsActivos = conductores.filter(c => !['inactivo','suspendido'].includes(c.estado));
  const vehsActivos  = vehiculos.filter(v => v.estado !== 'fuera_de_servicio');

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>Nueva tarea</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>NOMBRE DE LA TAREA *</label>
            <input style={inp} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Recogida aeropuerto SJO" />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>HORA INICIO *</label>
              <input style={inp} type="time" value={normalizeTimeInput(form.hora)} onChange={e => set('hora', normalizeTimeInput(e.target.value))} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>HORA FIN *</label>
              <input style={inp} type="time" value={normalizeTimeInput(form.fin)} onChange={e => set('fin', normalizeTimeInput(e.target.value))} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>PASAJEROS *</label>
              <input style={inp} type="number" min="1" value={form.pax} onChange={e => set('pax', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>ORIGEN</label>
              <input style={inp} value={form.origen} onChange={e => set('origen', e.target.value)} placeholder="Punto de partida" />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>DESTINO</label>
              <input style={inp} value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Punto de llegada" />
            </div>
          </div>
          <div>
            <label style={lbl}>EVENTO (opcional)</label>
            <select style={{ ...inp, cursor:'pointer' }} value={form.eventoId} onChange={e => set('eventoId', e.target.value)}>
              <option value="">— Sin evento asociado —</option>
              {eventos.filter(e => !['finalizado','cancelado'].includes(e.estado)).map(e => (
                <option key={e.id} value={e.id}>{e.nombre} · {e.cliente}</option>
              ))}
            </select>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>CONDUCTOR (opcional)</label>
              <select style={{ ...inp, cursor:'pointer' }} value={form.condId} onChange={e => set('condId', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {condsActivos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({LC[c.estado]?.[0]})</option>
                ))}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>VEHÍCULO (opcional)</label>
              <select style={{ ...inp, cursor:'pointer' }} value={form.vehId} onChange={e => set('vehId', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vehsActivos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo} ({v.cap} pax)</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {error && (
          <div style={{ marginTop:14, padding:'8px 12px', background:T.redDim, borderRadius:8,
            fontSize:12, color:T.RED, border:`1px solid ${T.RED}33` }}>{error}</div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
          <button onClick={onClose} style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`,
            borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={submit} style={{ padding:'10px 20px', background:T.AMB, border:'none',
            borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>Crear tarea</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: EVENTOS
// ─────────────────────────────────────────────────────────────
function EventosView({ eventos, onAdd }) {
  const priColors = { alta:[T.RED,T.redDim], urgente:[T.ORG,T.orgDim], normal:[T.AMB,T.ambDim], baja:[T.mute,'rgba(100,116,139,0.1)'] };
  const [modalNuevo, setModalNuevo] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const filtrados = filtro === 'todos' ? eventos : eventos.filter(e => e.estado === filtro);
  const counts = { todos: eventos.length };
  eventos.forEach(e => { counts[e.estado] = (counts[e.estado]||0)+1; });

  const filtros = [
    { val:'todos',       label:`Todos (${counts.todos})` },
    { val:'en_curso',    label:`En curso (${counts.en_curso||0})` },
    { val:'confirmado',  label:`Confirmados (${counts.confirmado||0})` },
    { val:'planificado', label:`Planificados (${counts.planificado||0})` },
    { val:'finalizado',  label:`Finalizados (${counts.finalizado||0})` },
  ];

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total eventos" value={eventos.length}        icon={CalendarDays} color={T.txt} />
        <StatCard label="En curso"      value={counts.en_curso||0}    icon={Zap}         color={T.BLU} />
        <StatCard label="Confirmados"   value={counts.confirmado||0}  icon={CheckCircle} color={T.AMB} />
        <StatCard label="Planificados"  value={counts.planificado||0} icon={Clock}       color={T.mute} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {filtros.map(f => (
              <button key={f.val} onClick={() => setFiltro(f.val)}
                style={{ padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer',
                  background: filtro === f.val ? T.AMB : T.card2,
                  border:`1px solid ${filtro === f.val ? T.AMB : T.bdr2}`,
                  color: filtro === f.val ? '#000' : T.sub }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModalNuevo(true)}
            style={{ padding:'8px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`,
              borderRadius:8, color:T.AMB, cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Nuevo evento
          </button>
        </div>

        {filtrados.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:T.mute, fontSize:13 }}>No hay eventos en esta categoría.</div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtrados.map(e => {
            const pct = e.tareas > 0 ? Math.round((Number(e.ok) / Number(e.tareas)) * 100) : 0;
            const [pcol, pbg] = priColors[e.prio] ?? [T.mute, T.bdr];
            return (
              <div key={e.id} style={{ padding:'16px 18px', background:T.card2, borderRadius:12, border:`1px solid ${T.bdr}` }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15, fontWeight:600, color:T.txt }}>{e.nombre}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        color:pcol, background:pbg, letterSpacing:.3 }}>{(e.prio||'').toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize:12, color:T.mute }}>{e.cliente} · {e.inicio} → {e.fin} · {e.pax} pax</div>
                  </div>
                  <Badge estado={e.estado} />
                </div>
                <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ flex:1, height:6, background:T.bdr2, borderRadius:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, borderRadius:6,
                      background: pct === 100 ? T.GRN : pct > 50 ? T.BLU : T.AMB }} />
                  </div>
                  <span style={{ fontSize:12, color:T.sub, whiteSpace:'nowrap' }}>
                    {e.ok} / {e.tareas} tareas ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalNuevo && (
        <NuevoEventoModal
          onClose={() => setModalNuevo(false)}
          onConfirm={datos => { onAdd(datos); setModalNuevo(false); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: TAREAS
// ─────────────────────────────────────────────────────────────
function TareasView({ tareas, conductores, vehiculos, eventos, onAsignar, onAddTarea, selectedDate, onDateChange, scope, onScopeChange, focusedTaskId, focusedEventId, onCreateEventFromTasks, onUpdateTaskStatus }) {
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEvento, setModalEvento] = useState(false);
  const [modalEstado, setModalEstado] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [condFilter, setCondFilter] = useState('');
  const [vehFilter, setVehFilter] = useState('');

  useEffect(() => {
    if (!focusedTaskId) return;
    const node = document.getElementById(`task-card-${focusedTaskId}`);
    if (node) node.scrollIntoView({ behavior:'smooth', block:'center' });
  }, [focusedTaskId, tareas]);

  const filtradas = useMemo(() => tareas.filter(t => {
    const matchEstado = filtro === 'todos' || t.estado === filtro;
    const q = search.trim().toLowerCase();
    const event = eventos.find(e => e.id === t.eventoId);
    const matchSearch = !q || [
      t.nombre,
      t.origen,
      t.destino,
      event?.cliente,
      event?.clienteNombre,
      event?.clienteEmpresa,
      event?.contactoNombre,
      event?.contactoTelefono,
      conductores.find(c => c.id === t.condId)?.nombre,
      conductores.find(c => c.id === t.condId)?.alias,
      vehiculos.find(v => v.id === t.vehId)?.placa,
      vehiculos.find(v => v.id === t.vehId)?.marca,
      vehiculos.find(v => v.id === t.vehId)?.modelo,
    ].some(v => String(v || '').toLowerCase().includes(q));
    const matchCond = !condFilter || t.condId === condFilter;
    const matchVeh = !vehFilter || t.vehId === vehFilter;
    return matchEstado && matchSearch && matchCond && matchVeh;
  }), [tareas, filtro, search, condFilter, vehFilter, eventos, conductores, vehiculos]);

  const counts = { todos: tareas.length };
  tareas.forEach(t => { counts[t.estado] = (counts[t.estado] || 0) + 1; });
  const sinCond = tareas.filter(t => t.estado === 'pendiente' && !t.condId).length;
  const filtros = [
    { val:'todos', label:`Todas (${counts.todos})` },
    { val:'pendiente', label:`Pendientes (${counts.pendiente || 0})` },
    { val:'asignada', label:`Asignadas (${counts.asignada || 0})` },
    { val:'en_ruta', label:`En ruta (${counts.en_ruta || 0})` },
    { val:'completada', label:`Completadas (${counts.completada || 0})` },
  ];

  const grouped = useMemo(() => {
    const map = new Map();
    sortTasksByStart(filtradas).forEach(t => {
      const key = t.eventoId || '__sin_evento__';
      if (!map.has(key)) map.set(key, { key, evento: eventos.find(e => e.id === t.eventoId) || null, tareas: [] });
      map.get(key).tareas.push(t);
    });
    return [...map.values()].sort((a, b) => {
      if (a.key === '__sin_evento__') return 1;
      if (b.key === '__sin_evento__') return -1;
      return String(a.evento?.nombre || '').localeCompare(String(b.evento?.nombre || ''));
    });
  }, [filtradas, eventos]);

  const selectedSet = new Set(selectedIds);
  const selectedTasks = sortTasksByStart(tareas.filter(t => selectedSet.has(t.id)));
  const activeTaskId = focusedTaskId || (selectedTaskId && tareas.some(t => t.id === selectedTaskId) ? selectedTaskId : null) || tareas[0]?.id || null;
  const detailTask = tareas.find(t => t.id === activeTaskId) || null;
  const detailEvent = eventos.find(e => e.id === detailTask?.eventoId) || null;
  const detailCond = conductores.find(c => c.id === detailTask?.condId) || null;
  const detailVeh = vehiculos.find(v => v.id === detailTask?.vehId) || null;
  const mapSrc = detailTask
    ? `https://www.google.com/maps?q=${encodeURIComponent([detailTask.origen, detailTask.destino].filter(Boolean).join(' to '))}&output=embed`
    : '';

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total del día" value={tareas.length} sub={`${counts.completada || 0} completadas`} icon={CheckSquare} color={T.txt} />
        <StatCard label="En ruta" value={counts.en_ruta || 0} sub="activas en esta fecha" icon={Zap} color={T.BLU} />
        <StatCard label="Sin conductor" value={sinCond} sub="requieren asignación" icon={AlertTriangle} color={sinCond > 0 ? T.RED : T.GRN} />
        <StatCard label="Con evento" value={tareas.filter(t => t.eventoId).length} sub={`${grouped.filter(g => g.evento).length} grupos`} icon={CalendarDays} color={T.AMB} />
      </div>

        <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:18, padding:'22px 24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:12, color:T.mute, textTransform:'capitalize' }}>{formatRangeLabel(selectedDate, scope)} · {tareas.length} operaciones</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {[['Hoy', todayISO()], ['Mañana', addDaysISO(todayISO(), 1)], ['Ayer', addDaysISO(todayISO(), -1)]].map(([label, date]) => (
              <button key={label} onClick={() => onDateChange(date)} style={{ padding:'7px 11px', borderRadius:999, border:`1px solid ${selectedDate === date ? T.AMB : T.bdr2}`, background:selectedDate === date ? T.AMB : T.card2, color:selectedDate === date ? '#000' : T.sub, fontSize:12, fontWeight:700, cursor:'pointer' }}>{label}</button>
            ))}
            {['day','week','month'].map(item => (
              <button key={item} onClick={() => onScopeChange(item)} style={{ padding:'7px 11px', borderRadius:999, border:`1px solid ${scope === item ? T.BLU : T.bdr2}`, background:scope === item ? T.bluDim : T.card2, color:scope === item ? T.BLU : T.sub, fontSize:12, fontWeight:700, cursor:'pointer' }}>{item === 'day' ? 'Día' : item === 'week' ? 'Semana' : 'Mes'}</button>
            ))}
            <input type="date" value={selectedDate} onChange={e => onDateChange(e.target.value)} style={{ padding:'9px 12px', borderRadius:10, background:T.card2, border:`1px solid ${T.bdr2}`, color:T.txt }} />
            <button onClick={() => setModalNuevo(true)} style={{ padding:'9px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`, borderRadius:10, color:T.AMB, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}><Plus size={14}/> Nueva tarea</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:T.card2, border:`1px solid ${T.bdr2}`, borderRadius:10, padding:'10px 12px', flex:1, minWidth:220 }}>
            <Search size={14} color={T.mute}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarea, origen, destino..." style={{ background:'transparent', border:'none', outline:'none', color:T.txt, fontSize:13, flex:1 }}/>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {filtros.map(f => <button key={f.val} onClick={() => setFiltro(f.val)} style={{ padding:'7px 11px', borderRadius:9, border:`1px solid ${filtro === f.val ? T.AMB : T.bdr2}`, background:filtro === f.val ? T.AMB : T.card2, color:filtro === f.val ? '#000' : T.sub, fontSize:12, fontWeight:700, cursor:'pointer' }}>{f.label}</button>)}
          </div>
          <select value={condFilter} onChange={e => setCondFilter(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, background:T.card2, border:`1px solid ${T.bdr2}`, color:T.txt, fontSize:13 }}>
            <option value="">Todos los conductores</option>
            {conductores.map(cond => <option key={cond.id} value={cond.id}>{cond.nombre}</option>)}
          </select>
          <select value={vehFilter} onChange={e => setVehFilter(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, background:T.card2, border:`1px solid ${T.bdr2}`, color:T.txt, fontSize:13 }}>
            <option value="">Todos los vehículos</option>
            {vehiculos.map(veh => <option key={veh.id} value={veh.id}>{veh.placa} · {veh.marca} {veh.modelo}</option>)}
          </select>
        </div>

        {selectedIds.length > 0 && <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:16, padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))', border:`1px solid ${T.bdr}` }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, color:T.sub, fontSize:12, cursor:'pointer' }}>
            {selectedIds.length} tareas seleccionadas
          </label>
          <div style={{ display:'flex', gap:8 }}>
            {selectedIds.length > 0 && <button onClick={() => setSelectedIds([])} style={{ padding:'8px 12px', background:'transparent', border:`1px solid ${T.bdr2}`, borderRadius:10, color:T.sub, cursor:'pointer', fontSize:12, fontWeight:700 }}>Limpiar</button>}
            {selectedIds.length > 0 && <button onClick={() => setModalEvento(true)} style={{ padding:'8px 14px', background:`linear-gradient(135deg, ${T.AMB}, #fbbf24)`, border:'none', borderRadius:10, color:'#111827', cursor:'pointer', fontSize:12, fontWeight:800 }}>Crear evento con selección</button>}
          </div>
        </div>}

        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.7fr) minmax(280px,.9fr)', gap:18, alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {grouped.length === 0 && <div style={{ padding:40, textAlign:'center', color:T.mute, fontSize:13, background:T.card2, borderRadius:16, border:`1px dashed ${T.bdr2}` }}>No hay tareas para esta fecha o filtro.</div>}
            {grouped.map(group => {
              const palette = eventPalette(group.evento);
              const focusedGroup = group.evento?.id && group.evento.id === focusedEventId;
              const groupClient = getEventClientSummary(group.evento);
              return (
                <div key={group.key} style={{ borderRadius:18, overflow:'hidden', border:`1px solid ${palette.border}`, boxShadow:focusedGroup ? `0 0 0 1px ${palette.border}, 0 18px 40px ${palette.glow}` : `0 12px 32px ${palette.glow}`, background:group.evento ? palette.bg : T.card2 }}>
                  <div style={{ padding:'16px 18px', borderLeft:`6px solid ${palette.border}`, borderBottom:`1px solid ${T.bdr}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontSize:15, fontWeight:800, color:T.txt }}>{group.evento?.nombre || 'Operaciones sin evento'}</span>
                          <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999, background:palette.pill, color:palette.text }}>{group.evento ? 'EVENTO' : 'SUELTAS'}</span>
                          {group.evento && <Badge estado={group.evento.estado} />}
                        </div>
                        <div style={{ fontSize:12, color:T.mute, marginTop:5 }}>
                          {group.evento ? `${group.evento.inicio} → ${group.evento.fin}` : 'Agrúpalas para darles contexto operativo y visual.'}
                        </div>
                        {group.evento && (
                          <>
                            <div style={{ fontSize:12, color:T.sub, marginTop:6 }}>{groupClient.clientLine || 'Sin cliente asociado'}</div>
                            {groupClient.contactLine && <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>{groupClient.contactLine}</div>}
                          </>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:T.sub }}>{group.tareas.length} tareas</div>
                    </div>
                  </div>
                  <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                    {group.tareas.map(t => {
                      const cond = conductores.find(c => c.id === t.condId);
                      const veh = vehiculos.find(v => v.id === t.vehId);
                      const selected = selectedTaskId === t.id;
                      const focused = focusedTaskId === t.id;
                      const sinA = t.estado === 'pendiente' && !t.condId;
                      return (
                        <div id={`task-card-${t.id}`} key={t.id} onClick={() => setSelectedTaskId(t.id)} style={{ padding:'14px 16px', borderRadius:16, cursor:'pointer', border:`1px solid ${selected ? palette.border : T.bdr}`, background:selected ? 'rgba(15,23,42,0.86)' : 'rgba(15,23,42,0.54)', boxShadow:focused ? `0 0 0 1px ${palette.border}, 0 14px 30px ${palette.glow}` : 'none' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'auto minmax(0,1fr) auto', gap:12, alignItems:'start' }}>
                            <label onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedSet.has(t.id)} onChange={() => setSelectedIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} /></label>
                            <div>
                              <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                                <span style={{ fontFamily:'monospace', fontSize:13, color:T.AMB, fontWeight:800 }}>{t.hora}</span>
                                <span style={{ fontSize:14, fontWeight:700, color:T.txt }}>{t.nombre}</span>
                                {focused && <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999, background:T.ambDim, color:T.AMB }}>EN FOCO</span>}
                              </div>
                              <div style={{ fontSize:12, color:T.sub, marginTop:7 }}>{t.origen || 'Sin origen'} {t.origen && t.destino ? '→' : ''} {t.destino || 'Sin destino'}</div>
                              <div style={{ fontSize:11, color:T.mute, marginTop:6 }}>{t.hora} → {t.fin} · {t.pax} pax · {cond ? (cond.alias || cond.nombre.split(' ')[0]) : 'Sin conductor'} · {veh ? veh.placa : 'Sin vehículo'}</div>
                              {sinA && <div style={{ display:'inline-flex', marginTop:8, padding:'4px 8px', borderRadius:999, background:T.redDim, color:T.RED, fontSize:11, fontWeight:700 }}>Sin asignación completa</div>}
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                              <Badge estado={t.estado} />
                              {['pendiente', 'asignada'].includes(t.estado) && <button onClick={(e) => { e.stopPropagation(); onAsignar(t); }} style={{ fontSize:12, padding:'7px 10px', background:T.ambDim, border:`1px solid ${T.AMB}44`, borderRadius:8, color:T.AMB, cursor:'pointer', fontWeight:700 }}>{t.condId || t.vehId ? 'Gestionar' : 'Asignar'}</button>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ position:'sticky', top:12 }}>
            <div style={{ background:'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(17,24,39,0.96))', border:`1px solid ${T.bdr}`, borderRadius:18, padding:18 }}>
              <div style={{ fontSize:12, color:T.mute, letterSpacing:.4, marginBottom:10 }}>DETALLE</div>
              {!detailTask && <div style={{ color:T.mute, fontSize:13 }}>Selecciona una tarea para verla aquí.</div>}
              {detailTask && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:18, fontWeight:800, color:T.txt }}>{detailTask.nombre}</span>
                      <Badge estado={detailTask.estado} />
                    </div>
                    <div style={{ fontSize:12, color:T.mute, marginTop:5 }}>{detailTask.fecha} · {detailTask.hora} → {detailTask.fin}</div>
                  </div>
                  <div style={{ padding:'12px 14px', borderRadius:14, background:detailEvent ? eventPalette(detailEvent).pill : T.card2, border:`1px solid ${detailEvent ? eventPalette(detailEvent).border : T.bdr}` }}>
                    <div style={{ fontSize:11, color:T.mute }}>EVENTO</div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.txt, marginTop:4 }}>{detailEvent?.nombre || 'Sin evento asociado'}</div>
                    <div style={{ fontSize:12, color:T.sub, marginTop:4 }}>{detailEvent ? `${detailEvent.inicio} → ${detailEvent.fin}` : 'Puedes agruparla seleccionando varias tareas.'}</div>
                    {detailEvent && (
                      <>
                        <div style={{ fontSize:12, color:T.txt, marginTop:8 }}>{getEventClientSummary(detailEvent).clientLine || 'Sin cliente asociado'}</div>
                        {getEventClientSummary(detailEvent).contactLine && (
                          <div style={{ fontSize:11, color:T.mute, marginTop:3 }}>{getEventClientSummary(detailEvent).contactLine}</div>
                        )}
                      </>
                    )}
                  </div>
                    <div style={{ padding:'12px 14px', borderRadius:14, background:T.card2, border:`1px solid ${T.bdr}`, fontSize:12, color:T.sub }}>
                      <div>Ruta: <strong style={{ color:T.txt }}>{detailTask.origen || 'Sin origen'} → {detailTask.destino || 'Sin destino'}</strong></div>
                      <div style={{ marginTop:6 }}>Pasajeros: <strong style={{ color:T.txt }}>{detailTask.pax || 0}</strong></div>
                      <div style={{ marginTop:6 }}>Conductor: <strong style={{ color:T.txt }}>{detailCond?.nombre || 'Sin asignar'}</strong></div>
                      <div style={{ marginTop:6 }}>Vehículo: <strong style={{ color:T.txt }}>{detailVeh ? `${detailVeh.placa} · ${detailVeh.marca} ${detailVeh.modelo}` : 'Sin asignar'}</strong></div>
                      {detailTask.notas && <div style={{ marginTop:6 }}>Comentarios: <strong style={{ color:T.txt }}>{detailTask.notas}</strong></div>}
                    </div>
                  {mapSrc && (
                    <div style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${T.bdr}`, background:T.card2 }}>
                      <iframe title="Mapa de tarea" src={mapSrc} style={{ width:'100%', height:180, border:'none' }} loading="lazy" />
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={() => setModalEstado(detailTask)} style={{ padding:'10px 12px', background:T.bluDim, border:`1px solid ${T.BLU}44`, borderRadius:10, color:T.BLU, cursor:'pointer', fontWeight:800 }}>Cambiar estado</button>
                    {detailTask.estado !== 'completada' && <button onClick={() => setModalEstado({ ...detailTask, estado:'completada' })} style={{ padding:'10px 12px', background:T.grnDim, border:`1px solid ${T.GRN}44`, borderRadius:10, color:T.GRN, cursor:'pointer', fontWeight:800 }}>Finalizar / comentar</button>}
                  </div>
                  {['pendiente', 'asignada'].includes(detailTask.estado) && <button onClick={() => onAsignar(detailTask)} style={{ padding:'11px 14px', background:`linear-gradient(135deg, ${T.AMB}, #fbbf24)`, border:'none', borderRadius:12, color:'#111827', cursor:'pointer', fontWeight:800 }}>Gestionar esta tarea</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalNuevo && <NuevaTareaModal onClose={() => setModalNuevo(false)} onConfirm={async datos => { await onAddTarea({ ...datos, fecha: selectedDate }); setModalNuevo(false); }} eventos={eventos} conductores={conductores} vehiculos={vehiculos} />}
      {modalEvento && <NuevoEventoModal onClose={() => setModalEvento(false)} title="Crear evento desde tareas" submitLabel="Crear y agrupar" description={`${selectedTasks.length} tareas seleccionadas serán agrupadas en un solo evento.`} initialValues={{ nombre:selectedTasks[0]?.nombre || '', cliente:(selectedTasks[0]?.eventoId ? (eventos.find(e => e.id === selectedTasks[0].eventoId)?.clienteEmpresa || eventos.find(e => e.id === selectedTasks[0].eventoId)?.cliente || '') : ''), inicio:selectedTasks[0]?.fecha || selectedDate, fin:selectedTasks[selectedTasks.length - 1]?.fecha || selectedDate, pax:selectedTasks.reduce((sum, task) => sum + Number(task.pax || 0), 0) }} onConfirm={async datos => { await onCreateEventFromTasks(datos, selectedTasks); setSelectedIds([]); setModalEvento(false); }} />}
      {modalEstado && <TaskStatusModal tarea={modalEstado} onClose={() => setModalEstado(null)} onConfirm={async payload => { await onUpdateTaskStatus(modalEstado, payload); setModalEstado(null); }} />}
    </div>
  );
}

function ReportMetricCard({ label, value, sub, color = T.txt }) {
  return (
    <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'14px 16px', minWidth:140 }}>
      <div style={{ fontSize:11, color:T.mute, fontWeight:700, letterSpacing:.35 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color, marginTop:6, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:T.sub, marginTop:6 }}>{sub}</div>}
    </div>
  );
}

function MonthCalendarCard({ month, calendar, selectedDay, onSelectDay }) {
  const cells = buildMonthGrid(month);
  const statsByDay = useMemo(() => {
    const map = new Map();
    (calendar || []).forEach(item => map.set(item.fecha, item));
    return map;
  }, [calendar]);

  return (
    <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:16, padding:16 }}>
      <div style={{ fontSize:12, color:T.mute, fontWeight:700, marginBottom:12 }}>CALENDARIO DEL MES</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', gap:8 }}>
        {['Lun','Mar','Mie','Jue','Vie','Sab','Dom'].map(day => (
          <div key={day} style={{ fontSize:11, color:T.mute, textAlign:'center', fontWeight:700 }}>{day}</div>
        ))}
        {cells.map((dateValue, index) => {
          if (!dateValue) {
            return <div key={`empty-${index}`} style={{ minHeight:72, borderRadius:12, background:'rgba(148,163,184,0.05)' }} />;
          }
          const dayStats = statsByDay.get(dateValue);
          const dayNumber = Number(dateValue.slice(-2));
          const selected = selectedDay === dateValue;
          return (
            <button
              type="button"
              key={dateValue}
              onClick={() => onSelectDay?.(dateValue)}
              style={{ minHeight:72, borderRadius:12, padding:'10px 8px', border:`1px solid ${selected ? T.BLU : dayStats ? T.AMB+'33' : T.bdr}`, background:selected ? T.bluDim : dayStats ? T.ambDim : T.card3, textAlign:'left', cursor:'pointer' }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.txt }}>{dayNumber}</div>
              <div style={{ fontSize:11, color:dayStats ? T.sub : T.mute, marginTop:6 }}>
                {dayStats ? `${dayStats.tareas} tareas` : 'Sin carga'}
              </div>
              {dayStats && (
                <div style={{ fontSize:10, color:T.mute, marginTop:4 }}>
                  {dayStats.completadas} ok · {dayStats.eventos} eventos
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyReportModal({ apiFetch, type, target, onClose, onFocusTask }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [selectedDay, setSelectedDay] = useState('');
  const autoMonthAdjustedRef = useRef(false);

  useEffect(() => {
    autoMonthAdjustedRef.current = false;
    setMonth(currentMonthKey());
    setSelectedDay('');
  }, [target?.id, type]);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      if (!target?.id) return;
      setLoading(true);
      setError('');
      try {
        const basePath = type === 'vehiculo' ? `${API}/reportes/vehiculos/${target.id}` : `${API}/reportes/conductores/${target.id}`;
        const payload = await apiFetch(`${basePath}?month=${encodeURIComponent(month)}`);
        if (!cancelled) setReport(payload);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el reporte.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();
    return () => { cancelled = true; };
  }, [apiFetch, month, target?.id, type]);

  useEffect(() => {
    if (autoMonthAdjustedRef.current) return;
    if (!report?.latestMonth) return;
    if ((report?.tasks?.length || 0) > 0) return;
    if (report.latestMonth === month) return;
    autoMonthAdjustedRef.current = true;
    setMonth(report.latestMonth);
  }, [month, report]);

  const meta = type === 'vehiculo'
    ? {
      title: report?.vehiculo ? `${report.vehiculo.placa} · ${report.vehiculo.marca} ${report.vehiculo.modelo}` : (target?.placa || 'Vehículo'),
      subtitle: report?.vehiculo ? `${report.vehiculo.tipo} · ${report.vehiculo.cap} plazas` : 'Detalle operativo mensual',
    }
    : {
      title: report?.conductor?.nombre || target?.nombre || 'Conductor',
      subtitle: report?.conductor?.alias ? `Alias: ${report.conductor.alias}` : 'Detalle operativo mensual',
    };

  const summary = report?.summary || {};
  const tasks = report?.tasks || [];
  const events = report?.events || [];
  const availableDays = useMemo(() => {
    const values = new Set();
    tasks.forEach(task => {
      if (task?.fecha) values.add(task.fecha);
    });
    (report?.calendar || []).forEach(item => {
      if (item?.fecha) values.add(item.fecha);
    });
    return Array.from(values).sort();
  }, [report?.calendar, tasks]);

  useEffect(() => {
    if (!availableDays.length) {
      if (selectedDay) setSelectedDay('');
      return;
    }
    if (!selectedDay || !availableDays.includes(selectedDay)) {
      setSelectedDay(availableDays[0]);
    }
  }, [availableDays, selectedDay]);

  const filteredTasks = selectedDay
    ? tasks.filter(task => task.fecha === selectedDay)
    : tasks;
  const filteredEvents = selectedDay
    ? events.filter(eventItem => Array.isArray(eventItem.fechas) && eventItem.fechas.includes(selectedDay))
    : events;
  const selectedDayLabel = selectedDay ? formatLongDate(selectedDay, { month: 'long' }) : 'Todo el mes';

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.76)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'min(1200px, 100%)', maxHeight:'92vh', overflow:'auto', background:`linear-gradient(180deg, ${T.card}, ${T.card2})`, border:`1px solid ${T.bdr}`, borderRadius:24, padding:24, boxShadow:'0 30px 80px rgba(15,23,42,0.45)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', marginBottom:18, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:T.txt }}>{meta.title}</div>
            <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>{meta.subtitle}</div>
            <div style={{ fontSize:12, color:T.mute, marginTop:6 }}>
              Reporte mensual operativo. Los kilómetros todavía no se calculan aquí porque la tarea no persiste una distancia confiable por servicio.
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => setMonth(prev => addMonthsKey(prev, -1))} style={{ width:36, height:36, borderRadius:10, border:`1px solid ${T.bdr2}`, background:T.card2, color:T.txt, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ minWidth:190, textAlign:'center', padding:'8px 12px', borderRadius:10, border:`1px solid ${T.bdr2}`, background:T.card2, color:T.txt, fontWeight:800, textTransform:'capitalize' }}>
              {formatMonthLabel(month)}
            </div>
            <button onClick={() => setMonth(prev => addMonthsKey(prev, 1))} style={{ width:36, height:36, borderRadius:10, border:`1px solid ${T.bdr2}`, background:T.card2, color:T.txt, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <ChevronRight size={16} />
            </button>
            <button onClick={onClose} style={{ width:40, height:40, borderRadius:12, border:`1px solid ${T.bdr2}`, background:'transparent', color:T.mute, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {loading && <div style={{ padding:'28px 0', color:T.mute, fontSize:13 }}>Cargando reporte mensual…</div>}
        {!loading && error && <div style={{ padding:'14px 16px', borderRadius:14, background:T.redDim, border:`1px solid ${T.RED}33`, color:T.RED, fontSize:13 }}>{error}</div>}
        {!loading && !error && report && (
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <ReportMetricCard label="Tareas del mes" value={summary.totalTareas || 0} />
              <ReportMetricCard label="Completadas" value={summary.completadas || 0} color={T.GRN} />
              <ReportMetricCard label="Eventos asociados" value={summary.eventosAsociados || 0} color={T.BLU} />
              <ReportMetricCard label="Dias activos" value={summary.diasActivos || 0} color={T.AMB} />
              <ReportMetricCard label="Pasajeros" value={summary.pasajeros || 0} />
              <ReportMetricCard
                label="Kilometros"
                value="Pendiente"
                sub="Falta distancia persistida por tarea"
                color={T.mute}
              />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.1fr) minmax(320px, .9fr)', gap:18, alignItems:'start' }}>
              <MonthCalendarCard month={month} calendar={report.calendar} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:12, color:T.mute, fontWeight:700, marginBottom:10 }}>RESUMEN CONFIABLE</div>
                  <div style={{ fontSize:13, color:T.sub }}>Pendientes: <strong style={{ color:T.txt }}>{summary.pendientes || 0}</strong></div>
                  <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>Asignadas: <strong style={{ color:T.txt }}>{summary.asignadas || 0}</strong></div>
                  <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>En ruta: <strong style={{ color:T.txt }}>{summary.enRuta || 0}</strong></div>
                  <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>Incidencias: <strong style={{ color:T.txt }}>{summary.incidencias || 0}</strong></div>
                  <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>Sin evento: <strong style={{ color:T.txt }}>{summary.tareasSinEvento || 0}</strong></div>
                  {type === 'vehiculo' && (
                    <div style={{ fontSize:13, color:T.sub, marginTop:10 }}>
                      Kilometraje actual unidad: <strong style={{ color:T.txt }}>{Number(report?.vehiculo?.km_actual || 0).toLocaleString()} km</strong>
                    </div>
                  )}
                  {type === 'conductor' && report?.conductor?.vehiculoAsignadoPlaca && (
                    <div style={{ fontSize:13, color:T.sub, marginTop:10 }}>
                      Unidad base: <strong style={{ color:T.txt }}>{report.conductor.vehiculoAsignadoPlaca}</strong>
                    </div>
                  )}
                </div>

                <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:12, color:T.mute, fontWeight:700, marginBottom:10 }}>ACLARACION</div>
                  <div style={{ fontSize:13, color:T.sub, lineHeight:1.6 }}>
                    Este reporte separa solo relaciones operativas confiables.
                    No suma kilómetros mensuales todavía porque la estructura actual no guarda una distancia persistida en cada tarea ejecutada.
                  </div>
                  {!!report?.activityMonths?.length && (
                    <div style={{ fontSize:12, color:T.mute, marginTop:10 }}>
                      Meses con actividad: {report.activityMonths.join(', ')}
                    </div>
                  )}
                </div>

                <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:12, color:T.mute, fontWeight:700, marginBottom:10 }}>DETALLE DEL DIA</div>
                  <div style={{ fontSize:14, fontWeight:800, color:T.txt, textTransform:'capitalize' }}>{selectedDayLabel}</div>
                  <div style={{ fontSize:12, color:T.sub, marginTop:6 }}>
                    {selectedDay
                      ? `${filteredTasks.length} tarea${filteredTasks.length === 1 ? '' : 's'} y ${filteredEvents.length} evento${filteredEvents.length === 1 ? '' : 's'} en la fecha seleccionada.`
                      : 'Selecciona un día en el calendario para revisar la carga puntual.'}
                  </div>
                  {selectedDay && filteredTasks.length === 0 && (
                    <div style={{ fontSize:12, color:T.mute, marginTop:10 }}>
                      Ese día no tiene tareas asociadas para este registro.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:18, padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.txt }}>{selectedDay ? 'Eventos del día seleccionado' : 'Eventos programados del mes'}</div>
                <div style={{ fontSize:12, color:T.mute }}>{filteredEvents.length} eventos</div>
              </div>
              {filteredEvents.length === 0 ? (
                <div style={{ padding:'10px 0', color:T.mute, fontSize:13 }}>
                  {selectedDay ? 'No hay eventos asociados en ese día.' : 'No hay eventos asociados en este mes para este registro.'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {filteredEvents.map(eventItem => (
                    <div key={eventItem.id} style={{ border:`1px solid ${T.bdr}`, borderRadius:14, padding:'14px 16px', background:T.card3 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:800, color:T.txt }}>{eventItem.nombre}</div>
                          <div style={{ fontSize:12, color:T.sub, marginTop:5 }}>{eventItem.cliente || 'Sin cliente identificado'}</div>
                          <div style={{ fontSize:11, color:T.mute, marginTop:5 }}>
                            {eventItem.tareas} tareas vinculadas · {eventItem.fechas.join(', ')}
                          </div>
                        </div>
                        <Badge estado={eventItem.estado} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:18, padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.txt }}>{selectedDay ? 'Tareas del día seleccionado' : 'Detalle de tareas del mes'}</div>
                <div style={{ fontSize:12, color:T.mute }}>{filteredTasks.length} registros</div>
              </div>
              {filteredTasks.length === 0 ? (
                <div style={{ padding:'18px 0', color:T.mute, fontSize:13 }}>
                  {selectedDay ? 'No hay tareas asociadas en ese día.' : 'No hay tareas asociadas en este mes.'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {filteredTasks.map(task => (
                    <div key={task.id} style={{ border:`1px solid ${T.bdr}`, borderRadius:14, padding:'14px 16px', background:T.card3 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                        <div>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'monospace', fontSize:12, color:T.AMB, fontWeight:800 }}>{task.fecha} · {task.hora}</span>
                            <span style={{ fontSize:14, fontWeight:700, color:T.txt }}>{task.nombre}</span>
                          </div>
                          <div style={{ fontSize:12, color:T.sub, marginTop:6 }}>{task.origen || 'Sin origen'} {task.origen && task.destino ? '→' : ''} {task.destino || 'Sin destino'}</div>
                          <div style={{ fontSize:11, color:T.mute, marginTop:6 }}>
                            {task.eventoNombre ? `${task.eventoNombre} · ${task.cliente || 'Sin cliente'}` : 'Sin evento asociado'} · {task.pax || 0} pax
                          </div>
                          <div style={{ fontSize:11, color:T.mute, marginTop:4 }}>
                            {type === 'vehiculo'
                              ? (task.conductorNombre ? `Conductor: ${task.conductorNombre}` : 'Sin conductor asignado')
                              : (task.vehiculoPlaca ? `Vehiculo: ${task.vehiculoPlaca}${task.vehiculoNombre ? ` · ${task.vehiculoNombre}` : ''}` : 'Sin vehículo asignado')}
                          </div>
                          {task.notas && <div style={{ fontSize:11, color:T.sub, marginTop:6 }}>Notas: {task.notas}</div>}
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                          <Badge estado={task.estado} />
                          <button
                            type="button"
                            onClick={() => onFocusTask?.(task)}
                            style={{ padding:'8px 10px', background:T.bluDim, border:`1px solid ${T.BLU}44`, borderRadius:8, color:T.BLU, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                            Abrir tarea
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportesView({ apiFetch }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiFetch(`${API}/reportes/resumen?month=${encodeURIComponent(month)}`);
        if (!cancelled) setReport(payload);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el tablero de reportes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSummary();
    return () => { cancelled = true; };
  }, [apiFetch, month]);

  const totals = report?.totals || {};

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:24, fontWeight:900, color:T.txt }}>Reportes operativos</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>
            Tablero mensual de carga por unidad y por conductor, usando solo relaciones confiables del sistema actual.
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setMonth(prev => addMonthsKey(prev, -1))} style={{ width:38, height:38, borderRadius:10, border:`1px solid ${T.bdr2}`, background:T.card2, color:T.txt, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ minWidth:200, textAlign:'center', padding:'9px 12px', borderRadius:10, border:`1px solid ${T.bdr2}`, background:T.card2, color:T.txt, fontWeight:800, textTransform:'capitalize' }}>
            {formatMonthLabel(month)}
          </div>
          <button onClick={() => setMonth(prev => addMonthsKey(prev, 1))} style={{ width:38, height:38, borderRadius:10, border:`1px solid ${T.bdr2}`, background:T.card2, color:T.txt, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading && <div style={{ color:T.mute, fontSize:13 }}>Cargando tablero mensual…</div>}
      {!loading && error && <div style={{ padding:'14px 16px', borderRadius:14, background:T.redDim, border:`1px solid ${T.RED}33`, color:T.RED, fontSize:13 }}>{error}</div>}
      {!loading && !error && report && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <StatCard label="Tareas del mes" value={totals.totalTareas || 0} icon={CheckSquare} color={T.txt} />
            <StatCard label="Completadas" value={totals.completadas || 0} icon={CheckCircle} color={T.GRN} />
            <StatCard label="En ruta" value={totals.enRuta || 0} icon={Zap} color={T.BLU} />
            <StatCard label="Eventos" value={totals.eventos || 0} icon={CalendarDays} color={T.AMB} />
            <StatCard label="Pasajeros" value={totals.pasajeros || 0} icon={Users} color={T.txt} />
          </div>

          <div style={{ padding:'12px 14px', borderRadius:14, background:T.card2, border:`1px solid ${T.bdr}` }}>
            <div style={{ fontSize:12, color:T.mute }}>
              Kilómetros mensuales: pendientes de consolidación estructural. La tarea todavía no persiste una distancia verificable por servicio.
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:18 }}>
            <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:18, padding:18 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.txt, marginBottom:14 }}>Carga por vehículo</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(report.vehiculos || []).map(item => (
                  <div key={item.id} style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontFamily:'monospace', fontSize:15, fontWeight:800, color:T.AMB }}>{item.placa}</div>
                        <div style={{ fontSize:12, color:T.sub, marginTop:4 }}>{item.marca} {item.modelo}</div>
                      </div>
                      <Badge estado={item.estado} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10, marginTop:12 }}>
                      <div><div style={{ fontSize:10, color:T.mute }}>Tareas</div><div style={{ fontSize:16, fontWeight:800, color:T.txt }}>{item.tareas}</div></div>
                      <div><div style={{ fontSize:10, color:T.mute }}>OK</div><div style={{ fontSize:16, fontWeight:800, color:T.GRN }}>{item.completadas}</div></div>
                      <div><div style={{ fontSize:10, color:T.mute }}>Eventos</div><div style={{ fontSize:16, fontWeight:800, color:T.BLU }}>{item.eventos}</div></div>
                      <div><div style={{ fontSize:10, color:T.mute }}>Dias</div><div style={{ fontSize:16, fontWeight:800, color:T.AMB }}>{item.diasActivos}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:18, padding:18 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.txt, marginBottom:14 }}>Carga por conductor</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(report.conductores || []).map(item => (
                  <div key={item.id} style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:800, color:T.txt }}>{item.nombre}</div>
                        <div style={{ fontSize:12, color:T.sub, marginTop:4 }}>{item.alias || 'Sin alias'}</div>
                      </div>
                      <Badge estado={item.estado} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10, marginTop:12 }}>
                      <div><div style={{ fontSize:10, color:T.mute }}>Tareas</div><div style={{ fontSize:16, fontWeight:800, color:T.txt }}>{item.tareas}</div></div>
                      <div><div style={{ fontSize:10, color:T.mute }}>OK</div><div style={{ fontSize:16, fontWeight:800, color:T.GRN }}>{item.completadas}</div></div>
                      <div><div style={{ fontSize:10, color:T.mute }}>Eventos</div><div style={{ fontSize:16, fontWeight:800, color:T.BLU }}>{item.eventos}</div></div>
                      <div><div style={{ fontSize:10, color:T.mute }}>Dias</div><div style={{ fontSize:16, fontWeight:800, color:T.AMB }}>{item.diasActivos}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
const ROOT_TAB_ITEMS = [
    { id:'dashboard',   Icon:LayoutDashboard, label:'Dashboard'      },
    { id:'socios',      Icon:User,            label:'Socios'          },
    { id:'cotizaciones',Icon:Calculator,      label:'Proformas'      },
    { id:'eventos',     Icon:CalendarDays,    label:'Eventos'        },
    { id:'tareas',      Icon:CheckSquare,     label:'Tareas'         },
    { id:'gantt',       Icon:BarChart3,       label:'Línea de tiempo'},
    { id:'conductores', Icon:Users,           label:'Conductores'    },
    { id:'vehiculos',   Icon:Bus,             label:'Vehículos'      },
    { id:'gastos',      Icon:Receipt,         label:'Gastos'         },
    { id:'reportes',    Icon:BarChart3,       label:'Reportes'       },
    { id:'usuarios',    Icon:Shield,          label:'Seguridad'      , role: 'admin' },
    { id:'config',      Icon:Settings,        label:'Configuración'  , role: 'admin' },
];

function Sidebar({ active, onOpenView, user, onLogout }) {
  const items = ROOT_TAB_ITEMS;

  const filteredItems = items.filter(item => !item.role || item.role === user?.rol);

  return (
    <div style={{ width:220, background:T.card, borderRight:`1px solid ${T.bdr}`,
      display:'flex', flexDirection:'column', flexShrink:0, height:'100vh', position:'sticky', top:0 }}>
      <div style={{ padding:'20px 20px 16px', borderBottom:`1px solid ${T.bdr}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:T.AMB,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bus size={18} color="#000" />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.txt, letterSpacing:.3 }}>TransOp</div>
            <div style={{ fontSize:10, color:T.mute }}>Panel de control</div>
          </div>
        </div>
      </div>

      <nav style={{ padding:'12px 10px', flex:1 }}>
        {filteredItems.map(({ id, Icon: MenuIcon, label }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onOpenView(id)}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px',
                borderRadius:8, border:'none', cursor:'pointer', marginBottom:2, textAlign:'left',
                background: isActive ? T.ambDim : 'transparent',
                color: isActive ? T.AMB : T.mute, fontWeight: isActive ? 600 : 400, fontSize:13 }}>
              {createElement(MenuIcon, { size: 16 })}
              {label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding:'16px', borderTop:`1px solid ${T.bdr}`, background:T.card2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <img
            src={user?.foto_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}
            style={{ width:32, height:32, borderRadius:8, objectFit:'cover', border:`1px solid ${T.bdr2}` }}
            alt="User"
          />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, color:T.txt, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.nombre || 'Operador'}
            </div>
            <div style={{ fontSize:10, color:T.mute }}>{user?.rol === 'admin' ? 'Administrador' : 'Operador'}</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ width:'100%', padding:'6px', background:'rgba(239,68,68,0.1)', color:T.RED,
            border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ALERTAS TOP BAR
// ─────────────────────────────────────────────────────────────
function AlertBar({ tareas }) {
  const sinAsig = tareas.filter(t => t.estado === 'pendiente' && !t.condId);
  if (sinAsig.length === 0) return null;
  return (
    <div style={{ background:T.ambDim, borderBottom:`1px solid ${T.AMB}33`, padding:'10px 24px',
      display:'flex', alignItems:'center', gap:10 }}>
      <AlertTriangle size={14} color={T.AMB} />
      <span style={{ fontSize:13, color:T.AMB, fontWeight:500 }}>
        {sinAsig.length} tarea{sinAsig.length > 1 ? 's' : ''} pendiente{sinAsig.length > 1 ? 's' : ''} sin conductor asignado hoy
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GANTT TOOLTIP
// ─────────────────────────────────────────────────────────────
const GANTT_ESTADO_COLOR = {
  completada:  { bg: 'var(--GRN)',  txt: '#fff'   },
  en_ruta:     { bg: 'var(--BLU)',  txt: '#fff'   },
  asignada:    { bg: 'var(--AMB)',  txt: '#000'   },
  pendiente:   { bg: 'var(--mute)', txt: 'var(--txt)' },
  cancelada:   { bg: 'var(--RED)',  txt: '#fff'   },
  incidencia:  { bg: 'var(--ORG)',  txt: '#fff'   },
};
const toMinApp = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };

function GanttTooltip({ tooltip }) {
  if (!tooltip) return null;
  const { tarea, evento, cond, veh, x, y } = tooltip;
  const col = GANTT_ESTADO_COLOR[tarea.estado] ?? GANTT_ESTADO_COLOR.pendiente;
  return (
    <div style={{
      position: 'fixed',
      left: Math.min(x, window.innerWidth - 268),
      top:  Math.min(y, window.innerHeight - 320),
      zIndex: 99999,
      background: T.card,
      border: `1px solid ${T.bdr2}`,
      borderRadius: 10,
      padding: '12px 14px',
      width: 240,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      pointerEvents: 'none',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.txt, flex:1, marginRight:8 }}>{tarea.nombre}</div>
        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
          background:col.bg, color:col.txt, whiteSpace:'nowrap' }}>
          {tarea.estado.replace('_',' ').toUpperCase()}
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:T.sub }}>
          <Clock size={11} color={T.mute}/>
          {tarea.hora} → {tarea.fin}
          <span style={{ marginLeft:4, fontSize:11, color:T.mute }}>
            ({toMinApp(tarea.fin) - toMinApp(tarea.hora)} min)
          </span>
        </div>
        {(tarea.origen || tarea.destino) && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:12, color:T.sub }}>
            <MapPin size={11} color={T.mute} style={{ marginTop:1, flexShrink:0 }}/>
            <span>{tarea.origen} → {tarea.destino}</span>
          </div>
        )}
        {evento && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:T.sub }}>
            <CalendarDays size={11} color={T.mute}/>
            {evento.cliente}
          </div>
        )}
        {cond && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:T.sub }}>
            <Users size={11} color={T.mute}/>
            {cond.nombre}
          </div>
        )}
        {veh && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:T.sub }}>
            <Bus size={11} color={T.mute}/>
            {veh.placa} · {veh.marca} {veh.modelo}
          </div>
        )}
        {tarea.pax && (
          <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>{tarea.pax} pasajeros</div>
        )}
        {tarea.estado === 'pendiente' && !tarea.condId && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11,
            color:T.AMB, background:T.ambDim, borderRadius:6, padding:'4px 8px', marginTop:4 }}>
            <AlertTriangle size={11}/> Sin conductor asignado
          </div>
        )}
      </div>
    </div>
  );
}

function GastosView({ gastos, vehiculos }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
      {gastos.length === 0 ? (
        <div style={{ padding:30, textAlign:'center', color:T.mute, fontSize:13 }}>Aun no hay gastos registrados.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gastos.map(gasto => {
            const vehiculo = vehiculos.find(item => item.id === gasto.vehiculoId);
            return (
              <div key={gasto.id} style={{ padding:'12px 14px', background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.txt }}>{gasto.detalle}</div>
                    <div style={{ fontSize:11, color:T.mute, marginTop:4 }}>{vehiculo?.placa || 'Sin unidad'} · {gasto.fecha} · {gasto.tipo}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:T.AMB }}>${Number(gasto.monto || 0).toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlaceholderView({ icono: PlaceholderIcon }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:400, gap:16 }}>
      {createElement(PlaceholderIcon, { size: 48, color: T.mute })}
      <div style={{ fontSize:13, color:T.mute }}>Módulo en desarrollo — próxima sesión</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP CONTENT (PROTECTED) — sin datos locales, todo desde API
// ─────────────────────────────────────────────────────────────
function AppContent() {
  const { isAuthenticated, user, token, logout } = useAuth();
  const { tabs, activeTabId, openTab, closeTab, updateTabData, getTabData } = useTabs();
  const [selectedTaskDate, setSelectedTaskDate] = useState(todayISO());
  const [taskScope, setTaskScope] = useState('day');
  const [tareas,      setTareas]    = useState([]);
  const [conductores, setConductores] = useState([]);
  const [vehiculos,   setVehiculos] = useState([]);
  const [eventos,     setEventos]   = useState([]);
  const [gastos,      setGastos]    = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [modalTarea,  setModal]     = useState(null);
  const [theme,       setTheme]     = useState('dark');
  const [ganttTooltip, setGanttTooltip] = useState(null);
  const [voiceDraft,  setVoiceDraft] = useState(null);
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [focusedEventId, setFocusedEventId] = useState(null);
  const [cotizadorHeaderMeta, setCotizadorHeaderMeta] = useState({ tc: null });
  const rootTabs = useMemo(() => tabs.filter(tab => tab.scope === 'root'), [tabs]);
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || null, [activeTabId, tabs]);
  const activeRootTab = useMemo(() => rootTabs.find(tab => tab.id === activeTabId) || rootTabs[0] || null, [activeTabId, rootTabs]);
  const view = activeTab?.scope === 'root' ? activeTab?.view : activeTab?.parentView || activeRootTab?.view || null;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const openRootView = useCallback((viewId) => {
    const item = ROOT_TAB_ITEMS.find(entry => entry.id === viewId);
    if (!item) return;
    openTab({
      id: `root-${viewId}`,
      scope: 'root',
      view: viewId,
      label: item.label,
      icon: item.Icon,
      closable: true,
    });
  }, [openTab]);

  // ── Helper para llamadas autenticadas ──────────────────────
  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = payload?.error || payload?.message || `API error ${res.status}: ${path}`;
      throw new Error(detail);
    }
    return payload;
  }, [token]);

  const resolveClienteIdForEvento = useCallback(async (clienteNombre) => {
    const normalized = String(clienteNombre || '').trim().toLowerCase();
    if (!normalized) return null;

    const socios = await apiFetch(`${API}/socios`);
    const existing = Array.isArray(socios)
      ? socios.find(item =>
        [item?.nombre, item?.empresa]
          .filter(Boolean)
          .some(value => String(value).trim().toLowerCase() === normalized)
      )
      : null;

    if (existing?.id) return existing.id;

    const created = await apiFetch(`${API}/socios`, {
      method: 'POST',
      body: JSON.stringify({
        nombre: String(clienteNombre || '').trim(),
        empresa: '',
        identificacion: '',
        tipo: 'cliente',
        clasificacion: 'prospecto',
        telefono: '',
        email: '',
        direccion: '',
        notas: 'Creado automaticamente desde eventos.',
      }),
    });

    return created?.id || null;
  }, [apiFetch]);

  const uploadVehiculoImage = useCallback(async (file) => {
    if (!file) throw new Error('No se selecciono ninguna imagen.');
    const dataUrl = await fileToDataUrl(file);
    const payload = await apiFetch(`${API}/uploads/vehiculos`, {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        dataUrl,
      }),
    });
    return payload?.path || '';
  }, [apiFetch]);

  const uploadGastoAdjunto = useCallback(async (file) => {
    if (!file) throw new Error('No se selecciono ningun adjunto.');
    const dataUrl = await fileToDataUrl(file);
    const payload = await apiFetch(`${API}/uploads/gastos`, {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        dataUrl,
      }),
    });
    return payload?.path || '';
  }, [apiFetch]);

  const cargarTareas = useCallback(async (fecha, opts = {}) => {
    if (!token) return [];
    if (!opts.silent) setLoadingTasks(true);
    try {
      const { desde, hasta } = getTaskRangeBounds(fecha, opts.scope || taskScope);
      const query = desde === hasta ? `fecha=${fecha}` : `desde=${desde}&hasta=${hasta}`;
      const data = await apiFetch(`${API}/tareas?${query}`);
      setTareas(sortTasksByStart(data));
      return data;
    } catch (err) {
      console.error('Error cargando tareas:', err);
      return [];
    } finally {
      if (!opts.silent) setLoadingTasks(false);
    }
  }, [apiFetch, token, taskScope]);

  // ── Carga inicial de todos los datos ──────────────────────
  const cargarTodo = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [conds, vehs, evts, tareas, gastosData] = await Promise.all([
        apiFetch(`${API}/conductores`),
        apiFetch(`${API}/vehiculos`),
        apiFetch(`${API}/eventos`),
        apiFetch(`${API}/tareas?fecha=${selectedTaskDate}`),
        apiFetch(`${API}/gastos`),
      ]);
      setConductores(conds);
      setVehiculos(vehs);
      setEventos(evts);
      setTareas(sortTasksByStart(tareas));
      setGastos(gastosData);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, selectedTaskDate]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (!token || loading) return;
    cargarTareas(selectedTaskDate, { scope: taskScope });
  }, [selectedTaskDate, taskScope, token, loading, cargarTareas]);

  const handleVoiceInterpretation = useCallback((interpretation, transcript) => {
    const draft = normalizeVoiceInterpretation(interpretation, transcript);
    setVoiceDraft(draft);
    if (draft.route && draft.route !== view) {
      openRootView(draft.route);
    }
  }, [openRootView, view]);

  const handleVoiceDraftApplied = useCallback((draftId) => {
    setVoiceDraft(prev => (prev?.id === draftId ? null : prev));
  }, []);

  const handleOpenSocioTab = useCallback((socio) => {
    if (!socio?.id) return;
    const tabId = `socio-${socio.id}`;
    updateTabData(tabId, { socioId: socio.id });
    openTab({
      id: tabId,
      scope: 'detail',
      parentView: 'socios',
      view: 'socio-detalle',
      label: socio.nombre || `Socio ${socio.id}`,
      closable: true,
    });
  }, [openTab, updateTabData]);

  const handleOpenProformaTab = useCallback((tabConfig, snapshot) => {
    if (!tabConfig?.id) return;
    const existingTab = (tabConfig.sourceId || snapshot?.selectedId)
      ? tabs.find(item => item.view === 'proforma-detalle' && (item.sourceId === tabConfig.sourceId || item.sourceId === snapshot?.selectedId))
      : null;
    const targetTabId = existingTab?.id || tabConfig.id;
    updateTabData(targetTabId, snapshot || {});
    openTab({
      id: targetTabId,
      scope: 'detail',
      parentView: 'cotizaciones',
      view: 'proforma-detalle',
      label: tabConfig.label || 'Nueva proforma',
      sourceId: tabConfig.sourceId || snapshot?.selectedId || existingTab?.sourceId || null,
      closable: true,
    });
  }, [openTab, tabs, updateTabData]);

  const handleProformaSnapshotChange = useCallback((tabId, snapshot) => {
    if (!tabId) return;
    updateTabData(tabId, snapshot || {});
  }, [updateTabData]);

  const handleProformaTabMetaChange = useCallback((tabId, meta) => {
    if (!tabId) return;
    if (meta?.snapshot) {
      updateTabData(tabId, meta.snapshot);
    }
    openTab({
      id: tabId,
      scope: 'detail',
      parentView: 'cotizaciones',
      view: 'proforma-detalle',
      label: meta?.label || 'Nueva proforma',
      sourceId: meta?.sourceId || null,
      closable: true,
    });
  }, [openTab, updateTabData]);

  // ── Handlers que persisten en la BD ───────────────────────
  function handleAsignar(tarea) { setModal(tarea); }

  function focusTaskInPlanner(task) {
    if (!task?.id) return;
    setFocusedTaskId(task.id);
    setFocusedEventId(task.eventoId || null);
    setSelectedTaskDate(task.fecha || todayISO());
    openRootView('tareas');
  }

  function handleTaskDateChange(nextDate) {
    setFocusedTaskId(null);
    setFocusedEventId(null);
    setSelectedTaskDate(nextDate);
  }

  function handleTaskScopeChange(nextScope) {
    setFocusedTaskId(null);
    setFocusedEventId(null);
    setTaskScope(nextScope);
  }

  async function handleConfirm(tareaId, condId, vehId) {
    try {
      const result = await apiFetch(`${API}/tareas/${tareaId}/asignar`, {
        method: 'PATCH',
        body: JSON.stringify({ condId, vehId }),
      });
      setTareas(prev => prev.map(t =>
        t.id === tareaId ? { ...t, condId: condId || null, vehId: vehId || null, estado: result?.estado || (condId && vehId ? 'asignada' : 'pendiente') } : t
      ));
      setModal(null);
    } catch (err) {
      console.error('Error asignando tarea:', err);
    }
  }

  async function handleUpdateTaskStatus(tarea, payload) {
    if (!tarea?.id || !payload?.estado) return;
    await apiFetch(`${API}/tareas/${tarea.id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setTareas(prev => prev.map(item => item.id === tarea.id ? { ...item, estado: payload.estado, notas: payload.notas ?? item.notas } : item));
  }

  async function handleAddEvento(datos) {
    try {
      const clienteId = await resolveClienteIdForEvento(datos.cliente);
      if (!clienteId) {
        throw new Error('No fue posible resolver el cliente del evento.');
      }

      const { id } = await apiFetch(`${API}/eventos`, {
        method: 'POST',
        body: JSON.stringify({ ...datos, clienteId }),
      });
      const nuevoEvento = { id, tareas: 0, ok: 0, ...datos, clienteId };
      setEventos(prev => [...prev, nuevoEvento]);
      return nuevoEvento;
    } catch (err) {
      console.error('Error creando evento:', err);
      throw err;
    }
  }

  async function handleAddTarea(datos, options = {}) {
    try {
      const { id } = await apiFetch(`${API}/tareas`, {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      const nueva = { id, estado:'pendiente', condId: datos.condId || null, vehId: datos.vehId || null, ...datos, fecha: datos.fecha || selectedTaskDate };
      if ((datos.fecha || selectedTaskDate) === selectedTaskDate) {
        setTareas(prev => sortTasksByStart([...prev, nueva]));
      }
      if (datos.eventoId) {
        setEventos(prev => prev.map(e =>
          e.id === datos.eventoId ? { ...e, tareas: Number(e.tareas) + 1 } : e
        ));
      }
      if (options.navigate !== false) {
        focusTaskInPlanner(nueva);
      }
      return nueva;
    } catch (err) {
      console.error('Error creando tarea:', err);
      throw err;
    }
  }

  async function handleCreateEventFromTasks(eventData, tasksToAssociate) {
    const nuevoEvento = await handleAddEvento(eventData);
    const taskIds = tasksToAssociate.map(task => task.id).filter(Boolean);
    if (!nuevoEvento?.id || taskIds.length === 0) return nuevoEvento;

    await apiFetch(`${API}/eventos/${nuevoEvento.id}/tareas`, {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });

    setEventos(prev => prev.map(evento =>
      evento.id === nuevoEvento.id ? { ...evento, tareas: taskIds.length } : evento
    ));
    await cargarTareas(selectedTaskDate);
    setFocusedEventId(nuevoEvento.id);
    if (tasksToAssociate[0]) {
      setFocusedTaskId(tasksToAssociate[0].id);
      openRootView('tareas');
    }
    return nuevoEvento;
  }

  async function handleAddConductor(datos) {
    try {
      const { id } = await apiFetch(`${API}/conductores`, {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      setConductores(prev => [...prev, { id, estado:'disponible', vehId: null, ...datos }]);
    } catch (err) {
      console.error('Error creando conductor:', err);
    }
  }

  async function handleUpdateConductor(id, datos) {
    try {
      await apiFetch(`${API}/conductores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(datos),
      });
      setConductores(prev => prev.map(c => c.id === id ? { ...c, ...datos } : c));
    } catch (err) {
      console.error('Error actualizando conductor:', err);
      throw err;
    }
  }

  async function handleBajaConductor(id) {
    try {
      await apiFetch(`${API}/conductores/${id}/baja`, { method: 'PATCH' });
      setConductores(prev => prev.map(c => c.id === id ? { ...c, estado:'inactivo', vehId: null } : c));
    } catch (err) {
      console.error('Error dando de baja conductor:', err);
    }
  }

  async function handleDeleteConductor(id) {
    try {
      await apiFetch(`${API}/conductores/${id}`, { method: 'DELETE' });
      setConductores(prev => prev.filter(c => c.id !== id));
      setVehiculos(prev => prev.map(v => v.condId === id ? { ...v, condId: null } : v));
      setTareas(prev => prev.map(t => t.condId === id ? { ...t, condId: null } : t));
    } catch (err) {
      console.error('Error eliminando conductor:', err);
      alert(err.message || 'No se pudo eliminar el conductor.');
    }
  }

  async function handleAddVehiculo(datos) {
    try {
      const { id } = await apiFetch(`${API}/vehiculos`, {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      setVehiculos(prev => [...prev, { id, estado:'disponible', condId: null, ...datos }]);
    } catch (err) {
      console.error('Error registrando vehículo:', err);
    }
  }

  async function handleUpdateVehiculo(id, datos) {
    try {
      await apiFetch(`${API}/vehiculos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(datos),
      });
      setVehiculos(prev => prev.map(v => v.id === id ? { ...v, ...datos } : v));
    } catch (err) {
      console.error('Error actualizando vehiculo:', err);
      throw err;
    }
  }

  async function handleBajaVehiculo(id) {
    try {
      await apiFetch(`${API}/vehiculos/${id}/baja`, { method: 'PATCH' });
      setVehiculos(prev => prev.map(v => v.id === id ? { ...v, estado:'fuera_de_servicio', condId: null } : v));
    } catch (err) {
      console.error('Error dando de baja vehículo:', err);
    }
  }

  async function handleDeleteVehiculo(id) {
    try {
      await apiFetch(`${API}/vehiculos/${id}`, { method: 'DELETE' });
      setVehiculos(prev => prev.filter(v => v.id !== id));
      setTareas(prev => prev.map(t => t.vehId === id ? { ...t, vehId: null } : t));
    } catch (err) {
      console.error('Error eliminando vehículo:', err);
      alert(err.message || 'No se pudo eliminar el vehículo.');
    }
  }

  async function handleAddGasto(datos) {
    try {
      const { id } = await apiFetch(`${API}/gastos`, {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      setGastos(prev => [{ id, ...datos }, ...prev]);
    } catch (err) {
      console.error('Error guardando gasto:', err);
      throw err;
    }
  }

  const renderTabView = (tab) => {
    switch (tab.view) {
      case 'dashboard':
        return <Dashboard tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={eventos} onAsignar={handleAsignar} />;
      case 'socios':
        return (
          <SociosView
            voiceDraft={activeRootTab?.view === 'socios' && voiceDraft?.intent === 'socio' ? voiceDraft : null}
            onVoiceDraftApplied={handleVoiceDraftApplied}
            onOpenSocio={handleOpenSocioTab}
          />
        );
      case 'socio-detalle': {
        const tabData = getTabData(tab.id);
        return <SocioDetailView socioId={tabData?.socioId} onCloseTab={() => closeTab(tab.id)} />;
      }
      case 'cotizaciones':
        return (
          <CotizadorView
            voiceDraft={activeRootTab?.view === 'cotizaciones' && voiceDraft?.intent === 'cotizacion' ? voiceDraft : null}
            onVoiceDraftApplied={handleVoiceDraftApplied}
            onHeaderMetaChange={setCotizadorHeaderMeta}
            onCreateEvento={handleAddEvento}
            onCreateTarea={handleAddTarea}
            onFocusTask={focusTaskInPlanner}
            mode="root"
            onOpenProforma={handleOpenProformaTab}
          />
        );
      case 'proforma-detalle': {
        const tabData = getTabData(tab.id);
        return (
          <CotizadorView
            onHeaderMetaChange={setCotizadorHeaderMeta}
            onCreateEvento={handleAddEvento}
            onCreateTarea={handleAddTarea}
            onFocusTask={focusTaskInPlanner}
            mode="detail"
            initialTabId={tab.id}
            initialTabLabel={tab.label}
            initialSnapshot={tabData}
            onSnapshotChange={(snapshot) => handleProformaSnapshotChange(tab.id, snapshot)}
            onTabMetaChange={(meta) => handleProformaTabMetaChange(tab.id, meta)}
          />
        );
      }
      case 'eventos':
        return <EventosView eventos={eventos} onAdd={handleAddEvento} />;
      case 'tareas':
        return <TareasView key={`${selectedTaskDate}-${taskScope}`} tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={eventos} onAsignar={handleAsignar} onAddTarea={handleAddTarea} selectedDate={selectedTaskDate} onDateChange={handleTaskDateChange} scope={taskScope} onScopeChange={handleTaskScopeChange} focusedTaskId={focusedTaskId} focusedEventId={focusedEventId} onCreateEventFromTasks={handleCreateEventFromTasks} onUpdateTaskStatus={handleUpdateTaskStatus} />;
      case 'gantt':
        return <FlotaGanttView apiFetch={apiFetch} conductores={conductores} vehiculos={vehiculos} eventos={eventos} onTooltipChange={setGanttTooltip} onFocusTask={focusTaskInPlanner} />;
      case 'conductores':
        return <ConductoresView conductores={conductores} tareas={tareas} vehiculos={vehiculos} onAdd={handleAddConductor} onUpdate={handleUpdateConductor} onBaja={handleBajaConductor} onDelete={handleDeleteConductor} canDelete={user?.rol === 'admin'} apiFetch={apiFetch} onFocusTask={focusTaskInPlanner} />;
      case 'vehiculos':
        return <VehiculosView vehiculos={vehiculos} conductores={conductores} onAdd={handleAddVehiculo} onBaja={handleBajaVehiculo} onUpdate={handleUpdateVehiculo} onUploadImage={uploadVehiculoImage} gastos={gastos} onAddGasto={handleAddGasto} onUploadGastoAdjunto={uploadGastoAdjunto} onDelete={handleDeleteVehiculo} canDelete={user?.rol === 'admin'} apiFetch={apiFetch} onFocusTask={focusTaskInPlanner} />;
      case 'usuarios':
        return <UsuarioMgmtView />;
      case 'config':
        return <ConfiguracionesView />;
      case 'gastos':
        return <GastosView gastos={gastos} vehiculos={vehiculos} />;
      case 'reportes':
        return <ReportesView apiFetch={apiFetch} />;
      default:
        return null;
    }
  };

  if (!isAuthenticated) return <LoginView />;
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        minHeight:'100vh', background:T.bg, flexDirection:'column', gap:16 }}>
        <div style={{ width:32, height:32, border:`3px solid ${T.bdr2}`,
          borderTop:`3px solid ${T.AMB}`, borderRadius:'50%',
          animation:'spin 0.8s linear infinite' }} />
        <span style={{ color:T.mute, fontSize:13 }}>Cargando datos…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:T.bg, fontFamily:"system-ui,-apple-system,sans-serif",
      color:T.txt, fontSize:14, lineHeight:1.5 }}>
      <Sidebar active={view} onOpenView={openRootView} user={user} onLogout={logout} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <AlertBar tareas={tareas} />
        <GlobalTabs />

        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 22,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <VoiceAssistantButton token={token} onInterpretation={handleVoiceInterpretation} />
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: `1px solid ${T.AMB}44`,
              background: `linear-gradient(135deg, ${T.ambDim}, ${T.card2})`,
              color: T.AMB,
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
            }}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div style={{ flex:1, padding:28, overflowY:'auto', overflowX:'hidden', scrollbarGutter:'stable' }}>
          {rootTabs.length === 0 ? (
            <div style={{
              minHeight: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                maxWidth: 520,
                width: '100%',
                padding: 28,
                borderRadius: 20,
                border: `1px solid ${T.bdr}`,
                background: `linear-gradient(180deg, ${T.card}, ${T.card2})`,
                boxShadow: '0 24px 60px rgba(15,23,42,0.12)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.txt, marginBottom: 10 }}>
                  Abre tu primer modulo
                </div>
                <div style={{ fontSize: 14, color: T.sub, marginBottom: 18 }}>
                  Las pestanas superiores apareceran solo cuando abras una opcion del menu. Asi puedes trabajar con varios modulos al mismo tiempo sin llenar la parte superior con vistas que no estas usando.
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {ROOT_TAB_ITEMS.filter(item => !item.role || item.role === user?.rol).slice(0, 4).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => openRootView(id)}
                      style={{
                        display:'inline-flex',
                        alignItems:'center',
                        gap:8,
                        padding:'10px 14px',
                        borderRadius:12,
                        border:`1px solid ${T.bdr2}`,
                        background:T.card,
                        color:T.txt,
                        cursor:'pointer',
                        fontWeight:700,
                      }}
                    >
                      {createElement(Icon, { size: 16 })}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : tabs.map(tab => (
            <div
              key={tab.id}
              style={{ display: tab.id === activeTabId ? 'block' : 'none', height:'100%' }}
            >
              {renderTabView(tab)}
            </div>
          ))}
        </div>
      </div>

      <GanttTooltip tooltip={ganttTooltip} />

      {modalTarea && (
        <AsignacionModal
          tarea={modalTarea}
          conductores={conductores}
          vehiculos={vehiculos}
          tareas={tareas}
          eventos={eventos}
          onClose={() => setModal(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <TabsProvider>
        <AppContent />
      </TabsProvider>
    </AuthProvider>
  );
}
