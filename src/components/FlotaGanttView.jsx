/**
 * FlotaGanttView.jsx — Línea de tiempo de flota TransOP
 *
 * - Vista por vehículo o por conductor (toggle)
 * - Rangos: día, 3 días, semana
 * - Bloques con tarea, cliente, conductor, origen→destino, estado con color
 * - Espacios vacíos visibles (oportunidades)
 * - Navegación por fechas
 * - Tooltip al hover con detalle completo
 */

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Bus, User } from 'lucide-react';

const T = {
  bg:'var(--bg)', card:'var(--card)', card2:'var(--card2)', card3:'var(--card3)',
  bdr:'var(--bdr)', bdr2:'var(--bdr2)', txt:'var(--txt)', mute:'var(--mute)', sub:'var(--sub)',
  AMB:'var(--AMB)', ambDim:'var(--ambDim)', BLU:'var(--BLU)', bluDim:'var(--bluDim)',
  GRN:'var(--GRN)', grnDim:'var(--grnDim)', RED:'var(--RED)', redDim:'var(--redDim)',
  PUR:'var(--PUR)', purDim:'var(--purDim)', ORG:'var(--ORG)', orgDim:'var(--orgDim)',
};

const ESTADO_COLOR = {
  completada:  { bg: 'var(--GRN)',  dim: 'var(--grnDim)', txt: '#fff'   },
  en_ruta:     { bg: 'var(--BLU)',  dim: 'var(--bluDim)', txt: '#fff'   },
  asignada:    { bg: 'var(--AMB)',  dim: 'var(--ambDim)', txt: '#000'   },
  pendiente:   { bg: 'var(--mute)', dim: 'rgba(100,116,139,0.2)', txt: 'var(--txt)' },
  cancelada:   { bg: 'var(--RED)',  dim: 'var(--redDim)', txt: '#fff'   },
  incidencia:  { bg: 'var(--ORG)',  dim: 'var(--orgDim)', txt: '#fff'   },
};

// Hora "HH:MM" → minutos desde medianoche
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Minutos → "HH:MM"
const minToStr = (m) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};

