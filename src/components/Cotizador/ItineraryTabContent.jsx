import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { loadGoogleMapsApi } from '../../utils/googleMapsLoader';
import { Map, Plus, Trash2, ChevronDown, GripHorizontal } from 'lucide-react';
import { T } from '../../theme';
import { normalizeTimeInput } from '../../utils/voiceDrafts';

function fmtCRC(n) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}

function dayKm(day) {
  return (day.rows || []).reduce((a, r, i) => i === 0 ? a : a + (Number(r.km) || 0), 0);
}

function totalKm(days) {
  return days.reduce((a, d) => a + dayKm(d), 0);
}

function countStops(days) {
  return days.reduce((a, d) => a + (d.rows || []).filter(r => r.tipo === 'inter').length, 0);
}

function avgKm(days) {
  return days.length > 0 ? Math.round(totalKm(days) / days.length) : 0;
}

function createDefaultDay(prevDay) {
  const lastDate = prevDay?.fecha || new Date().toISOString().split('T')[0];
  const next = new Date(lastDate);
  next.setDate(next.getDate() + 1);
  const nf = next.toISOString().split('T')[0];
  const lastPlace = prevDay?.rows?.[prevDay.rows.length - 1]?.lugar || 'Destino';
  return {
    id: `day-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: nf,
    open: true,
    rows: [
      { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}1`, tipo: 'salida', lugar: lastPlace, hora: '07:00', km: 0, coords: null },
      { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}2`, tipo: 'destino', lugar: '', hora: '10:00', km: 0, coords: null },
      { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}3`, tipo: 'regreso', lugar: '', hora: '17:00', km: 0, coords: null },
    ],
  };
}

function calcDistancesBetweenPoints(maps, points) {
  if (!maps || points.length < 2) return Promise.resolve(null);
  const service = new maps.DirectionsService();
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).map(loc => ({ location: loc, stopover: true }));
  return new Promise((resolve) => {
    service.route(
      { origin, destination, waypoints, travelMode: maps.TravelMode.DRIVING, unitSystem: maps.UnitSystem.METRIC },
      (result, status) => {
        if (status === 'OK' && result?.routes?.[0]?.legs) {
          const legKms = result.routes[0].legs.map(leg => Math.round((leg.distance?.value || 0) / 1000));
          resolve(legKms);
        } else {
          resolve(null);
        }
      }
    );
  });
}

function stopRouteValue(stop = {}) {
  const lat = Number(stop.coords?.lat);
  const lng = Number(stop.coords?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return String(stop.lugar || '').trim();
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.mute, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || T.txt }}>{value}</div>
    </div>
  );
}

function Pill({ tipo }) {
  const isSalida = tipo === 'salida';
  const isDestino = tipo === 'destino';
  const isRegreso = tipo === 'regreso';
  return (
    <span style={{
      display: 'inline-block', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
      background: T.card2,
      color: isSalida ? T.GRN : isDestino ? T.BLU : isRegreso ? T.AMB : T.sub,
      border: `1px solid ${isSalida ? `${T.GRN}55` : isDestino ? `${T.BLU}55` : isRegreso ? `${T.AMB}55` : T.bdr2}`,
    }}>
      {isSalida ? 'Salida' : isDestino ? 'Destino' : isRegreso ? 'Regreso' : 'Parada'}
    </span>
  );
}

