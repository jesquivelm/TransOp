import { useEffect, useMemo, useRef, useState } from 'react';
import { Bus, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { T } from '../theme';

const RANGE_OPTIONS = [
  { id: 'day', label: 'Dia', days: 1 },
  { id: '3d', label: '3 dias', days: 3 },
  { id: 'week', label: 'Semana', days: 7 },
  { id: '2w', label: '2 semanas', days: 14 },
  { id: 'month', label: 'Mes', days: 31 },
];

const ROW_HEIGHT = 64;
const LABEL_WIDTH = 260;

const toISODate = (value) => new Date(`${value}T00:00:00`);
const formatISO = (date) => date.toISOString().slice(0, 10);
const addDaysISO = (value, amount) => {
  const date = toISODate(value);
  date.setDate(date.getDate() + amount);
  return formatISO(date);
};
const startOfWeekISO = (value) => {
  const date = toISODate(value);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  return formatISO(date);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const startOfRange = (date, rangeId) => {
  if (rangeId === 'week' || rangeId === '2w') return startOfWeekISO(date);
  if (rangeId === 'month') return formatISO(new Date(new Date(`${date}T00:00:00`).getFullYear(), new Date(`${date}T00:00:00`).getMonth(), 1));
  return date;
};
const rangeDays = (rangeId) => RANGE_OPTIONS.find(option => option.id === rangeId)?.days || 7;
const endOfRange = (date, rangeId) => addDaysISO(startOfRange(date, rangeId), rangeDays(rangeId) - 1);
const moveBaseDate = (date, rangeId, direction) => addDaysISO(startOfRange(date, rangeId), rangeDays(rangeId) * direction);
const toMinutes = (time) => {
  const [hours = '0', minutes = '0'] = String(time || '00:00').split(':');
  return (Number(hours) * 60) + Number(minutes);
};
const formatRangeLabel = (from, to) => {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  return `${fromDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })} - ${toDate.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

function buildTimelineDays(from, to) {
  const days = [];
  let current = from;
  while (current <= to) {
    days.push(current);
    current = addDaysISO(current, 1);
  }
  return days;
}

function taskMatchesRow(task, mode, rowId) {
  if (mode === 'vehiculos') {
    if (rowId === 'sin-vehiculo') return !task.vehId;
    return task.vehId === rowId;
  }
  if (rowId === 'sin-conductor') return !task.condId;
  return task.condId === rowId;
}

function getTaskSpan(task, visibleDays) {
  const dayIndex = visibleDays.findIndex(day => day === task.fecha);
  if (dayIndex < 0) return null;
  const startMinutes = toMinutes(task.hora);
  const endMinutes = Math.max(startMinutes + 30, toMinutes(task.fin || task.hora));
  const dayWidth = 100 / visibleDays.length;
  const left = (dayIndex * dayWidth) + ((startMinutes / 1440) * dayWidth);
  const width = Math.max(2, ((endMinutes - startMinutes) / 1440) * dayWidth);
  return { left: `${left}%`, width: `${width}%` };
}

function taskColor(task) {
  switch (task.estado) {
    case 'completada':
      return { bg: T.grnDim, border: `${T.GRN}66`, text: T.GRN };
    case 'en_ruta':
      return { bg: T.bluDim, border: `${T.BLU}66`, text: T.BLU };
    case 'asignada':
      return { bg: T.ambDim, border: `${T.AMB}66`, text: T.AMB };
    case 'incidencia':
      return { bg: T.redDim, border: `${T.RED}66`, text: T.RED };
    default:
      return { bg: 'rgba(148,163,184,0.14)', border: `${T.bdr2}`, text: T.txt };
  }
}

export default function FlotaGanttView({ apiFetch, conductores, vehiculos, eventos, onTooltipChange, onFocusTask }) {
  const [mode, setMode] = useState('vehiculos');
  const [rangeId, setRangeId] = useState('2w');
  const [baseDate, setBaseDate] = useState(todayISO());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const visibleFrom = useMemo(() => startOfRange(baseDate, rangeId), [baseDate, rangeId]);
  const visibleTo = useMemo(() => endOfRange(baseDate, rangeId), [baseDate, rangeId]);
  const visibleDays = useMemo(() => buildTimelineDays(visibleFrom, visibleTo), [visibleFrom, visibleTo]);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiFetch(`/api/tms/tareas?desde=${encodeURIComponent(visibleFrom)}&hasta=${encodeURIComponent(visibleTo)}`);
        if (!cancelled) setTasks(Array.isArray(payload) ? payload : []);
      } catch (loadError) {
        if (!cancelled) {
          setTasks([]);
          setError(loadError.message || 'No se pudo cargar la linea de tiempo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTasks();
    return () => { cancelled = true; };
  }, [apiFetch, visibleFrom, visibleTo]);

  useEffect(() => () => onTooltipChange?.(null), [onTooltipChange]);

  const rows = useMemo(() => {
    const source = mode === 'vehiculos'
      ? vehiculos.map(item => ({
        id: item.id,
        title: item.placa,
        subtitle: `${item.marca} ${item.modelo}`.trim(),
        icon: Bus,
      }))
      : conductores.map(item => ({
        id: item.id,
        title: item.nombre,
        subtitle: item.alias || item.cedula || 'Sin alias',
        icon: User,
      }));

    const unassignedCount = tasks.filter(task => taskMatchesRow(task, mode, mode === 'vehiculos' ? 'sin-vehiculo' : 'sin-conductor')).length;
    if (unassignedCount > 0) {
      source.push({
        id: mode === 'vehiculos' ? 'sin-vehiculo' : 'sin-conductor',
        title: mode === 'vehiculos' ? 'Sin vehiculo asignado' : 'Sin conductor asignado',
        subtitle: 'Tareas pendientes de asignacion',
        icon: mode === 'vehiculos' ? Bus : User,
      });
    }
    return source;
  }, [conductores, mode, tasks, vehiculos]);

  const stats = useMemo(() => ({
    total: tasks.length,
    conEvento: tasks.filter(task => task.eventoId).length,
    sinAsignacion: tasks.filter(task => !task.vehId || !task.condId).length,
    diasActivos: new Set(tasks.map(task => task.fecha).filter(Boolean)).size,
  }), [tasks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '14px 16px', minWidth: 150 }}>
          <div style={{ fontSize: 11, color: T.mute, fontWeight: 700 }}>Tareas visibles</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.txt, marginTop: 8 }}>{stats.total}</div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '14px 16px', minWidth: 150 }}>
          <div style={{ fontSize: 11, color: T.mute, fontWeight: 700 }}>Con evento</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.BLU, marginTop: 8 }}>{stats.conEvento}</div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '14px 16px', minWidth: 150 }}>
          <div style={{ fontSize: 11, color: T.mute, fontWeight: 700 }}>Pendientes de asignacion</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.AMB, marginTop: 8 }}>{stats.sinAsignacion}</div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '14px 16px', minWidth: 150 }}>
          <div style={{ fontSize: 11, color: T.mute, fontWeight: 700 }}>Dias con carga</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.GRN, marginTop: 8 }}>{stats.diasActivos}</div>
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.txt }}>Linea de tiempo operativa</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>
              Esta vista carga tareas por el rango visible para que no desaparezcan cuando el planner esta viendo otro dia.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setBaseDate(prev => moveBaseDate(prev, rangeId, -1))} style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${T.bdr2}`, background: T.card2, color: T.txt, cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ minWidth: 220, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.bdr2}`, background: T.card2, color: T.txt, fontWeight: 800, textAlign: 'center' }}>
              {formatRangeLabel(visibleFrom, visibleTo)}
            </div>
            <button type="button" onClick={() => setBaseDate(prev => moveBaseDate(prev, rangeId, 1))} style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${T.bdr2}`, background: T.card2, color: T.txt, cursor: 'pointer' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'vehiculos', label: 'Por vehiculo' },
              { id: 'conductores', label: 'Por conductor' },
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${mode === option.id ? T.AMB : T.bdr2}`, background: mode === option.id ? T.ambDim : T.card2, color: mode === option.id ? T.AMB : T.sub, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RANGE_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRangeId(option.id)}
                style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${rangeId === option.id ? T.BLU : T.bdr2}`, background: rangeId === option.id ? T.bluDim : T.card2, color: rangeId === option.id ? T.BLU : T.sub, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div style={{ padding: '20px 0', color: T.mute, fontSize: 13 }}>Cargando tareas del rango visible...</div>}
        {!loading && error && <div style={{ padding: '12px 14px', borderRadius: 12, background: T.redDim, border: `1px solid ${T.RED}33`, color: T.RED, fontSize: 13 }}>{error}</div>}
        {!loading && !error && (
          <div ref={containerRef} style={{ overflowX: 'auto', borderRadius: 16, border: `1px solid ${T.bdr}`, background: T.card2 }}>
            <div style={{ minWidth: 980 }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${T.bdr}` }}>
                <div style={{ width: LABEL_WIDTH, flexShrink: 0, padding: '12px 14px', background: T.card3, borderRight: `1px solid ${T.bdr}` }}>
                  <div style={{ fontSize: 11, color: T.mute, fontWeight: 700, letterSpacing: 0.3 }}>{mode === 'vehiculos' ? 'UNIDAD' : 'CONDUCTOR'}</div>
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${visibleDays.length}, minmax(90px, 1fr))` }}>
                  {visibleDays.map(day => (
                    <div key={day} style={{ padding: '10px 8px', borderRight: `1px solid ${T.bdr}`, background: day === todayISO() ? T.bluDim : T.card3 }}>
                      <div style={{ fontSize: 11, color: T.mute, fontWeight: 700 }}>
                        {new Date(`${day}T00:00:00`).toLocaleDateString('es-CR', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: 13, color: T.txt, fontWeight: 800, marginTop: 4 }}>
                        {new Date(`${day}T00:00:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {rows.length === 0 && (
                <div style={{ padding: 24, color: T.mute, fontSize: 13 }}>No hay filas disponibles para mostrar en esta vista.</div>
              )}

              {rows.map(row => {
                const rowTasks = tasks.filter(task => taskMatchesRow(task, mode, row.id));
                return (
                  <div key={row.id} style={{ display: 'flex', minHeight: ROW_HEIGHT, borderBottom: `1px solid ${T.bdr}` }}>
                    <div style={{ width: LABEL_WIDTH, flexShrink: 0, padding: '12px 14px', borderRight: `1px solid ${T.bdr}`, background: T.card3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: T.card2, border: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.AMB }}>
                          <row.icon size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: T.txt }}>{row.title}</div>
                          <div style={{ fontSize: 11, color: T.mute, marginTop: 4 }}>{row.subtitle}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ position: 'relative', flex: 1, minHeight: ROW_HEIGHT, background: T.card2 }}>
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${visibleDays.length}, minmax(90px, 1fr))` }}>
                        {visibleDays.map(day => (
                          <div key={`${row.id}-${day}`} style={{ borderRight: `1px solid ${T.bdr}`, background: day === todayISO() ? 'rgba(59,130,246,0.05)' : 'transparent' }} />
                        ))}
                      </div>
                      {rowTasks.map(task => {
                        const span = getTaskSpan(task, visibleDays);
                        if (!span) return null;
                        const colors = taskColor(task);
                        const event = eventos.find(item => item.id === task.eventoId);
                        const cond = conductores.find(item => item.id === task.condId);
                        const veh = vehiculos.find(item => item.id === task.vehId);
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => onFocusTask?.(task)}
                            onMouseEnter={(eventInfo) => onTooltipChange?.({ tarea: task, evento: event, cond, veh, x: eventInfo.clientX + 12, y: eventInfo.clientY + 12 })}
                            onMouseMove={(eventInfo) => onTooltipChange?.({ tarea: task, evento: event, cond, veh, x: eventInfo.clientX + 12, y: eventInfo.clientY + 12 })}
                            onMouseLeave={() => onTooltipChange?.(null)}
                            style={{ position: 'absolute', left: span.left, width: span.width, top: 10, height: 44, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, cursor: 'pointer', padding: '6px 8px', overflow: 'hidden', boxShadow: '0 6px 16px rgba(15,23,42,0.16)' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.hora} - {task.fin || task.hora}</div>
                            <div style={{ fontSize: 11, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.txt }}>{task.nombre}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