// Sumar n días a una fecha "YYYY-MM-DD"
const addDays = (base, n) => {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Fecha de hoy dinámica en YYYY-MM-DD
const todayISO = () => new Date().toISOString().slice(0, 10);

const RANGES = [
  { id: 'day',  label: 'Día',    days: 1 },
  { id: '3d',   label: '3 días', days: 3 },
  { id: 'week', label: 'Semana', days: 7 },
];

const HOUR_MARKS = [0,2,4,6,8,10,12,14,16,18,20,22];


export default function FlotaGanttView({ tareas, conductores, vehiculos, eventos, onTooltipChange }) {
  const TODAY = todayISO();

  const [rangeId,  setRangeId]  = useState('day');
  const [baseDate, setBaseDate] = useState(TODAY);
  const [modeRows, setModeRows] = useState('vehiculo'); // 'vehiculo' | 'conductor'
  const [tooltip,  setTooltip]  = useState(null);
  const [hoverId,  setHoverId]  = useState(null);
  const containerRef = useRef(null);

  const range = RANGES.find(r => r.id === rangeId);
  const days  = Array.from({ length: range.days }, (_, i) => addDays(baseDate, i));

  const DAY_W   = rangeId === 'day' ? 900 : rangeId === '3d' ? 700 : 500;
  const TOTAL_W = DAY_W * range.days;
  const ROW_H   = 52;
  const LEFT_W  = 160;

  // Hora actual en minutos (dinámica)
  const nowDate = new Date();
  const nowMin  = nowDate.getHours() * 60 + nowDate.getMinutes();

  const rows = modeRows === 'vehiculo'
    ? vehiculos.map(v => ({
        id:     v.id,
        label:  `${v.placa}`,
        sub:    `${v.marca} ${v.modelo}`,
        emoji:  v.tipo === 'Bus' ? '🚌' : '🚐',
        tareas: tareas.filter(t => t.vehId === v.id),
        estado: v.estado,
      }))
    : conductores.map(c => ({
        id:     c.id,
        label:  c.alias || c.nombre.split(' ')[0],
        sub:    c.nombre,
        emoji:  '👤',
        tareas: tareas.filter(t => t.condId === c.id),
        estado: c.estado,
      }));

  /**
   * Calcula la posición y ancho de un bloque de tarea dentro de un día.
   * Usa tarea.fecha (YYYY-MM-DD) para saber si la tarea pertenece a ese día.
   * Si la tarea no tiene fecha guardada (fecha=undefined), la muestra en TODAY
   * para mantener compatibilidad con tareas antiguas.
   */
  const getBlock = (tarea, dayStr) => {
    const tareaFecha = tarea.fecha ? tarea.fecha.slice(0, 10) : TODAY;
    if (tareaFecha !== dayStr) return null;

    const startMin = toMin(tarea.hora);
    const endMin   = toMin(tarea.fin);
    const left  = (startMin / 1440) * DAY_W;
    const width = Math.max(((endMin - startMin) / 1440) * DAY_W, 24);
    return { left, width, startMin, endMin };
  };

  const showTooltip = (e, data) => {
    const t = { ...data, x: e.clientX + 14, y: e.clientY + 14 };
    setTooltip(t);
    onTooltipChange?.(t);
  };

  const moveTooltip = (e) => {
    if (!tooltip) return;
    const t = { ...tooltip, x: e.clientX + 14, y: e.clientY + 14 };
    setTooltip(t);
    onTooltipChange?.(t);
  };

  const hideTooltip = () => {
    setTooltip(null);
    onTooltipChange?.(null);
  };

  const eventMap = {};
  eventos?.forEach(ev => { eventMap[ev.id] = ev; });
  const condMap  = {};
  conductores?.forEach(c => { condMap[c.id] = c; });
  const vehMap   = {};
  vehiculos?.forEach(v => { vehMap[v.id] = v; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

        {/* Toggle modo filas */}
        <div style={{ display: 'flex', background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {[{id:'vehiculo', label:'Por vehículo', Icon: Bus}, {id:'conductor', label:'Por conductor', Icon: User}].map(({id, label, Icon}) => (
            <button key={id} onClick={() => setModeRows(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: modeRows === id ? T.AMB : 'transparent',
                color:      modeRows === id ? '#000' : T.sub,
                transition: 'all .15s',
              }}>
              <Icon size={13}/> {label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: T.bdr }} />

        {/* Selector de rango */}
        <div style={{ display: 'flex', background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRangeId(r.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: rangeId === r.id ? T.card3 : 'transparent',
                color:      rangeId === r.id ? T.txt   : T.mute,
              }}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Navegación de fecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setBaseDate(d => addDays(d, -range.days))}
            style={{ padding: '6px 10px', background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 7, color: T.sub, cursor: 'pointer' }}>
            <ChevronLeft size={14}/>
          </button>
          <div style={{ padding: '6px 14px', background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 7, fontSize: 13, color: T.txt, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
            {range.days === 1
              ? formatDate(baseDate)
              : `${formatDate(baseDate)} – ${formatDate(addDays(baseDate, range.days - 1))}`
            }
          </div>
          <button onClick={() => setBaseDate(d => addDays(d, range.days))}
            style={{ padding: '6px 10px', background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 7, color: T.sub, cursor: 'pointer' }}>
            <ChevronRight size={14}/>
          </button>
          <button onClick={() => setBaseDate(TODAY)}
            style={{ padding: '6px 12px', background: T.ambDim, border: `1px solid ${T.AMB}44`, borderRadius: 7, color: T.AMB, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Hoy
          </button>
        </div>

        {/* Leyenda */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(ESTADO_COLOR).map(([est, c]) => (
            <div key={est} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bg }}/>
              <span style={{ fontSize: 11, color: T.mute, textTransform: 'capitalize' }}>{est.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gantt ────────────────────────────────────────────── */}
      <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, overflow: 'hidden' }}
           ref={containerRef}>

        <div style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative' }}>
          <div style={{ minWidth: LEFT_W + TOTAL_W, position: 'relative' }}>

            {/* ── Header de días y horas ──────────────────── */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.bdr}`, position: 'sticky', top: 0, zIndex: 10, background: T.card }}>
              <div style={{ width: LEFT_W, flexShrink: 0, borderRight: `1px solid ${T.bdr}`,
                padding: '10px 16px', fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: .5 }}>
                {modeRows === 'vehiculo' ? 'VEHÍCULO' : 'CONDUCTOR'}
              </div>

              {days.map(day => (
                <div key={day} style={{ width: DAY_W, flexShrink: 0, borderRight: `1px solid ${T.bdr2}`, position: 'relative' }}>
                  <div style={{
                    padding: '6px 10px 2px', fontSize: 11, fontWeight: 700,
                    color: day === TODAY ? T.AMB : T.sub,
                    borderBottom: `1px solid ${T.bdr2}`,
                    background: day === TODAY ? T.ambDim : 'transparent',
                  }}>
                    {formatDate(day).toUpperCase()}
                    {day === TODAY && <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>● HOY</span>}
                  </div>
                  <div style={{ display: 'flex', position: 'relative', height: 22 }}>
                    {HOUR_MARKS.map(h => (
                      <div key={h} style={{
                        position: 'absolute',
                        left: (h / 24) * DAY_W,
                        fontSize: 10, color: T.mute, paddingTop: 4, paddingLeft: 3,
                        borderLeft: `1px solid ${T.bdr}`,
                        height: '100%',
                      }}>
                        {String(h).padStart(2,'0')}h
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Línea de "ahora" ───────────────────────── */}
            {days.includes(TODAY) && (
              <div style={{
                position: 'absolute',
                left: LEFT_W + days.indexOf(TODAY) * DAY_W + (nowMin / 1440) * DAY_W,
                top: 0, bottom: 0, width: 2,
                background: T.RED, opacity: .7, zIndex: 8, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'sticky', top: 60, width: 42, marginLeft: -20,
                  background: T.RED, color: '#fff', fontSize: 9, fontWeight: 700,
                  padding: '2px 4px', borderRadius: 4, textAlign: 'center',
                }}>
                  {minToStr(nowMin)}
                </div>
              </div>
            )}

            {/* ── Filas ──────────────────────────────────── */}
            {rows.map((row, ri) => {
              const isEven = ri % 2 === 0;
              return (
                <div key={row.id} style={{
                  display: 'flex', height: ROW_H,
                  borderBottom: `1px solid ${T.bdr}`,
                  background: isEven ? 'transparent' : `${T.card2}88`,
                }}>
                  {/* Etiqueta */}
                  <div style={{
                    width: LEFT_W, flexShrink: 0, borderRight: `1px solid ${T.bdr}`,
                    display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
                  }}>
                    <span style={{ fontSize: 20 }}>{row.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 10, color: T.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.sub}
                      </div>
                    </div>
                  </div>

                  {/* Celdas por día */}
                  {days.map(day => (
                    <div key={day} style={{
                      width: DAY_W, flexShrink: 0, borderRight: `1px solid ${T.bdr2}`,
                      position: 'relative', overflow: 'visible',
                    }}>
                      {/* Grid de horas */}
                      {HOUR_MARKS.map(h => (
                        <div key={h} style={{
                          position: 'absolute', left: (h / 24) * DAY_W, top: 0, bottom: 0,
                          borderLeft: `1px solid ${T.bdr}`, opacity: .4, pointerEvents: 'none',
                        }}/>
                      ))}

                      {/* Bloques de tareas */}
                      {row.tareas.map(tarea => {
                        const block = getBlock(tarea, day);
                        if (!block) return null;
                        const col    = ESTADO_COLOR[tarea.estado] ?? ESTADO_COLOR.pendiente;
                        const evento = eventMap[tarea.eventoId];
                        const cond   = condMap[tarea.condId];
                        const veh    = vehMap[tarea.vehId];
                        const isHover = hoverId === tarea.id;

                        return (
                          <div
                            key={tarea.id}
                            onMouseEnter={e => { setHoverId(tarea.id); showTooltip(e, { tarea, evento, cond, veh }); }}
                            onMouseMove={moveTooltip}
                            onMouseLeave={() => { setHoverId(null); hideTooltip(); }}
                            style={{
                              position: 'absolute',
                              left: block.left + 1,
                              width: block.width - 2,
                              top: 6, height: ROW_H - 12,
                              background: col.bg,
                              borderRadius: 6,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              zIndex: isHover ? 20 : 5,
                              boxShadow: isHover ? `0 4px 16px ${col.bg}66` : 'none',
                              transform: isHover ? 'scaleY(1.06)' : 'scaleY(1)',
                              transition: 'all .12s',
                              display: 'flex', flexDirection: 'column', justifyContent: 'center',
                              padding: '0 7px',
                            }}
                          >
                            {block.width > 60 && (
                              <div style={{ fontSize: 10, fontWeight: 700, color: col.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                                {tarea.nombre}
                              </div>
                            )}
                            {block.width > 120 && (
                              <div style={{ fontSize: 9, color: col.txt, opacity: .8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {evento?.cliente ?? ''}{cond && modeRows === 'vehiculo' ? ` · ${cond.alias ?? cond.nombre.split(' ')[0]}` : ''}
                              </div>
                            )}
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                              background: 'rgba(255,255,255,0.3)',
                            }}/>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}

            {rows.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: T.mute, fontSize: 13 }}>
                No hay datos para mostrar.
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Resumen rápido ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'En ruta',      val: tareas.filter(t => t.estado === 'en_ruta').length,    color: T.BLU },
          { label: 'Asignadas',    val: tareas.filter(t => t.estado === 'asignada').length,   color: T.AMB },
          { label: 'Pendientes',   val: tareas.filter(t => t.estado === 'pendiente').length,  color: T.mute },
          { label: 'Completadas',  val: tareas.filter(t => t.estado === 'completada').length, color: T.GRN },
          { label: 'Sin conductor',val: tareas.filter(t => t.estado === 'pendiente' && !t.condId).length, color: T.RED },
        ].map(({ label, val, color }) => (
          <div key={label} style={{
            flex: 1, minWidth: 110, background: T.card, border: `1px solid ${T.bdr}`,
            borderRadius: 10, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 11, color: T.mute, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