export default function ItineraryTabContent({ unit, googleMapsApiKey, esViaje, onUpdateDay, onUpdateStop, onAddStop, onRemoveStop, onAddDay, onRemoveLastDay, onClearItinerary, onOpenRouteDesigner, showRouteDesigner }) {
  const mapsLoadedRef = useRef(false);
  const mapsApiRef = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const inputRefs = useRef({});
  const initializedRef = useRef(false);

  const days = unit.itineraryDays || [];

  useEffect(() => {
    if (initializedRef.current) return;
    if (days.length > 0) { initializedRef.current = true; return; }
    initializedRef.current = true;
    const today = new Date().toISOString().split('T')[0];
    onAddDay({
      id: `day-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha: today,
      open: true,
      rows: [
        { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}1`, tipo: 'salida', lugar: '', hora: '07:00', km: 0, coords: null },
        { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}2`, tipo: 'destino', lugar: '', hora: '10:00', km: 0, coords: null },
        { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}3`, tipo: 'regreso', lugar: '', hora: '17:00', km: 0, coords: null },
      ],
    });
  }, []);

  useEffect(() => {
    days.forEach(day => {
      const rows = day.rows || [];
      if (!rows.length || rows.some(row => row.tipo === 'destino')) return;
      const regresoIdx = rows.findIndex(row => row.tipo === 'regreso');
      if (regresoIdx < 0) return;
      const regreso = rows[regresoIdx];
      const nextRows = [
        ...rows.slice(0, regresoIdx),
        { ...regreso, tipo: 'destino' },
        { id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tipo: 'regreso', lugar: '', hora: regreso.hora || '17:00', km: 0, coords: null },
        ...rows.slice(regresoIdx + 1),
      ];
      onUpdateDay(day.id, 'rows', nextRows);
    });
  }, [days, onUpdateDay]);

  const kmTotal = useMemo(() => totalKm(days), [days]);
  const paradas = useMemo(() => countStops(days), [days]);
  const promKm = useMemo(() => avgKm(days), [days]);

  useEffect(() => {
    if (!googleMapsApiKey || mapsLoadedRef.current) return;
    mapsLoadedRef.current = true;
    loadGoogleMapsApi(googleMapsApiKey).then(maps => {
      mapsApiRef.current = maps;
      setMapsReady(true);
    }).catch(() => {});
  }, [googleMapsApiKey]);

  const bindAutocomplete = useCallback((inputNode, dayId, stopId) => {
    if (!inputNode || !mapsApiRef.current) return;
    const key = `${dayId}-${stopId}`;
    if (inputRefs.current[key]?.autocomplete) return;
    try {
      const autocomplete = new mapsApiRef.current.places.Autocomplete(inputNode, {
        componentRestrictions: { country: 'cr' },
        fields: ['formatted_address', 'geometry', 'name'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const coords = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
          const label = place.formatted_address || place.name || inputNode.value;
          onUpdateStop(dayId, stopId, 'coords', coords);
          onUpdateStop(dayId, stopId, 'lugar', label);
          recalcDayDistances(dayId, { stopId, coords, lugar: label });
        }
      });
      inputRefs.current[key] = { input: inputNode, autocomplete };
    } catch (e) {
      // autocomplete not available
    }
  }, [onUpdateStop]);

  const recalcDayDistances = useCallback(async (dayId, overrideStop = null) => {
    const day = days.find(d => d.id === dayId);
    if (!day || !mapsApiRef.current) return;
    const rows = (day.rows || []).map(row => (
      overrideStop && row.id === overrideStop.stopId
        ? { ...row, coords: overrideStop.coords, lugar: overrideStop.lugar }
        : row
    ));
    if (rows.length < 2) return;
    const places = rows.map(stopRouteValue).filter(Boolean);
    if (places.length < 2) return;
    setCalculating(true);
    const kms = await calcDistancesBetweenPoints(mapsApiRef.current, places);
    if (kms && kms.length === rows.length - 1) {
      rows.forEach((r, i) => {
        if (i > 0) {
          r.km = kms[i - 1] || 0;
        }
      });
      onUpdateDay(dayId, 'rows', [...rows]);
    }
    setCalculating(false);
  }, [days, onUpdateDay]);

  const geocodeStopAndRecalc = useCallback((dayId, stopId, value) => {
    const text = String(value || '').trim();
    if (!text || !mapsApiRef.current?.Geocoder) return;
    const coords = stopRouteValue({ coords: days.flatMap(day => day.rows || []).find(row => row.id === stopId)?.coords });
    if (coords && typeof coords === 'object') {
      recalcDayDistances(dayId);
      return;
    }
    const geocoder = new mapsApiRef.current.Geocoder();
    geocoder.geocode({ address: text, componentRestrictions: { country: 'CR' }, region: 'CR' }, (results, status) => {
      const place = status === 'OK' ? results?.[0] : null;
      const location = place?.geometry?.location;
      if (!location) return;
      const nextCoords = {
        lat: Number(location.lat().toFixed(6)),
        lng: Number(location.lng().toFixed(6)),
      };
      const label = place.formatted_address || text;
      onUpdateStop(dayId, stopId, 'coords', nextCoords);
      onUpdateStop(dayId, stopId, 'lugar', label);
      recalcDayDistances(dayId, { stopId, coords: nextCoords, lugar: label });
    });
  }, [days, onUpdateStop, recalcDayDistances]);

  const setLugarRef = useCallback((dayId, stopId, node) => {
    if (node && mapsReady) {
      setTimeout(() => bindAutocomplete(node, dayId, stopId), 100);
    }
  }, [mapsReady, bindAutocomplete]);

  const sortedDays = useMemo(() => {
    return [...days].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  }, [days]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Metric label="D&iacute;as" value={days.length} />
        <Metric label="Paradas totales" value={paradas} color={T.GRN} />
        <Metric label="Km totales" value={`${kmTotal} km`} />
        <Metric label="Km promedio/d&iacute;a" value={`${promKm} km`} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: sortedDays.length > 2 ? 460 : 'none', overflowY: sortedDays.length > 2 ? 'auto' : 'visible', paddingRight: sortedDays.length > 2 ? 4 : 0 }}>
        {sortedDays.map((day, di) => {
          const dkm = dayKm(day);
          const salida = day.rows?.[0]?.lugar || '';
          const regreso = day.rows?.[day.rows.length - 1]?.lugar || '';
          const paradasCount = (day.rows || []).filter(r => r.tipo === 'inter').length;

          return (
            <div key={day.id} style={{ border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden', background: T.card }}>
              <div
                onClick={() => onUpdateDay(day.id, 'open', !day.open)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: T.card2, cursor: 'pointer', userSelect: 'none', borderBottom: day.open ? `1px solid ${T.bdr}` : 'none' }}
              >
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.grnDim, color: T.GRN, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{di + 1}</div>
                <input
                  type="date"
                  value={day.fecha || ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onUpdateDay(day.id, 'fecha', e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.txt, fontFamily: 'inherit', width: 130 }}
                />
                <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: T.mute, whiteSpace: 'nowrap' }}><span style={{ fontWeight: 600, color: T.txt }}>{dkm}</span> km</span>
                  <span style={{ fontSize: 11, color: T.mute, whiteSpace: 'nowrap' }}><span style={{ fontWeight: 600, color: T.txt }}>{paradasCount}</span> parada{paradasCount !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, color: T.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salida} &rarr; {regreso}</span>
                </div>
                <ChevronDown size={16} style={{ color: T.sub, transform: day.open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
              </div>

              {day.open && (
                <div style={{ padding: '10px 14px 12px', background: T.card }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 64, color: T.mute, fontWeight: 500, padding: '4px 6px', borderBottom: `0.5px solid ${T.bdr2}`, textAlign: 'left' }}>Tipo</th>
                        <th style={{ color: T.mute, fontWeight: 500, padding: '4px 6px', borderBottom: `0.5px solid ${T.bdr2}`, textAlign: 'left' }}>Lugar</th>
                        <th style={{ width: 62, color: T.mute, fontWeight: 500, padding: '4px 6px', borderBottom: `0.5px solid ${T.bdr2}`, textAlign: 'left' }}>Hora</th>
                        <th style={{ width: 64, color: T.mute, fontWeight: 500, padding: '4px 6px', borderBottom: `0.5px solid ${T.bdr2}`, textAlign: 'right' }}>Km</th>
                        <th style={{ width: 66, color: T.mute, fontWeight: 500, padding: '4px 6px', borderBottom: `0.5px solid ${T.bdr2}`, textAlign: 'right' }}>Km/d&iacute;a</th>
                        <th style={{ width: 22, color: T.mute, fontWeight: 500, padding: '4px 6px', borderBottom: `0.5px solid ${T.bdr2}` }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let acum = 0;
                        return (day.rows || []).map((stop, si) => {
                          if (si > 0) acum += Number(stop.km) || 0;
                          const txtCls = T.txt;
                          const isLugar = si > 0;
                          const canDel = stop.tipo === 'inter';
                          return (
                            <tr key={stop.id} style={{ borderBottom: si < (day.rows || []).length - 1 ? `0.5px solid ${T.bdr2}` : 'none', background: 'transparent' }}>
                              <td style={{ padding: '4px 6px' }}><Pill tipo={stop.tipo} /></td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  ref={node => setLugarRef(day.id, stop.id, node)}
                                  type="text"
                                  value={stop.lugar}
                                  onChange={e => {
                                    onUpdateStop(day.id, stop.id, 'lugar', e.target.value);
                                    onUpdateStop(day.id, stop.id, 'coords', null);
                                  }}
                                  onBlur={e => geocodeStopAndRecalc(day.id, stop.id, e.target.value)}
                                  placeholder={stop.tipo === 'salida' ? 'Lugar de salida' : stop.tipo === 'destino' ? 'Lugar de destino' : stop.tipo === 'regreso' ? 'Lugar de regreso' : 'Parada intermedia'}
                                  style={{ border: `1px solid ${T.bdr2}`, outline: 'none', background: T.card2, borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12, color: txtCls, width: '100%', boxSizing: 'border-box' }}
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <input type="time" value={stop.hora || ''} onChange={e => onUpdateStop(day.id, stop.id, 'hora', e.target.value)} style={{ border: `1px solid ${T.bdr2}`, outline: 'none', background: T.card2, borderRadius: 8, padding: '7px 6px', fontFamily: 'inherit', fontSize: 12, color: txtCls, width: 76, boxSizing: 'border-box' }} />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                {si === 0 ? (
                                  <span style={{ color: T.mute, fontSize: 11 }}>&mdash;</span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    value={stop.km}
                                    onChange={e => onUpdateStop(day.id, stop.id, 'km', e.target.value)}
                                    style={{ border: `1px solid ${T.bdr2}`, outline: 'none', background: T.card2, borderRadius: 8, padding: '7px 6px', fontFamily: 'inherit', fontSize: 12, color: txtCls, width: 62, textAlign: 'right', boxSizing: 'border-box' }}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 11, color: T.sub }}>{acum} km</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {canDel ? (
                                  <button type="button" onClick={() => onRemoveStop(day.id, stop.id)} style={{ padding: 0, border: 'none', background: 'transparent', color: T.sub, cursor: 'pointer', fontSize: 14, lineHeight: 1 }} title="Quitar parada">&times;</button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: T.sub, padding: '5px 6px', borderTop: `0.5px solid ${T.bdr2}`, background: T.card2 }}>Total d&iacute;a {di + 1}</td>
                        <td style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: T.txt, padding: '5px 6px', borderTop: `0.5px solid ${T.bdr2}`, background: T.card2 }}>{dkm} km</td>
                        <td colSpan="2" style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: T.GRN, padding: '5px 6px', borderTop: `0.5px solid ${T.bdr2}`, background: T.card2 }}>{dkm} km</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => onAddStop(day.id)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.GRN}55`, background: T.grnDim, color: T.GRN, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>+ Parada</button>
                    <button type="button" onClick={() => { const interIdx = (day.rows || []).map((r, i) => r.tipo === 'inter' ? i : -1).filter(i => i >= 0); if (interIdx.length > 0) onRemoveStop(day.id, (day.rows || [])[interIdx[interIdx.length - 1]].id); }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.RED}44`, background: T.redDim, color: T.RED, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Quitar parada</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!days.length && (
        <div style={{ padding: 14, borderRadius: 12, background: T.card2, border: `1px dashed ${T.bdr}`, color: T.mute, fontSize: 13 }}>
          No hay rutas cargadas. Agrega un d&iacute;a o usa el mapa para dise&ntilde;ar la ruta.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!esViaje && (
          <button type="button" onClick={() => onAddDay(createDefaultDay(days[days.length - 1]))} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.GRN}55`, background: T.grnDim, color: T.GRN, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Agregar d&iacute;a
          </button>
        )}
        {!esViaje && days.length > 1 && (
          <button type="button" onClick={onRemoveLastDay} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.RED}44`, background: T.redDim, color: T.RED, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={13} /> Quitar &uacute;ltimo d&iacute;a
          </button>
        )}
        <button
          type="button"
          title="Dise&ntilde;ar ruta en mapa"
          onClick={onOpenRouteDesigner}
          style={{ padding: '5px 12px', borderRadius: 8, border: `0.5px solid ${showRouteDesigner ? `${T.BLU}55` : (googleMapsApiKey ? T.AMB : T.bdr2)}`, background: showRouteDesigner ? T.bluDim : (googleMapsApiKey ? T.ambDim : 'transparent'), color: showRouteDesigner ? T.BLU : (googleMapsApiKey ? T.AMB : T.mute), cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Map size={13} /> Mapa
        </button>
        <button type="button" onClick={onClearItinerary} style={{ padding: '5px 12px', borderRadius: 8, border: `0.5px solid ${T.RED}44`, background: 'transparent', color: T.RED, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={13} /> Limpiar
        </button>
      </div>
    </div>
  );
}
