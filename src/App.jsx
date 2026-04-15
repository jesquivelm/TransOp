import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, CheckSquare, Users, Bus, Receipt,
  BarChart3, AlertTriangle, CheckCircle, XCircle, Clock, MapPin,
  Phone, Plus, Search, ChevronRight, Shield, Wrench, X, User,
  MessageSquare, Zap, Eye, RefreshCcw, ChevronDown, Moon, Sun, Calculator, Settings
} from "lucide-react";

import CotizadorView from './components/Cotizador/CotizadorView';
import SociosView from './components/SociosView';
import LoginView from './components/Auth/LoginView';
import UsuarioMgmtView from './components/Admin/UsuarioMgmtView';
import ConfiguracionesView from './components/Admin/ConfiguracionesView';
import FlotaGanttView from './components/FlotaGanttView';
import VoiceAssistantButton from './components/VoiceAssistantButton';
import { AuthProvider, useAuth } from './context/AuthContext';
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

// ─────────────────────────────────────────────────────────────
// MODAL DE ASIGNACIÓN (con detección de conflictos)
// ─────────────────────────────────────────────────────────────
function AsignacionModal({ tarea, conductores, vehiculos, tareas, eventos, onClose, onConfirm }) {
  const evento = eventos.find(e => e.id === tarea.eventoId);
  const [selCond, setSelCond] = useState(tarea.condId || '');
  const [selVeh,  setSelVeh]  = useState(tarea.vehId  || '');

  const condConf = useMemo(() => checkConductorConflicts(selCond, tarea.hora, tarea.fin, tareas, tarea.id), [selCond]);
  const vehConf  = useMemo(() => checkVehicleConflicts(selVeh, tarea.hora, tarea.fin, tareas, tarea.id),  [selVeh]);
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

  function ConflictBlock({ conflicts, label }) {
    if (conflicts.length === 0) return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:T.grnDim, borderRadius:8, marginTop:8 }}>
        <CheckCircle size={16} color={T.GRN} />
        <span style={{ fontSize:13, color:T.GRN, fontWeight:500 }}>Sin conflictos — {label} disponible</span>
      </div>
    );
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

  const fechaHoy = new Date().toLocaleDateString('es-CR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Tareas hoy"     value={total}    sub={`${complet} completadas`}    icon={CheckSquare} color={T.txt} />
        <StatCard label="En ruta ahora"  value={enRuta}   sub="vehículos activos"           icon={Zap}         color={T.BLU} />
        <StatCard label="Pendientes"     value={pendient} sub={`${sinAsig} sin conductor`}  icon={Clock}       color={sinAsig > 0 ? T.AMB : T.GRN} />
        <StatCard label="Conductores disponibles" value={dispCond} sub={`${dispVeh} vehículos libres`} icon={Users} color={T.GRN} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px', marginBottom:20 }}>
        <SectionHeader title={`Tareas de hoy — ${fechaHoy}`} />
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
        <SectionHeader title="Eventos activos" />
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

function EditarConductorModal({ conductor, onClose, onConfirm }) {
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
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
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

  return (
    <div>
      <div
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          width: '100%',
          height: 180,
          borderRadius: 14,
          border: `1px dashed ${T.bdr2}`,
          background: T.card2,
          overflow: 'hidden',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Unidad" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
function ConductoresView({ conductores, tareas, vehiculos, onAdd, onUpdate, onBaja }) {
  const [search, setSearch]     = useState('');
  const [filtroEst, setFiltro]  = useState('todos');
  const [expandido, setExpand]  = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [bajaTarget, setBajaTarget] = useState(null);

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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVO VEHÍCULO
// ─────────────────────────────────────────────────────────────
function NuevoVehiculoModal({ onClose, onConfirm, onUploadImage }) {
  const EMPTY = { placa:'', marca:'', modelo:'', tipo:'Buseta', cap:'', km:'', revTec:'', march:'', foto_url:'', licenciaRequerida:'', combustibleTipo: 'Diésel', rendimiento: 10 };
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
    if (!form.revTec) return setError('La fecha de revisión técnica es requerida.');
    if (!form.march)  return setError('La fecha de marchamo es requerida.');
    setError('');
    onConfirm({
      placa:  form.placa.trim().toUpperCase(),
      marca:  form.marca.trim(),
      modelo: form.modelo.trim(),
      tipo:   form.tipo,
      cap:    +form.cap,
      km:     +form.km || 0,
      revTec: form.revTec,
      march:  form.march,
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
                <option>Van</option>
                <option>Buseta</option>
                <option>Bus</option>
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
              <label style={lbl}>REVISIÓN TÉCNICA (vence) *</label>
              <input style={inp} type="date" value={form.revTec} onChange={e => set('revTec', e.target.value)} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>MARCHAMO (vence) *</label>
              <input style={inp} type="date" value={form.march} onChange={e => set('march', e.target.value)} />
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
function EditarVehiculoModal({ vehiculo, onClose, onConfirm, onUploadImage, gastos = [], onAddGasto, onUploadGastoAdjunto }) {
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({
    km: vehiculo?.km ?? 0,
    revTec: (vehiculo?.revTec || '').split('T')[0],
    march: (vehiculo?.march || '').split('T')[0],
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
      march: form.march || null,
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
            <div>
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
                <label style={lbl}>REVISIÓN TÉCNICA</label>
                <input style={inp} type="date" value={form.revTec} onChange={e => set('revTec', e.target.value)} />
              </div>
              <div style={{ gridColumn:'span 4' }}>
                <label style={lbl}>MARCHAMO</label>
                <input style={inp} type="date" value={form.march} onChange={e => set('march', e.target.value)} />
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

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
          <button onClick={onClose} style={{ padding:'10px 20px', background:'transparent', border:`1px solid ${T.bdr2}`, borderRadius:8, color:T.sub, cursor:'pointer', fontSize:13 }}>Cancelar</button>
          {tab === 'general' && <button onClick={submit} style={{ padding:'10px 20px', background:T.AMB, border:'none', borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>{form.estado === 'disponible' && vehiculo.estado === 'fuera_de_servicio' ? 'Reactivar unidad' : 'Guardar cambios'}</button>}
        </div>
      </div>
    </div>
  );
}

function VehiculosView({ vehiculos, conductores, onAdd, onBaja, onUpdate, onUploadImage, gastos, onAddGasto, onUploadGastoAdjunto }) {
  const [filtroEst, setFiltro] = useState('todos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [bajaTarget, setBajaTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

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
            const [rcol, rbg, rdias] = alertLevel(v.revTec);
            const [mcol, mbg, mdias] = alertLevel(v.march);
            const fuera = v.estado === 'fuera_de_servicio';
            return (
              <div key={v.id} style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px', opacity: fuera ? 0.55 : 1 }}>
                {v.foto_url && (
                  <div style={{ marginBottom:14, borderRadius:10, overflow:'hidden', border:`1px solid ${T.bdr}` }}>
                    <img src={v.foto_url} alt={`${v.marca} ${v.modelo}`} style={{ width:'100%', height:140, objectFit:'cover', display:'block' }} />
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
                      <span style={{ fontSize:11, color:T.sub }}>Rev. técnica · {fmtDate(v.revTec)}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:rcol }}>{rdias === 'Vencida' ? '⚠ VENCIDA' : rdias}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px',
                    background:mbg, borderRadius:6, border:`1px solid ${mcol}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Receipt size={12} color={mcol} />
                      <span style={{ fontSize:11, color:T.sub }}>Marchamo · {fmtDate(v.march)}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:mcol }}>{mdias}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL NUEVO EVENTO
// ─────────────────────────────────────────────────────────────
function NuevoEventoModal({ onClose, onConfirm }) {
  const EMPTY = { nombre:'', cliente:'', inicio:'', fin:'', pax:'', prio:'normal', estado:'planificado' };
  const [form, setForm] = useState(EMPTY);
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
          <div style={{ fontSize:17, fontWeight:700, color:T.txt }}>Nuevo evento</div>
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
            borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>Crear evento</button>
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
// VISTA: TAREAS DEL DÍA
// ─────────────────────────────────────────────────────────────
function TareasView({ tareas, conductores, vehiculos, eventos, onAsignar, onAddTarea }) {
  const [modalNuevo, setModalNuevo] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [search, setSearch] = useState('');

  const filtradas = useMemo(() => tareas.filter(t => {
    const matchE = filtro === 'todos' || t.estado === filtro;
    const matchS = !search || t.nombre.toLowerCase().includes(search.toLowerCase()) ||
                   (t.origen||'').toLowerCase().includes(search.toLowerCase()) ||
                   (t.destino||'').toLowerCase().includes(search.toLowerCase());
    return matchE && matchS;
  }), [tareas, filtro, search]);

  const counts = { todos: tareas.length };
  tareas.forEach(t => { counts[t.estado] = (counts[t.estado]||0)+1; });

  const filtros = [
    { val:'todos',      label:`Todas (${counts.todos})` },
    { val:'pendiente',  label:`Pendientes (${counts.pendiente||0})` },
    { val:'asignada',   label:`Asignadas (${counts.asignada||0})` },
    { val:'en_ruta',    label:`En ruta (${counts.en_ruta||0})` },
    { val:'completada', label:`Completadas (${counts.completada||0})` },
  ];

  const sinCond = tareas.filter(t => t.estado === 'pendiente' && !t.condId).length;
  const tdSt = (w) => ({ width:w, padding:'0 10px', verticalAlign:'middle', color:T.txt, fontSize:13 });

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total hoy"      value={tareas.length}        sub={`${counts.completada||0} completadas`}  icon={CheckSquare} color={T.txt} />
        <StatCard label="En ruta"        value={counts.en_ruta||0}    sub="activas ahora"                           icon={Zap}         color={T.BLU} />
        <StatCard label="Sin conductor"  value={sinCond}              sub="requieren asignación"                    icon={AlertTriangle} color={sinCond > 0 ? T.RED : T.GRN} />
        <StatCard label="Asignadas"      value={counts.asignada||0}   sub="listas para salir"                       icon={CheckCircle} color={T.AMB} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:T.card2,
            border:`1px solid ${T.bdr2}`, borderRadius:8, padding:'8px 12px', flex:1, minWidth:180 }}>
            <Search size={14} color={T.mute}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tarea, origen, destino..."
              style={{ background:'transparent', border:'none', outline:'none', color:T.txt, fontSize:13, flex:1 }}/>
          </div>
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
            <Plus size={14}/> Nueva tarea
          </button>
        </div>

        {filtradas.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:T.mute, fontSize:13 }}>No hay tareas en esta categoría.</div>
        )}

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.bdr2}` }}>
                {['Hora','Tarea / Ruta','Evento','Conductor','Vehículo','Pax','Estado','Acción'].map(h => (
                  <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:11,
                    fontWeight:600, color:T.mute, letterSpacing:.5, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.slice().sort((a, b) => a.hora.localeCompare(b.hora)).map(t => {
                const cond = conductores.find(c => c.id === t.condId);
                const veh  = vehiculos.find(v => v.id === t.vehId);
                const ev   = eventos.find(e => e.id === t.eventoId);
                const sinA = t.estado === 'pendiente' && !t.condId;
                return (
                  <tr key={t.id} style={{ borderBottom:`1px solid ${T.bdr}` }}>
                    <td style={tdSt(70)}>
                      <span style={{ fontFamily:'monospace', fontSize:13, color:T.AMB, fontWeight:600 }}>{t.hora}</span>
                      <div style={{ fontSize:10, color:T.mute }}>{t.fin}</div>
                    </td>
                    <td style={tdSt(200)}>
                      <div style={{ fontWeight:500, color:T.txt }}>{t.nombre}</div>
                      {(t.origen||t.destino) && (
                        <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>
                          {t.origen} {t.origen && t.destino ? '→' : ''} {t.destino}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdSt(160), fontSize:12, color:T.sub }}>
                      {ev ? (
                        <div>
                          <div style={{ color:T.txt, fontWeight:500 }}>{ev.nombre}</div>
                          <div style={{ fontSize:11, color:T.mute }}>{ev.cliente}</div>
                        </div>
                      ) : <span style={{ color:T.mute }}>—</span>}
                    </td>
                    <td style={tdSt(140)}>
                      {cond
                        ? <span style={{ fontSize:13 }}>{cond.alias || cond.nombre.split(' ')[0]}</span>
                        : <span style={{ fontSize:12, color: sinA ? T.RED : T.mute }}>{sinA ? '⚠ Sin asignar' : '—'}</span>}
                    </td>
                    <td style={tdSt(110)}>
                      {veh
                        ? <span style={{ fontFamily:'monospace', fontSize:12, color:T.sub }}>{veh.placa}</span>
                        : <span style={{ fontSize:12, color:T.mute }}>—</span>}
                    </td>
                    <td style={{ ...tdSt(50), textAlign:'center' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:T.sub }}>{t.pax}</span>
                    </td>
                    <td style={tdSt(110)}><Badge estado={t.estado} /></td>
                    <td style={tdSt(90)}>
                      {['pendiente', 'asignada'].includes(t.estado) && (
                        <button onClick={() => onAsignar(t)}
                          style={{ fontSize:12, padding:'5px 11px', background:T.ambDim,
                            border:`1px solid ${T.AMB}44`, borderRadius:6, color:T.AMB,
                            cursor:'pointer', fontWeight:600 }}>
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

      {modalNuevo && (
        <NuevaTareaModal
          onClose={() => setModalNuevo(false)}
          onConfirm={datos => { onAddTarea(datos); setModalNuevo(false); }}
          eventos={eventos}
          conductores={conductores}
          vehiculos={vehiculos}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ active, setView, user, onLogout }) {
  const items = [
    { id:'dashboard',   Icon:LayoutDashboard, label:'Dashboard'      },
    { id:'socios',      Icon:User,            label:'Socios'          },
    { id:'cotizaciones',Icon:Calculator,      label:'Proformas'      },
    { id:'eventos',     Icon:CalendarDays,    label:'Eventos'        },
    { id:'tareas',      Icon:CheckSquare,     label:'Tareas del día' },
    { id:'gantt',       Icon:BarChart3,       label:'Línea de tiempo'},
    { id:'conductores', Icon:Users,           label:'Conductores'    },
    { id:'vehiculos',   Icon:Bus,             label:'Vehículos'      },
    { id:'gastos',      Icon:Receipt,         label:'Gastos'         },
    { id:'reportes',    Icon:BarChart3,       label:'Reportes'       },
    { id:'usuarios',    Icon:Shield,          label:'Seguridad'      , role: 'admin' },
    { id:'config',      Icon:Settings,        label:'Configuración'  , role: 'admin' },
  ];

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
        {filteredItems.map(({ id, Icon, label }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => setView(id)}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px',
                borderRadius:8, border:'none', cursor:'pointer', marginBottom:2, textAlign:'left',
                background: isActive ? T.ambDim : 'transparent',
                color: isActive ? T.AMB : T.mute, fontWeight: isActive ? 600 : 400, fontSize:13 }}>
              <Icon size={16} />
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
      <SectionHeader title="Gastos de unidades" />
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

function PlaceholderView({ titulo, icono: Icon }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:400, gap:16 }}>
      <Icon size={48} color={T.mute} />
      <div style={{ fontSize:18, fontWeight:600, color:T.sub }}>{titulo}</div>
      <div style={{ fontSize:13, color:T.mute }}>Módulo en desarrollo — próxima sesión</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP CONTENT (PROTECTED) — sin datos locales, todo desde API
// ─────────────────────────────────────────────────────────────
function AppContent() {
  const { isAuthenticated, user, token, logout } = useAuth();
  const [view,        setView]      = useState('dashboard');
  const [tareas,      setTareas]    = useState([]);
  const [conductores, setConductores] = useState([]);
  const [vehiculos,   setVehiculos] = useState([]);
  const [eventos,     setEventos]   = useState([]);
  const [gastos,      setGastos]    = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [modalTarea,  setModal]     = useState(null);
  const [theme,       setTheme]     = useState('dark');
  const [ganttTooltip, setGanttTooltip] = useState(null);
  const [voiceDraft,  setVoiceDraft] = useState(null);
  const [cotizadorHeaderMeta, setCotizadorHeaderMeta] = useState({ tc: null });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  // ── Carga inicial de todos los datos ──────────────────────
  const cargarTodo = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [conds, vehs, evts, tareas, gastosData] = await Promise.all([
        apiFetch(`${API}/conductores`),
        apiFetch(`${API}/vehiculos`),
        apiFetch(`${API}/eventos`),
        apiFetch(`${API}/tareas?fecha=${todayISO()}`),
        apiFetch(`${API}/gastos`),
      ]);
      setConductores(conds);
      setVehiculos(vehs);
      setEventos(evts);
      setTareas(tareas);
      setGastos(gastosData);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const handleVoiceInterpretation = useCallback((interpretation, transcript) => {
    const draft = normalizeVoiceInterpretation(interpretation, transcript);
    setVoiceDraft(draft);
    if (draft.route && draft.route !== view) {
      setView(draft.route);
    }
  }, [view]);

  const handleVoiceDraftApplied = useCallback((draftId) => {
    setVoiceDraft(prev => (prev?.id === draftId ? null : prev));
  }, []);

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

  // ── Handlers que persisten en la BD ───────────────────────
  function handleAsignar(tarea) { setModal(tarea); }

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

  async function handleAddTarea(datos) {
    try {
      const { id } = await apiFetch(`${API}/tareas`, {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      const nueva = { id, estado:'pendiente', condId: null, vehId: null, ...datos };
      setTareas(prev => [...prev, nueva]);
      if (datos.eventoId) {
        setEventos(prev => prev.map(e =>
          e.id === datos.eventoId ? { ...e, tareas: Number(e.tareas) + 1 } : e
        ));
      }
      return nueva;
    } catch (err) {
      console.error('Error creando tarea:', err);
      throw err;
    }
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

  const pageTitle = {
    dashboard:   'Dashboard operativo',
    socios:      'Socios',
    cotizaciones:'Cotizador de Transporte',
    eventos:     'Eventos',
    tareas:      'Tareas del día',
    gantt:       'Línea de tiempo de flota',
    conductores: 'Conductores',
    vehiculos:   'Vehículos',
    gastos:      'Gastos',
    reportes:    'Reportes',
    usuarios:    'Seguridad y Usuarios',
    config:      'Configuración del Sistema',
  }[view];

  const fechaHoy = new Date().toLocaleDateString('es-CR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const headerSubline = view === 'cotizaciones' && cotizadorHeaderMeta?.tc
    ? `${fechaHoy} | TC ₡${Number(cotizadorHeaderMeta.tc).toLocaleString('es-CR')}`
    : fechaHoy;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:T.bg, fontFamily:"system-ui,-apple-system,sans-serif",
      color:T.txt, fontSize:14, lineHeight:1.5 }}>
      <Sidebar active={view} setView={setView} user={user} onLogout={logout} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <AlertBar tareas={tareas} />

        <div style={{ padding:'20px 28px 16px', borderBottom:`1px solid ${T.bdr}`,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:T.txt }}>{pageTitle}</h1>
            <div style={{ fontSize:12, color:T.mute, marginTop:2, textTransform:'capitalize' }}>{headerSubline}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <VoiceAssistantButton token={token} onInterpretation={handleVoiceInterpretation} />
            <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
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
              }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div style={{ flex:1, padding:28, overflowY:'auto', overflowX:'hidden', scrollbarGutter:'stable' }}>
          {view === 'dashboard'   && <Dashboard   tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={eventos} onAsignar={handleAsignar} />}
          {view === 'socios'      && (
            <SociosView
              voiceDraft={voiceDraft?.intent === 'socio' ? voiceDraft : null}
              onVoiceDraftApplied={handleVoiceDraftApplied}
            />
          )}
          {view === 'cotizaciones'&& (
            <CotizadorView
              voiceDraft={voiceDraft?.intent === 'cotizacion' ? voiceDraft : null}
              onVoiceDraftApplied={handleVoiceDraftApplied}
              onHeaderMetaChange={setCotizadorHeaderMeta}
              onCreateEvento={handleAddEvento}
              onCreateTarea={handleAddTarea}
            />
          )}
          {view === 'eventos'     && <EventosView eventos={eventos} onAdd={handleAddEvento} />}
          {view === 'tareas'      && <TareasView tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={eventos} onAsignar={handleAsignar} onAddTarea={handleAddTarea} />}
          {view === 'gantt'       && <FlotaGanttView tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={eventos} onTooltipChange={setGanttTooltip} />}
    {view === 'conductores' && <ConductoresView conductores={conductores} tareas={tareas} vehiculos={vehiculos} onAdd={handleAddConductor} onUpdate={handleUpdateConductor} onBaja={handleBajaConductor} />}
    {view === 'vehiculos'   && <VehiculosView vehiculos={vehiculos} conductores={conductores} onAdd={handleAddVehiculo} onBaja={handleBajaVehiculo} onUpdate={handleUpdateVehiculo} onUploadImage={uploadVehiculoImage} gastos={gastos} onAddGasto={handleAddGasto} onUploadGastoAdjunto={uploadGastoAdjunto} />}
          {view === 'usuarios'    && <UsuarioMgmtView />}
          {view === 'config'      && <ConfiguracionesView />}
          {view === 'gastos'      && <GastosView gastos={gastos} vehiculos={vehiculos} />}
          {view === 'reportes'    && <PlaceholderView titulo="Módulo de Reportes" icono={BarChart3} />}
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
      <AppContent />
    </AuthProvider>
  );
}
