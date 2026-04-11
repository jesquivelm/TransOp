import { useState, useMemo } from "react";
import {
  LayoutDashboard, CalendarDays, CheckSquare, Users, Bus, Receipt,
  BarChart3, AlertTriangle, CheckCircle, XCircle, Clock, MapPin,
  Phone, Plus, Search, ChevronRight, Shield, Wrench, X, User,
  MessageSquare, Zap, Eye, RefreshCcw, ChevronDown, Moon, Sun, Calculator, Settings
} from "lucide-react";

import CotizadorView from './components/Cotizador/CotizadorView';
import LoginView from './components/Auth/LoginView';
import UsuarioMgmtView from './components/Admin/UsuarioMgmtView';
import ConfiguracionesView from './components/Admin/ConfiguracionesView';
import { AuthProvider, useAuth } from './context/AuthContext';

// ─────────────────────────────────────────────────────────────
// TOKENS DE COLOR
// ─────────────────────────────────────────────────────────────
export const T = {
  bg:     'var(--bg)',
  card:   'var(--card)',
  card2:  'var(--card2)',
  card3:  'var(--card3)',
  bdr:    'var(--bdr)',
  bdr2:   'var(--bdr2)',
  txt:    'var(--txt)',
  mute:   'var(--mute)',
  sub:    'var(--sub)',
  AMB:    'var(--AMB)', ambDim: 'var(--ambDim)',
  BLU:    'var(--BLU)', bluDim: 'var(--bluDim)',
  GRN:    'var(--GRN)', grnDim: 'var(--grnDim)',
  RED:    'var(--RED)', redDim: 'var(--redDim)',
  PUR:    'var(--PUR)', purDim: 'var(--purDim)',
  ORG:    'var(--ORG)', orgDim: 'var(--orgDim)',
};

// ─────────────────────────────────────────────────────────────
// DATOS DE MUESTRA
// ─────────────────────────────────────────────────────────────
const CONDUCTORES_INIT = [
  { id:'c1', nombre:'Carlos Mora Jiménez',    cedula:'1-1234-5678', tel:'8888-1111', alias:'Carlitos', estado:'en_servicio', lic:['B','C'],    vehId:'v1' },
  { id:'c2', nombre:'Luis Arias Rojas',        cedula:'2-0987-6543', tel:'8777-2222', alias:'Lucho',    estado:'disponible',  lic:['B','C','D'], vehId:null },
  { id:'c3', nombre:'Andrés Campos Vega',      cedula:'3-5678-9012', tel:'8666-3333', alias:'Andy',     estado:'en_servicio', lic:['B','C'],    vehId:'v3' },
  { id:'c4', nombre:'Miguel Vargas Brenes',    cedula:'4-4321-8765', tel:'8555-4444', alias:'Migue',    estado:'vacaciones',  lic:['B'],         vehId:null },
  { id:'c5', nombre:'Roberto Solano Quesada',  cedula:'5-2345-6789', tel:'8444-5555', alias:'Beto',     estado:'en_servicio', lic:['B','C','D'], vehId:'v2' },
  { id:'c6', nombre:'Esteban Mora Castro',     cedula:'1-9876-5432', tel:'8333-6666', alias:'Esteban',  estado:'enfermo',     lic:['B','C'],    vehId:null },
  { id:'c7', nombre:'Diego Fallas Torres',     cedula:'2-1111-2222', tel:'8222-7777', alias:'Diego',    estado:'disponible',  lic:['B','C','D'], vehId:null },
];

const VEHICULOS_INIT = [
  { id:'v1', placa:'SJB-1234', marca:'Mercedes-Benz', modelo:'Sprinter 519',    tipo:'Buseta', cap:20, estado:'en_servicio',   condId:'c1', revTec:'2026-08-15', march:'2026-12-31', km:145230 },
  { id:'v2', placa:'SJC-5678', marca:'Hyundai',       modelo:'County H350',     tipo:'Buseta', cap:17, estado:'en_servicio',   condId:'c5', revTec:'2026-05-20', march:'2026-12-31', km:98420  },
  { id:'v3', placa:'SJA-9012', marca:'Toyota',        modelo:'Coaster',         tipo:'Bus',    cap:30, estado:'en_servicio',   condId:'c3', revTec:'2026-11-10', march:'2026-12-31', km:210000 },
  { id:'v4', placa:'GUA-3456', marca:'Toyota',        modelo:'Hiace Commuter',  tipo:'Van',    cap:12, estado:'mantenimiento', condId:null, revTec:'2025-12-01', march:'2026-12-31', km:178500 },
  { id:'v5', placa:'ALJ-7890', marca:'Ford',          modelo:'Transit 350',     tipo:'Van',    cap:15, estado:'disponible',    condId:null, revTec:'2027-01-20', march:'2026-12-31', km:55800  },
  { id:'v6', placa:'SJB-4444', marca:'Volkswagen',    modelo:'Crafter 35',      tipo:'Buseta', cap:18, estado:'disponible',    condId:null, revTec:'2026-07-08', march:'2026-12-31', km:88100  },
];

const EVENTOS = [
  { id:'e1', nombre:'Turistas Canadá – Circuit CR',      cliente:'Maple Travel Group',          estado:'en_curso',   inicio:'08/04', fin:'22/04', pax:18,  tareas:14, ok:3,  prio:'alta'   },
  { id:'e2', nombre:'Ruta Diaria Empleados Intel',        cliente:'Intel Costa Rica',            estado:'en_curso',   inicio:'01/04', fin:'30/04', pax:45,  tareas:22, ok:9,  prio:'normal' },
  { id:'e3', nombre:'Gira Escolar – Saint Paul',          cliente:'Colegio Saint Paul',          estado:'confirmado', inicio:'18/04', fin:'18/04', pax:35,  tareas:3,  ok:0,  prio:'normal' },
  { id:'e4', nombre:'Congreso Médico – Hotel Real',       cliente:'Hotel Real Intercontinental', estado:'confirmado', inicio:'12/04', fin:'14/04', pax:120, tareas:18, ok:0,  prio:'alta'   },
  { id:'e5', nombre:'Tour Privado Familia Quesada',       cliente:'Juan Quesada',                estado:'planificado',inicio:'25/04', fin:'27/04', pax:8,   tareas:6,  ok:0,  prio:'baja'   },
];

const TAREAS_INIT = [
  { id:'t1', hora:'06:00', fin:'07:30', nombre:'Recogida aeropuerto SJO',  eventoId:'e1', condId:'c1', vehId:'v1', pax:18, estado:'completada', origen:'Aeropuerto SJO',       destino:'Hotel Bougainvillea'    },
  { id:'t2', hora:'07:15', fin:'08:00', nombre:'Ruta Intel – Mañana',       eventoId:'e2', condId:'c3', vehId:'v3', pax:32, estado:'completada', origen:'San José (paradas)',   destino:'Intel Belén'            },
  { id:'t3', hora:'09:00', fin:'18:00', nombre:'Tour Volcán Poás',           eventoId:'e1', condId:'c5', vehId:'v2', pax:18, estado:'en_ruta',    origen:'Hotel Bougainvillea',  destino:'Parque Nac. Poás'       },
  { id:'t4', hora:'14:00', fin:'16:00', nombre:'Traslado Museo Jade',        eventoId:'e1', condId:'c2', vehId:null, pax:18, estado:'asignada',   origen:'Hotel Bougainvillea',  destino:'Museo Jade'             },
  { id:'t5', hora:'17:00', fin:'18:00', nombre:'Ruta Intel – Tarde',         eventoId:'e2', condId:null, vehId:null, pax:38, estado:'pendiente',  origen:'Intel Belén',          destino:'San José (paradas)'    },
  { id:'t6', hora:'19:30', fin:'21:00', nombre:'Traslado cena El Fogón',     eventoId:'e1', condId:null, vehId:null, pax:18, estado:'pendiente',  origen:'Hotel Bougainvillea',  destino:'Rest. El Fogón de Lelo' },
];

const ALERTAS = [
  { tipo:'revision_tecnica', entidad:'GUA-3456', detalle:'Toyota Hiace Commuter', vence:'01/12/2025', dias:-129, sev:'critica' },
  { tipo:'revision_tecnica', entidad:'SJC-5678', detalle:'Hyundai County H350',   vence:'20/05/2026', dias:41,   sev:'warning' },
  { tipo:'licencia',          entidad:'Carlos Mora',  detalle:'Licencia C',        vence:'15/05/2026', dias:36,   sev:'warning' },
  { tipo:'marchamo',          entidad:'ALJ-7890',     detalle:'Ford Transit 350',  vence:'31/12/2026', dias:266,  sev:'ok'      },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const TODAY = '2026-04-09';
const toDate = (t) => new Date(`${TODAY}T${t}:00`);

function checkConductorConflicts(condId, startT, endT, tareas, excludeId = null) {
  if (!condId) return [];
  const s = toDate(startT), e = toDate(endT);
  return tareas.filter(t => {
    if (t.id === excludeId || t.condId !== condId) return false;
    if (['cancelada','completada'].includes(t.estado)) return false;
    return toDate(t.hora) < e && toDate(t.fin) > s;
  });
}

function checkVehicleConflicts(vehId, startT, endT, tareas, excludeId = null) {
  if (!vehId) return [];
  const s = toDate(startT), e = toDate(endT);
  return tareas.filter(t => {
    if (t.id === excludeId || t.vehId !== vehId) return false;
    if (['cancelada','completada'].includes(t.estado)) return false;
    return toDate(t.hora) < e && toDate(t.fin) > s;
  });
}

function daysUntil(dateStr) {
  const parts = dateStr.split('/');
  const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return Math.round((d - new Date('2026-04-09')) / 86400000);
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
  const capOk = selVehObj ? selVehObj.cap >= tarea.pax : true;
  const canConfirm = selCond && selVeh && condConf.length === 0 && vehConf.length === 0 && capOk;

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
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
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

        {/* Conductor */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:T.sub, display:'block', marginBottom:8 }}>CONDUCTOR</label>
          <select value={selCond} onChange={e => setSelCond(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', background:T.card2, border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.txt, fontSize:14, cursor:'pointer' }}>
            <option value="">— Seleccionar conductor —</option>
            {conductores.filter(c => !['vacaciones','suspendido','inactivo','enfermo'].includes(c.estado)).map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({LC[c.estado]?.[0]})</option>
            ))}
          </select>
          {selCond && <ConflictBlock conflicts={condConf} label="Conductor" />}
        </div>

        {/* Vehículo */}
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
            Confirmar asignación
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
      {/* KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Tareas hoy"     value={total}    sub={`${complet} completadas`}    icon={CheckSquare} color={T.txt} />
        <StatCard label="En ruta ahora"  value={enRuta}   sub="vehículos activos"           icon={Zap}         color={T.BLU} />
        <StatCard label="Pendientes"     value={pendient} sub={`${sinAsig} sin conductor`}  icon={Clock}       color={sinAsig > 0 ? T.AMB : T.GRN} />
        <StatCard label="Conductores disponibles" value={dispCond} sub={`${dispVeh} vehículos libres`} icon={Users} color={T.GRN} />
      </div>

      {/* Tareas del día */}
      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px', marginBottom:20 }}>
        <SectionHeader title="Tareas de hoy — 9 de abril 2026" />
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
                const cond = CONDUCTORES_INIT.find(c => c.id === t.condId);
                const veh  = VEHICULOS_INIT.find(v => v.id === t.vehId);
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
                      {t.estado === 'pendiente' && (
                        <button onClick={() => onAsignar(t)}
                          style={{ fontSize:12, padding:'4px 10px', background:T.ambDim, border:`1px solid ${T.AMB}33`,
                            borderRadius:6, color:T.AMB, cursor:'pointer', fontWeight:500 }}>
                          Asignar
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

      {/* Eventos activos */}
      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <SectionHeader title="Eventos activos" />
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {eventos.filter(e => ['en_curso','confirmado'].includes(e.estado)).map(e => {
            const pct = Math.round((e.ok / e.tareas) * 100);
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
// VISTA: CONDUCTORES
// ─────────────────────────────────────────────────────────────
function ConductoresView({ conductores, tareas, vehiculos }) {
  const [search, setSearch]     = useState('');
  const [filtroEst, setFiltro]  = useState('todos');
  const [expandido, setExpand]  = useState(null);

  const filtrados = useMemo(() => conductores.filter(c => {
    const matchS = c.nombre.toLowerCase().includes(search.toLowerCase()) || c.alias.toLowerCase().includes(search.toLowerCase());
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
  ];

  return (
    <div>
      {/* KPIs conductores */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total conductores"  value={conductores.length}                                     icon={Users}  color={T.txt} />
        <StatCard label="Disponibles"        value={counts.disponible || 0}   sub="listos para asignar"     icon={CheckCircle} color={T.GRN} />
        <StatCard label="En servicio"        value={counts.en_servicio || 0}  sub="activos ahora"           icon={Zap}    color={T.BLU} />
        <StatCard label="No disponibles"     value={(counts.vacaciones||0)+(counts.enfermo||0)} sub="bajas + vacaciones" icon={AlertTriangle} color={T.AMB} />
      </div>

      {/* Tabla */}
      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        {/* Barra de búsqueda y filtros */}
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
          <button style={{ padding:'8px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`,
            borderRadius:8, color:T.AMB, cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Nuevo conductor
          </button>
        </div>

        {/* Filas */}
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {filtrados.map(c => {
            const veh = vehiculos.find(v => v.id === c.vehId);
            const tareasHoy = tareas.filter(t => t.condId === c.id);
            const open = expandido === c.id;
            return (
              <div key={c.id}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 10px', borderRadius:10,
                  cursor:'pointer', transition:'background .15s', background: open ? T.card2 : 'transparent',
                  border: `1px solid ${open ? T.bdr2 : 'transparent'}` }}
                  onClick={() => setExpand(open ? null : c.id)}>
                  {/* Avatar */}
                  <div style={{ width:38, height:38, borderRadius:'50%', background:T.card3,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    fontSize:14, fontWeight:700, color:T.AMB }}>
                    {c.nombre.split(' ').map(n => n[0]).slice(0,2).join('')}
                  </div>
                  {/* Nombre + alias */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:T.txt }}>{c.nombre}</div>
                    <div style={{ fontSize:11, color:T.mute }}>{c.alias} · {c.cedula}</div>
                  </div>
                  {/* Licencias */}
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {c.lic.map(l => (
                      <span key={l} style={{ fontSize:10, fontWeight:700, padding:'2px 6px',
                        borderRadius:4, background:T.bluDim, color:T.BLU }}>{l}</span>
                    ))}
                  </div>
                  {/* Vehículo */}
                  <div style={{ width:100, textAlign:'center' }}>
                    {veh ? (
                      <span style={{ fontFamily:'monospace', fontSize:12, color:T.sub }}>{veh.placa}</span>
                    ) : (
                      <span style={{ fontSize:12, color:T.bdr2 }}>Sin asignar</span>
                    )}
                  </div>
                  {/* Teléfono */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, width:110 }}>
                    <Phone size={12} color={T.mute} />
                    <span style={{ fontSize:12, color:T.sub }}>{c.tel}</span>
                  </div>
                  {/* Estado */}
                  <div style={{ width:110 }}><Badge estado={c.estado} /></div>
                  <ChevronDown size={14} color={T.mute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s' }} />
                </div>

                {/* Detalle expandido */}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: VEHÍCULOS
// ─────────────────────────────────────────────────────────────
function VehiculosView({ vehiculos, conductores }) {
  const [filtroEst, setFiltro] = useState('todos');

  const filtrados = filtroEst === 'todos' ? vehiculos : vehiculos.filter(v => v.estado === filtroEst);

  function alertLevel(dateStr) {
    const d = daysUntil(dateStr);
    if (d < 0)  return [T.RED,   T.redDim, 'Vencida'];
    if (d < 30) return [T.AMB,   T.ambDim, `${d}d`];
    if (d < 60) return [T.ORG,   T.orgDim, `${d}d`];
    return [T.GRN, T.grnDim, `${d}d`];
  }

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
        <StatCard label="Total unidades"    value={vehiculos.length}                   icon={Bus}         color={T.txt} />
        <StatCard label="Disponibles"       value={counts.disponible || 0}             icon={CheckCircle} color={T.GRN} />
        <StatCard label="En servicio"       value={counts.en_servicio || 0}            icon={Zap}         color={T.BLU} />
        <StatCard label="En mantenimiento"  value={counts.mantenimiento || 0}          icon={Wrench}      color={T.AMB} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:6 }}>
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
          <button style={{ padding:'8px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`,
            borderRadius:8, color:T.AMB, cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Registrar vehículo
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
          {filtrados.map(v => {
            const cond = conductores.find(c => c.id === v.condId);
            const [rcol, rbg, rdias] = alertLevel(v.revTec);
            const [mcol, mbg, mdias] = alertLevel(v.march);
            return (
              <div key={v.id} style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px' }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div>
                    <div style={{ fontFamily:'monospace', fontSize:16, fontWeight:700, color:T.AMB, letterSpacing:.5 }}>{v.placa}</div>
                    <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{v.marca} {v.modelo}</div>
                  </div>
                  <Badge estado={v.estado} />
                </div>

                {/* Info fila */}
                <div style={{ display:'flex', gap:12, marginBottom:14, fontSize:12 }}>
                  <span style={{ background:T.card3, padding:'3px 8px', borderRadius:6, color:T.sub }}>{v.tipo}</span>
                  <span style={{ background:T.card3, padding:'3px 8px', borderRadius:6, color:T.sub }}>{v.cap} plazas</span>
                  <span style={{ background:T.card3, padding:'3px 8px', borderRadius:6, color:T.mute }}>{v.km.toLocaleString()} km</span>
                </div>

                {/* Conductor asignado */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, padding:'8px 10px',
                  background:T.card3, borderRadius:8 }}>
                  <User size={13} color={T.mute} />
                  <span style={{ fontSize:12, color: cond ? T.txt : T.mute }}>
                    {cond ? cond.nombre : 'Sin conductor asignado'}
                  </span>
                </div>

                {/* Alertas de vencimiento */}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', justify:'space-between', alignItems:'center', padding:'6px 10px',
                    background:rbg, borderRadius:6, border:`1px solid ${rcol}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Shield size={12} color={rcol} />
                      <span style={{ fontSize:11, color:T.sub }}>Revisión técnica</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:rcol, marginLeft:'auto', paddingLeft:8 }}>{rdias === 'Vencida' ? '⚠ VENCIDA' : rdias}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px',
                    background:mbg, borderRadius:6, border:`1px solid ${mcol}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Receipt size={12} color={mcol} />
                      <span style={{ fontSize:11, color:T.sub }}>Marchamo</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:mcol, marginLeft:'auto', paddingLeft:8 }}>{mdias}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VISTA: EVENTOS
// ─────────────────────────────────────────────────────────────
function EventosView({ eventos }) {
  const priColors = { alta:[T.RED,T.redDim], urgente:[T.ORG,T.orgDim], normal:[T.AMB,T.ambDim], baja:[T.mute,'rgba(100,116,139,0.1)'] };

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Total eventos" value={eventos.length}                                         icon={CalendarDays} color={T.txt} />
        <StatCard label="En curso"      value={eventos.filter(e=>e.estado==='en_curso').length}        icon={Zap}         color={T.BLU} />
        <StatCard label="Confirmados"   value={eventos.filter(e=>e.estado==='confirmado').length}      icon={CheckCircle} color={T.AMB} />
        <StatCard label="Planificados"  value={eventos.filter(e=>e.estado==='planificado').length}     icon={Clock}       color={T.mute} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:15, fontWeight:600, color:T.txt }}>Todos los eventos</h2>
          <button style={{ padding:'8px 14px', background:T.ambDim, border:`1px solid ${T.AMB}44`,
            borderRadius:8, color:T.AMB, cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Nuevo evento
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {eventos.map(e => {
            const pct = Math.round((e.ok / e.tareas) * 100);
            const [pcol, pbg] = priColors[e.prio] ?? [T.mute, T.bdr];
            return (
              <div key={e.id} style={{ padding:'16px 18px', background:T.card2, borderRadius:12,
                border:`1px solid ${T.bdr}`, cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontSize:15, fontWeight:600, color:T.txt }}>{e.nombre}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        color:pcol, background:pbg, letterSpacing:.3 }}>{e.prio.toUpperCase()}</span>
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
                    {e.ok} / {e.tareas} tareas completadas ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ active, setView, user, onLogout }) {
  const items = [
    { id:'dashboard',   Icon:LayoutDashboard, label:'Dashboard'      },
    { id:'cotizaciones',Icon:Calculator,      label:'Proformas'      },
    { id:'eventos',     Icon:CalendarDays,    label:'Eventos'        },
    { id:'tareas',      Icon:CheckSquare,     label:'Tareas del día' },
    { id:'conductores', Icon:Users,           label:'Conductores'    },
    { id:'vehiculos',   Icon:Bus,             label:'Vehículos'      },
    { id:'gastos',      Icon:Receipt,         label:'Gastos'         },
    { id:'reportes',    Icon:BarChart3,       label:'Reportes'       },
    { id:'usuarios',    Icon:Shield,          label:'Seguridad'      },
    { id:'config',      Icon:Settings,        label:'Configuración'  },
  ];

  return (
    <div style={{ width:220, background:T.card, borderRight:`1px solid ${T.bdr}`,
      display:'flex', flexDirection:'column', flexShrink:0, height:'100vh', position:'sticky', top:0 }}>
      {/* Logo */}
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

      {/* Nav items */}
      <nav style={{ padding:'12px 10px', flex:1 }}>
        {items.map(({ id, Icon, label }) => {
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

      {/* Footer / User Profile */}
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
// PLACEHOLDER VIEWS
// ─────────────────────────────────────────────────────────────
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
// APP CONTENT (PROTECTED)
// ─────────────────────────────────────────────────────────────
function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const [view,      setView]     = useState('dashboard');
  const [tareas,    setTareas]   = useState(TAREAS_INIT);
  const [conductores]            = useState(CONDUCTORES_INIT);
  const [vehiculos]              = useState(VEHICULOS_INIT);
  const [modalTarea, setModal]   = useState(null);
  const [theme,      setTheme]   = useState('dark');

  useMemo(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  function handleAsignar(tarea) { setModal(tarea); }

  function handleConfirm(tareaId, condId, vehId) {
    setTareas(prev => prev.map(t =>
      t.id === tareaId ? { ...t, condId, vehId, estado:'asignada' } : t
    ));
    setModal(null);
  }

  const pageTitle = {
    dashboard:   'Dashboard operativo',
    cotizaciones:'Cotizador de Transporte',
    eventos:     'Eventos',
    tareas:      'Tareas del día',
    conductores: 'Conductores',
    vehiculos:   'Vehículos',
    gastos:      'Gastos',
    reportes:    'Reportes',
    usuarios:    'Seguridad y Usuarios',
    config:      'Configuración del Sistema',
  }[view];

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:T.bg, fontFamily:"system-ui,-apple-system,sans-serif",
      color:T.txt, fontSize:14, lineHeight:1.5 }}>
      <Sidebar active={view} setView={setView} user={user} onLogout={logout} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <AlertBar tareas={tareas} />

        {/* Header */}
        <div style={{ padding:'20px 28px 16px', borderBottom:`1px solid ${T.bdr}`,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:T.txt }}>{pageTitle}</h1>
            <div style={{ fontSize:12, color:T.mute, marginTop:2 }}>Miércoles, 9 de abril de 2026</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              style={{ padding:'7px 12px', background:'transparent', border:`1px solid ${T.bdr2}`,
                borderRadius:8, color:T.sub, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />} {theme === 'dark' ? 'Modo Día' : 'Modo Noche'}
            </button>
            <button style={{ padding:'7px 12px', background:'transparent', border:`1px solid ${T.bdr2}`,
              borderRadius:8, color:T.sub, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              <RefreshCcw size={13} /> Actualizar
            </button>
            <button style={{ padding:'7px 14px', background:T.AMB, border:'none',
              borderRadius:8, color:'#000', cursor:'pointer', fontWeight:600, fontSize:13 }}>
              + Nuevo
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, padding:28, overflowY:'auto' }}>
          {view === 'dashboard'   && <Dashboard   tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={EVENTOS} onAsignar={handleAsignar} />}
          {view === 'cotizaciones'&& <CotizadorView vehiculos={vehiculos} onSave={()=>{}} historial={[]} />}
          {view === 'eventos'     && <EventosView eventos={EVENTOS} />}
          {view === 'tareas'      && <Dashboard   tareas={tareas} conductores={conductores} vehiculos={vehiculos} eventos={EVENTOS} onAsignar={handleAsignar} />}
          {view === 'conductores' && <ConductoresView conductores={conductores} tareas={tareas} vehiculos={vehiculos} />}
          {view === 'vehiculos'   && <VehiculosView vehiculos={vehiculos} conductores={conductores} />}
          {view === 'usuarios'    && <UsuarioMgmtView />}
          {view === 'config'      && <ConfiguracionesView />}
          {view === 'gastos'      && <PlaceholderView titulo="Módulo de Gastos" icono={Receipt}   />}
          {view === 'reportes'    && <PlaceholderView titulo="Módulo de Reportes" icono={BarChart3} />}
        </div>
      </div>

      {/* Modal de asignación */}
      {modalTarea && (
        <AsignacionModal
          tarea={modalTarea}
          conductores={conductores}
          vehiculos={vehiculos}
          tareas={tareas}
          eventos={EVENTOS}
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
