import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Link,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { pdfGen } from '../../utils/pdfGenerator';
import { normalizeTimeInput } from '../../utils/voiceDrafts';
import { useSocios } from '../SociosView';
import { T } from '../../theme';

const ESTADOS = [
  { id: 'borrador', label: 'Borrador', color: T.mute, bg: 'rgba(100,116,139,0.14)' },
  { id: 'enviada', label: 'Enviada', color: T.BLU, bg: T.bluDim },
  { id: 'seguimiento', label: 'Seguimiento', color: T.AMB, bg: T.ambDim },
  { id: 'aprobada', label: 'Aprobada', color: T.GRN, bg: T.grnDim },
  { id: 'rechazada', label: 'Rechazada', color: T.RED, bg: T.redDim },
];

const SECTION_ORDER = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'servicio', label: 'Servicio' },
  { id: 'costos', label: 'Costos operativos' },
  { id: 'extras', label: 'Hospedaje y viaticos' },
  { id: 'itinerario', label: 'Itinerario' },
  { id: 'totales', label: 'Totales' },
];

const PARAMS_DEFAULT = {
  km: 0, combustible: 0.18, tipoCombustible: 'Diesel', tc: 0,
  colaborador: 25, peajes: 15, viaticos: 10, ferry: 0, utilidad: 0, utilidadPct: 0, iva: 13,
  chkDia: false, adicCol: 15, adicViat: 15,
  tarifaGAM: 150, diasGAM: 0, mediaTarifa: 75, diasSM: 0,
  tInSJ: 50, ckTinSJ: false, tOutSJ: 45, ckToutSJ: false,
  tInCTG: 65, ckTinCTG: false, tOutCTG: 60, ckToutCTG: false,
  hospedaje: 40, noches: 0, viatDiario: 25, persViat: 1, persHosp: 1, hospedajeTotalManual: 0,
};

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  background: T.card2,
  border: `1px solid ${T.bdr2}`,
  borderRadius: 8,
  color: T.txt,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const areaStyle = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 72,
};

const mapIconButtonStyle = {
  width: 40,
  height: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: T.card2,
  border: `1px solid ${T.bdr2}`,
  borderRadius: 8,
  color: T.AMB,
  cursor: 'pointer',
  flexShrink: 0,
};

const DEFAULT_MAP_CENTER = { lat: 9.7489, lng: -83.7534 };
const COSTA_RICA_BOUNDS = [
  [8.0, -86.2],
  [11.4, -82.3],
];

function toPoint(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng ?? value.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);

  if (window.__transopLeafletPromise) return window.__transopLeafletPromise;

  window.__transopLeafletPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-leaflet="transop"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L));
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')));
      return;
    }

    if (!document.querySelector('link[data-leaflet-css="transop"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.dataset.leafletCss = 'transop';
      document.head.appendChild(css);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.defer = true;
    script.dataset.leaflet = 'transop';
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error('Leaflet no respondio como se esperaba.'));
    };
    script.onerror = () => reject(new Error('No se pudo cargar Leaflet.'));
    document.head.appendChild(script);
  });

  return window.__transopLeafletPromise;
}

function MapLocationPicker({
  open,
  title,
  initialQuery,
  initialCoords,
  onClose,
  onConfirm,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [query, setQuery] = useState(initialQuery || '');
  const [resolvedLabel, setResolvedLabel] = useState(initialQuery || '');
  const [selectedPoint, setSelectedPoint] = useState(() => toPoint(initialCoords));
  const [status, setStatus] = useState('');
  const [loadingMap, setLoadingMap] = useState(false);
  const [currentCenter, setCurrentCenter] = useState(() => toPoint(initialCoords) || DEFAULT_MAP_CENTER);

  const placeMarker = useCallback(point => {
    if (!point || !markerRef.current || !mapRef.current) return;
    if (!mapRef.current.hasLayer(markerRef.current)) {
      markerRef.current.addTo(mapRef.current);
    }
    markerRef.current.setLatLng(point);
    mapRef.current.panTo(point);
  }, []);

  const reverseGeocodePoint = useCallback(async (point, silent = false) => {
    if (!point) return false;
    if (!silent) setStatus('Resolviendo direccion...');

    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(point.lat));
      url.searchParams.set('lon', String(point.lng));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
      });
      const result = await response.json().catch(() => ({}));
      const nextLabel = result?.display_name || `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      setResolvedLabel(nextLabel);
      setQuery(nextLabel);
      setStatus('Ubicacion lista para guardar.');
      return true;
    } catch (error) {
      setResolvedLabel(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`);
      setStatus(error.message || 'No se pudo resolver la direccion.');
      return false;
    }
  }, []);

  const geocodeText = useCallback(async (value, silent = false) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      if (!silent) setStatus('Escribe una referencia para ubicarla en el mapa.');
      return false;
    }
    if (!silent) setStatus('Buscando ubicacion...');

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '5');
      url.searchParams.set('countrycodes', 'cr');
      url.searchParams.set('q', trimmed);
      url.searchParams.set('viewbox', '-86.2,11.4,-82.3,8.0');
      url.searchParams.set('bounded', '1');
      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
      });
      const results = await response.json().catch(() => []);
      const result = Array.isArray(results) ? results[0] : null;
      if (!result?.lat || !result?.lon) {
        setStatus('No encontre una ubicacion clara en Costa Rica con ese texto.');
        return false;
      }

      const nextPoint = { lat: Number(result.lat), lng: Number(result.lon) };
      placeMarker(nextPoint);
      setSelectedPoint(nextPoint);
      setResolvedLabel(result.display_name || trimmed);
      setQuery(result.display_name || trimmed);
      setStatus('Ubicacion encontrada. Puedes ajustar el pin si hace falta.');
      if (mapRef.current) {
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 0, 16));
      }
      return true;
    } catch (error) {
      setStatus(error.message || 'No se pudo buscar la ubicacion.');
      return false;
    }
  }, [placeMarker]);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setCurrentCenter(DEFAULT_MAP_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentCenter(point);
      },
      () => {
        setCurrentCenter(DEFAULT_MAP_CENTER);
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 300000,
      }
    );
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const startPoint = toPoint(initialCoords);
    setQuery(initialQuery || '');
    setResolvedLabel(initialQuery || '');
    setSelectedPoint(startPoint);
    setStatus('');
    setLoadingMap(true);
    setCurrentCenter(startPoint || DEFAULT_MAP_CENTER);

    if (!startPoint) detectCurrentLocation();

    let cancelled = false;

    loadLeaflet()
      .then(L => {
        if (cancelled || !mapNodeRef.current) return;

        const center = startPoint || currentCenter || DEFAULT_MAP_CENTER;
        mapRef.current = L.map(mapNodeRef.current, {
          center: [center.lat, center.lng],
          zoom: startPoint ? 15 : 8,
          zoomControl: true,
        });
        mapRef.current.setMaxBounds(COSTA_RICA_BOUNDS);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current);

        markerRef.current = L.marker([center.lat, center.lng], {
          draggable: true,
        }).addTo(mapRef.current);

        if (!startPoint) {
          markerRef.current.remove();
          markerRef.current = L.marker([center.lat, center.lng], { draggable: true });
        }

        markerRef.current.on('dragend', async event => {
          const latlng = event.target.getLatLng();
          const nextPoint = {
            lat: latlng.lat,
            lng: latlng.lng,
          };
          setSelectedPoint(nextPoint);
          await reverseGeocodePoint(nextPoint);
        });

        mapRef.current.on('click', async event => {
          const nextPoint = {
            lat: event.latlng.lat,
            lng: event.latlng.lng,
          };
          if (!mapRef.current.hasLayer(markerRef.current)) {
            markerRef.current.addTo(mapRef.current);
          }
          placeMarker(nextPoint);
          setSelectedPoint(nextPoint);
          await reverseGeocodePoint(nextPoint);
        });

        if (startPoint) {
          placeMarker(startPoint);
          reverseGeocodePoint(startPoint, true);
        } else if (initialQuery?.trim()) {
          geocodeText(initialQuery, true);
        }
      })
      .catch(error => {
        if (!cancelled) setStatus(error.message || 'No se pudo inicializar el mapa.');
      })
      .finally(() => {
        if (!cancelled) setLoadingMap(false);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [currentCenter, detectCurrentLocation, geocodeText, initialCoords, initialQuery, open, placeMarker, reverseGeocodePoint]);

  useEffect(() => {
    if (!open || !mapRef.current || selectedPoint) return;
    mapRef.current.panTo(currentCenter);
  }, [currentCenter, open, selectedPoint]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.62)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 90,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          overflow: 'auto',
          background: T.card,
          border: `1px solid ${T.bdr}`,
          borderRadius: 18,
          boxShadow: '0 30px 80px rgba(15,23,42,0.35)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: `1px solid ${T.bdr}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.txt }}>{title}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: T.sub }}>Busca por texto, haz clic en el mapa o arrastra el pin para fijar la ubicacion.</div>
          </div>
          <button type="button" onClick={onClose} style={{ ...mapIconButtonStyle, width: 36, height: 36, color: T.mute }}>
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  geocodeText(query);
                }
              }}
              style={inputStyle}
              placeholder="Hotel, aeropuerto, punto de referencia, direccion..."
            />
            <button
              type="button"
              onClick={() => geocodeText(query)}
              style={{
                padding: '10px 14px',
                background: T.ambDim,
                border: `1px solid ${T.AMB}44`,
                borderRadius: 8,
                color: T.AMB,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Buscar
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(280px,0.9fr)', gap: 16 }}>
            <div style={{ minHeight: 380, borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.bdr}`, background: T.card2, position: 'relative' }}>
              <div ref={mapNodeRef} style={{ position: 'absolute', inset: 0 }} />
              {loadingMap && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.sub, background: 'rgba(15,23,42,0.08)' }}>
                  Cargando mapa...
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8 }}>Ubicacion seleccionada</div>
                <div style={{ fontSize: 13, color: T.txt, lineHeight: 1.5 }}>{resolvedLabel || 'Todavia no has fijado una ubicacion.'}</div>
                {selectedPoint && (
                  <div style={{ marginTop: 10, fontSize: 12, color: T.mute }}>
                    {selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}
                  </div>
                )}
              </div>

              <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8 }}>Estado</div>
                <div style={{ fontSize: 12, color: status.toLowerCase().includes('lista') || status.toLowerCase().includes('encontrada') ? T.GRN : T.mute }}>
                  {status || 'Puedes escribir una referencia o señalar el punto directamente en el mapa.'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 14px',
                    background: 'transparent',
                    border: `1px solid ${T.bdr2}`,
                    borderRadius: 8,
                    color: T.sub,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm({ label: resolvedLabel || query.trim(), coords: selectedPoint })}
                  disabled={!(resolvedLabel || query.trim())}
                  style={{
                    padding: '10px 14px',
                    background: !(resolvedLabel || query.trim()) ? T.card3 : T.AMB,
                    border: `1px solid ${!(resolvedLabel || query.trim()) ? T.bdr2 : T.AMB}`,
                    borderRadius: 8,
                    color: !(resolvedLabel || query.trim()) ? T.mute : '#23180a',
                    cursor: !(resolvedLabel || query.trim()) ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Usar este valor
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function makeProformaNumber() {
  return `PRO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

function to24HourFormat(timeStr) {
  return normalizeTimeInput(timeStr);
}

function toIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const clean = dateStr.trim();
  if (!clean) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const weekdays = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const lower = clean.toLowerCase();
  if (weekdays[lower] !== undefined) {
    const today = new Date();
    const currentDay = today.getDay();
    let daysToAdd = weekdays[lower] - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    return targetDate.toISOString().split('T')[0];
  }
  const match = clean.match(/(\d{1,2})\s+de\s+(\w+)/);
  if (match) {
    const months = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
    if (months[match[2].toLowerCase()] !== undefined) {
      const d = new Date();
      d.setMonth(months[match[2].toLowerCase()]);
      d.setDate(parseInt(match[1], 10));
      return d.toISOString().split('T')[0];
    }
  }
  return '';
}

function newSocio() {
  return {
    cfNumero: '',
    cfValidez: 15,
    cfPago: '50% adelanto, 50% al cierre',
    cfDescripcion: '',
    cfDescripcionMode: 'auto',
    sCodigoCliente: '',
    sNombre: '',
    sCedula: '',
    sEmail: '',
    sTel: '',
    sEmpresa: '',
    sCargo: '',
    sContacto: '',
    sDireccion: '',
    sPais: 'Costa Rica',
    sNotas: '',
    sPax: 1,
    sFecha: '',
    sHora: '',
    sOrigen: '',
    sOrigenCoords: null,
    sDestino: '',
    sDestinoCoords: null,
    _estado: 'borrador',
  };
}

function buildAutoDescription(socio) {
  const parts = [];
  const route = [socio.sOrigen, socio.sDestino].filter(Boolean).join(' -> ');
  const when = [socio.sFecha, socio.sHora].filter(Boolean).join(' ');

  if (route) parts.push(`Servicio de transporte ${route}.`);
  else parts.push('Servicio de transporte.');

  if (when) parts.push(`Fecha y hora: ${when}.`);
  if (socio.sPax) parts.push(`Pasajeros: ${socio.sPax}.`);
  if (socio.sEmpresa || socio.sNombre) parts.push(`Cliente: ${socio.sEmpresa || socio.sNombre}.`);

  return parts.join(' ').trim();
}

function inferDescriptionMode(socio) {
  const manualText = String(socio?.cfDescripcion || '').trim();
  const autoText = buildAutoDescription(socio).trim();
  if (!manualText) return 'auto';
  return manualText === autoText ? 'auto' : 'manual';
}

function Label({ estado }) {
  const status = ESTADOS.find(item => item.id === estado) || ESTADOS[0];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: status.color,
        background: status.bg,
        letterSpacing: 0.2,
      }}
    >
      {status.label.toUpperCase()}
    </span>
  );
}

function Field({ label, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>{label}</label>
      {children}
    </div>
  );
}

function fmt(v) {
  const fixed = Number(v || 0).toFixed(2);
  const [whole, decimals] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `$${grouped}.${decimals}`;
}

function fmtCRC(v) {
  const whole = String(Math.round(Number(v || 0)));
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function shortText(text, fallback = 'Sin informacion') {
  if (!text) return fallback;
  return text.length > 110 ? `${text.slice(0, 107)}...` : text;
}

function chooseSuggestedVehicle(vehiculos, pasajeros, currentVehiculoId = null) {
  const pax = Number(pasajeros || 0);
  if (!Array.isArray(vehiculos) || vehiculos.length === 0) return null;
  if (!pax) return currentVehiculoId || vehiculos[0]?.id || null;

  const disponibles = vehiculos.filter(item => item.estado !== 'fuera_de_servicio');
  const base = disponibles.length ? disponibles : vehiculos;
  const candidatos = base
    .filter(item => Number(item.cap || 0) >= pax)
    .sort((a, b) => Number(a.cap || 0) - Number(b.cap || 0));

  if (candidatos[0]?.id) return candidatos[0].id;

  const currentVehicle = base.find(item => item.id === currentVehiculoId);
  if (currentVehicle && Number(currentVehicle.cap || 0) >= pax) return currentVehicle.id;

  return null;
}

function buildVehicleDefaults(vehiculo = {}, fuelPrices = null, tc = 512) {
  let combustible = Number(vehiculo.combustible_costo) || 0;
  if (fuelPrices && Number(vehiculo.rendimiento) > 0) {
    const tipo = (vehiculo.combustible_tipo || 'Diésel').toLowerCase();
    const priceCRC = Number(fuelPrices[tipo === 'súper' ? 'super' : tipo === 'regular' ? 'regular' : 'diesel']) || 0;
    const safeTC = Number(tc) || 512;
    if (priceCRC > 0 && safeTC > 0) {
      combustible = (priceCRC / (Number(vehiculo.rendimiento) || 1)) / safeTC;
    }
  }
  return {
    colaborador: Number(vehiculo.colaborador) || 0,
    combustible: Number(combustible) || 0,
    tipoCombustible: vehiculo.combustible_tipo || 'Diésel',
    peajes: Number(vehiculo.peajes) || 0,
    viaticos: Number(vehiculo.viaticos) || 0,
    utilidad: Number(vehiculo.utilidad) || 0,
  };
}

function createProformaUnit(base = {}, vehiculos = [], preferredVehiculoId = null, fuelPrices = null, tc = 512) {
  const vehiculoId = base.vehiculoId || preferredVehiculoId || chooseSuggestedVehicle(vehiculos, base.sPax || 0, null) || vehiculos[0]?.id || null;
  const vehiculo = vehiculos.find(item => item.id === vehiculoId) || {};
  const defaults = buildVehicleDefaults(vehiculo, fuelPrices, tc);
  return {
    id: base.id || `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sFecha: base.sFecha || '',
    sHora: base.sHora || '',
    sPax: Number(base.sPax || 1),
    sOrigen: base.sOrigen || '',
    sOrigenCoords: base.sOrigenCoords || null,
    sDestino: base.sDestino || '',
    sDestinoCoords: base.sDestinoCoords || null,
    km: Number(base.km || 0),
    combustible: Number(base.combustible ?? defaults.combustible),
    tipoCombustible: base.tipoCombustible || defaults.tipoCombustible,
    colaborador: Number(base.colaborador ?? defaults.colaborador),
    peajes: Number(base.peajes ?? defaults.peajes),
    ferry: Number(base.ferry ?? defaults.ferry),
    ...defaults,
    ...base,
    vehiculoId,
  };
}

function hydrateProformaUnits({ savedUnits = [], socioData = {}, paramsData = {}, vehiculos = [], vehiculoId = null }) {
  if (Array.isArray(savedUnits) && savedUnits.length > 0) {
    return savedUnits.map(unit => createProformaUnit(unit, vehiculos, unit.vehiculoId || vehiculoId));
  }

  return [createProformaUnit({
    sFecha: socioData.sFecha || '',
    sHora: socioData.sHora || '',
    sPax: socioData.sPax || 1,
    sOrigen: socioData.sOrigen || '',
    sOrigenCoords: socioData.sOrigenCoords || null,
    sDestino: socioData.sDestino || '',
    sDestinoCoords: socioData.sDestinoCoords || null,
    km: paramsData.km || 0,
    combustible: paramsData.combustible,
    tipoCombustible: paramsData.tipoCombustible,
    colaborador: paramsData.colaborador,
    peajes: paramsData.peajes,
    ferry: paramsData.ferry,
    vehiculoId,
  }, vehiculos, vehiculoId)];
}

function createItineraryRow(base = {}) {
  return {
    id: base.id || `itin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: base.fecha || '',
    hora: normalizeTimeInput(base.hora || '') || '',
    origen: base.origen || '',
    destino: base.destino || '',
  };
}

function sanitizeItineraryRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => createItineraryRow(row));
}

function itineraryRowComplete(row) {
  return Boolean(String(row?.fecha || '').trim() && String(row?.hora || '').trim() && String(row?.origen || '').trim() && String(row?.destino || '').trim());
}

function addOneHour(time) {
  const normalized = normalizeTimeInput(time || '');
  if (!normalized) return '01:00';
  const [h, m] = normalized.split(':').map(Number);
  const nextMinutes = ((h * 60 + m + 60) % (24 * 60));
  const hh = String(Math.floor(nextMinutes / 60)).padStart(2, '0');
  const mm = String(nextMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toSlashDate(isoDate) {
  if (!isoDate || !String(isoDate).includes('-')) return '';
  const [, month, day] = String(isoDate).split('-');
  if (!month || !day) return '';
  return `${day}/${month}`;
}

function getEmpresaUtilidadPct(empresaData = {}) {
  const raw = empresaData?.porcentaje_utilidad
    ?? empresaData?.porcentajeUtilidad
    ?? empresaData?.utilidadPct
    ?? empresaData?.utilidad_pct;
  return Number(raw) || 0;
}

function buildDefaultParams({ tc = PARAMS_DEFAULT.tc, empresaData = {} } = {}) {
  return {
    ...PARAMS_DEFAULT,
    tc: Number(tc) || PARAMS_DEFAULT.tc,
    utilidadPct: getEmpresaUtilidadPct(empresaData),
    utilidad: 0,
  };
}

function normalizeStoredParams(rawParams = {}, { fallbackTc = PARAMS_DEFAULT.tc, empresaData = {} } = {}) {
  const hasUtilityPct = rawParams.utilidadPct != null
    || rawParams.porcentajeUtilidad != null
    || rawParams.porcentaje_utilidad != null;
  return {
    ...PARAMS_DEFAULT,
    ...rawParams,
    tc: Number(rawParams.tc) || Number(fallbackTc) || PARAMS_DEFAULT.tc,
    utilidadPct: hasUtilityPct
      ? (Number(rawParams.utilidadPct ?? rawParams.porcentajeUtilidad ?? rawParams.porcentaje_utilidad) || 0)
      : getEmpresaUtilidadPct(empresaData),
    utilidad: hasUtilityPct ? 0 : (Number(rawParams.utilidad) || 0),
  };
}

function summarizeUnits(units = [], vehiculos = []) {
  if (!Array.isArray(units) || units.length === 0) return 'Sin unidades definidas';
  const compact = units.slice(0, 3).map((unit, index) => {
    const vehiculo = vehiculos.find(item => item.id === unit.vehiculoId);
    const unitLabel = vehiculo?.placa || `U${index + 1}`;
    const pax = unit.sPax ? `${unit.sPax} pax` : 'Sin pax';
    const route = [unit.sOrigen, unit.sDestino].filter(Boolean).join(' -> ') || 'Sin ruta';
    return `${unitLabel}: ${pax} · ${shortText(route, 'Sin ruta')}`;
  });
  if (units.length > 3) compact.push(`+${units.length - 3} mas`);
  return compact.join(' | ');
}

function buildListItem(proforma) {
  const socio = proforma.data_json?.socio || {};
  return {
    ...proforma,
    socio,
    estado: proforma.data_json?.estado || socio._estado || 'borrador',
    origenDestino: [socio.sOrigen, socio.sDestino].filter(Boolean).join(' -> '),
    clienteLabel: socio.sNombre || proforma.cliente_nombre || 'Sin cliente',
    clienteCodigo: socio.sCodigoCliente || 'Sin codigo',
  };
}

function AccordionSection({ id, label, summary, open, onToggle, children, accent = T.AMB, actions = null }) {
  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        alignSelf: 'stretch',
        background: T.card2,
        border: `1px solid ${open ? `${accent}55` : T.bdr}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          padding: '16px 18px',
          border: 'none',
          background: 'transparent',
          color: T.txt,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: open ? accent : T.txt }}>{label}</span>
          </div>
          {!open && summary && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: T.sub,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {summary}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {actions}
          <ChevronDown
            size={18}
            color={open ? accent : T.mute}
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
          />
        </div>
      </button>
      <div
        style={{
          maxHeight: open ? 1600 : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          borderTop: `1px solid ${open ? T.bdr : 'transparent'}`,
          transition: 'max-height 0.28s ease, opacity 0.2s ease',
        }}
      >
        <div
          style={{
            padding: '0 18px 18px',
            transform: open ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'transform 0.28s ease',
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function CotizadorView({ voiceDraft = null, onVoiceDraftApplied, onHeaderMetaChange, onCreateEvento, onCreateTarea }) {
  const { token, user } = useAuth();
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const [tabs, setTabs] = useState([{ id: 'lista', type: 'list', label: 'Proformas' }]);
  const [activeTabId, setActiveTabId] = useState('lista');
  const [tabsData, setTabsData] = useState({});

  // Persistencia de pestañas en localStorage para evitar pérdida de datos al cambiar de módulo
  useEffect(() => {
    const savedTabs = localStorage.getItem('tms_cotizador_tabs');
    const savedData = localStorage.getItem('tms_cotizador_tabs_data');
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        const parsedData = JSON.parse(savedData);
        if (parsedTabs && parsedTabs.length > 0) {
          setTabs(parsedTabs);
          setTabsData(parsedData || {});
        }
      } catch (e) { console.error("Error cargando cache de pestañas", e); }
    }
  }, []);

  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem('tms_cotizador_tabs', JSON.stringify(tabs));
      localStorage.setItem('tms_cotizador_tabs_data', JSON.stringify(tabsData));
    }
  }, [tabs, tabsData]);
  const [openSection, setOpenSection] = useState('');
  const [vehiculoActivo, setVehiculoActivo] = useState(null);
  const [units, setUnits] = useState([createProformaUnit()]);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [params, setParams] = useState(() => buildDefaultParams());
  const [socio, setSocio] = useState(newSocio());
  const [resData, setResData] = useState({});
  const [historial, setHistorial] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState(null);
  const [distanceStatus, setDistanceStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [socioSearch, setSocioSearch] = useState('');
  const [showSocioSuggestions, setShowSocioSuggestions] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [mapPickerField, setMapPickerField] = useState('');
  const [clienteFromBD, setClienteFromBD] = useState(false);
  const [conductores, setConductores] = useState([]);
  const [showConductorPicker, setShowConductorPicker] = useState(false);
  const [fuelPrices, setFuelPrices] = useState(null);
  const [empresaData, setEmpresaData] = useState({});
  const [itineraryRows, setItineraryRows] = useState([]);
  const [operationMsg, setOperationMsg] = useState('');

  const autosaveTimer = useRef(null);
  const lastSavedSignature = useRef('');
  const savingRef = useRef(false);
  const guardarRef = useRef(null);

  const { socios: sociosBD, loading: loadingSocios } = useSocios(token);
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  const isListTab = activeTab?.type === 'list';
  const isDetailTab = !isListTab;
  const activeUnit = units.find(unit => unit.id === activeUnitId) || units[0] || null;

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, hRes, cRes, tcRes, fRes, eRes] = await Promise.all([
        fetch('/api/tms/vehiculos', { headers: authH }),
        fetch('/api/tms/proformas', { headers: authH }),
        fetch('/api/tms/config/global', { headers: authH }),
        fetch('/api/tms/tipos-cambio/ultimo', { headers: authH }),
        fetch('/api/tms/combustibles/actual', { headers: authH }),
        fetch('/api/tms/config/empresa', { headers: authH }),
      ]);

      if (vRes.ok) {
        const vData = await vRes.json();
        setVehiculos(vData);
        if (vData.length > 0 && !vehiculoActivo) setVehiculoActivo(vData[0].id);
      }

      if (hRes.ok) setHistorial(await hRes.json());

      if (cRes.ok) {
        const c = await cRes.json();
        if (c?.params) {
          // km nunca se pisa desde la config global — es siempre manual
          const { km: _km, ...restParams } = c.params;
          setParams(prev => ({ ...prev, ...restParams }));
        }
      }

      // Obtener tipo de cambio del API
      if (tcRes.ok) {
        const tcData = await tcRes.json();
        if (tcData.success && tcData.rate) {
          setParams(prev => ({ ...prev, tc: tcData.rate }));
        }
      }
      if (fRes.ok) {
        const fData = await fRes.json();
        if (fData.success) setFuelPrices(fData.prices);
      }
      if (eRes && eRes.ok) {
        const eData = await eRes.json();
        if (eData.success) {
          const nextEmpresa = eData.data || {};
          setEmpresaData(nextEmpresa);
          setParams(prev => {
            if (Number(prev.utilidadPct || 0) > 0 || Number(prev.utilidad || 0) > 0) return prev;
            return { ...prev, utilidadPct: getEmpresaUtilidadPct(nextEmpresa) };
          });
        }
      }
    } catch (error) {
      console.error('Error cargando datos del cotizador:', error);
    } finally {
      setLoading(false);
    }
  }, [authH, vehiculoActivo]);

  useEffect(() => {
    if (token) cargarDatos();
  }, [cargarDatos, token]);

  useEffect(() => {
    if (!vehiculos.length) return;
    setUnits(prev => prev.map((unit, index) => {
      if (unit.vehiculoId) return unit;
      if (index !== 0) return unit;
      return createProformaUnit(unit, vehiculos, vehiculoActivo || vehiculos[0]?.id || null, fuelPrices, params.tc);
    }));
  }, [vehiculoActivo, vehiculos, fuelPrices, params.tc]);

  useEffect(() => {
    if (!units.length) {
      if (activeUnitId !== null) setActiveUnitId(null);
      return;
    }
    if (!activeUnitId || !units.some(unit => unit.id === activeUnitId)) {
      setActiveUnitId(units[0].id);
    }
  }, [activeUnitId, units]);

  const calculateDistance = async ({ silent = false } = {}) => {
    const origin = String(socio.sOrigen || '').trim();
    const destination = String(socio.sDestino || '').trim();
    const originCoords = toPoint(socio.sOrigenCoords);
    const destinationCoords = toPoint(socio.sDestinoCoords);

    if (!origin || !destination) {
      if (!silent) setDistanceStatus('Primero indica origen y destino.');
      return false;
    }

    if (!silent) setDistanceStatus('Calculando kilometraje...');

    try {
      const response = await fetch('/api/tms/routes/estimate-distance', {
        method: 'POST',
        headers: authH,
        body: JSON.stringify({ origin, destination, originCoords, destinationCoords }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success || !Number(payload.km)) {
        if (!silent) setDistanceStatus(payload.error || 'No se pudo calcular la distancia.');
        return false;
      }

      const km = Number(payload.km);
      setParams(prev => ({ ...prev, km }));
      setDistanceStatus(`Distancia estimada: ${km} km.`);
      return true;
    } catch (error) {
      if (!silent) setDistanceStatus(error.message || 'No se pudo calcular la distancia.');
      return false;
    }
  }

  useEffect(() => {
    const p = params;
    const unitBreakdown = units.map(unit => {
      const costoKm = Number(unit.km || 0) * Number(unit.combustible || 0);
      const subtotal = costoKm + Number(unit.colaborador || 0) + Number(unit.peajes || 0) + Number(unit.ferry || 0);
      return { ...unit, costoKm, subtotal };
    });
    const baseUnits = unitBreakdown.reduce((acc, unit) => acc + unit.subtotal, 0);
    const adicionalDia = p.chkDia ? Number(p.adicCol || 0) + Number(p.adicViat || 0) : 0;
    const base = baseUnits + adicionalDia;

    const tarFijas =
      (p.diasGAM * p.tarifaGAM) + (p.diasSM * p.mediaTarifa) +
      (p.ckTinSJ ? p.tInSJ : 0) + (p.ckToutSJ ? p.tOutSJ : 0) +
      (p.ckTinCTG ? p.tInCTG : 0) + (p.ckToutCTG ? p.tOutCTG : 0);

    const hospedajeCalculado = p.hospedajeTotalManual > 0
      ? p.hospedajeTotalManual
      : (p.noches * p.hospedaje * Math.max(Number(p.persHosp || 0), 0));
    const viaticosDiarios = Number(p.viatDiario || 0) * Number(p.persViat || 0);
    const extras = hospedajeCalculado + viaticosDiarios;
    const subtotalOperativo = base;
    const subtotalTransfer = tarFijas;
    const subtotalExtras = extras;
    const utilidadBase = subtotalOperativo + subtotalTransfer + subtotalExtras;
    const utilidadAmt = Number(p.utilidadPct || 0) > 0
      ? utilidadBase * (Number(p.utilidadPct || 0) / 100)
      : Number(p.utilidad || 0);
    const subtotalAntesIVA = utilidadBase + utilidadAmt;
    const ivaAmt = subtotalAntesIVA * (p.iva / 100);
    const total = subtotalAntesIVA + ivaAmt;

    setResData({
      unitBreakdown,
      costoKm: baseUnits,
      base,
      adicionalDia,
      subtotalOperativo,
      subtotalTransfer,
      subtotalExtras,
      tarFijas,
      hospedajeCalculado,
      viaticosDiarios,
      extras,
      utilidadAmt,
      subtotal: subtotalAntesIVA,
      ivaAmt,
      total,
      totalCRC: total * p.tc,
    });
  }, [params, units]);

  const currentStatus = socio._estado || 'borrador';
  const selectedVehiculo = vehiculos.find(item => item.id === (units[0]?.vehiculoId || vehiculoActivo));
  const primaryItineraryRow = useMemo(() => createItineraryRow({
    id: 'itin-base',
    fecha: units[0]?.sFecha || socio.sFecha || '',
    hora: units[0]?.sHora || socio.sHora || '',
    origen: units[0]?.sOrigen || socio.sOrigen || '',
    destino: units[0]?.sDestino || socio.sDestino || '',
  }), [socio.sDestino, socio.sFecha, socio.sHora, socio.sOrigen, units]);
  const itineraryRowsComplete = useMemo(() => {
    const extraRows = sanitizeItineraryRows(itineraryRows).filter(row => itineraryRowComplete(row));
    return itineraryRowComplete(primaryItineraryRow)
      ? [primaryItineraryRow, ...extraRows]
      : extraRows;
  }, [itineraryRows, primaryItineraryRow]);
  const itineraryIsEvent = itineraryRowsComplete.length > 1;
  const autoDescription = useMemo(() => {
    const firstUnit = units[0] || {};
    return buildAutoDescription({
      ...socio,
      sOrigen: firstUnit.sOrigen || '',
      sDestino: firstUnit.sDestino || '',
      sFecha: firstUnit.sFecha || '',
      sHora: firstUnit.sHora || '',
      sPax: firstUnit.sPax || 0,
    });
  }, [socio, units]);

  useEffect(() => {
    if (socio.cfDescripcionMode !== 'auto') return;
    if ((socio.cfDescripcion || '') === autoDescription) return;
    setSocio(prev => ({ ...prev, cfDescripcion: autoDescription }));
  }, [autoDescription, socio.cfDescripcion, socio.cfDescripcionMode]);

  const buildCurrentTabSnapshot = useCallback(() => ({
    selectedId,
    params: { ...params },
    socio: { ...socio },
    units: units.map(unit => ({ ...unit })),
    itineraryRows: itineraryRows.map(row => ({ ...row })),
    activeUnitId,
    vehiculoActivo,
    openSection,
    socioSearch,
    showSocioSuggestions,
    showStatusMenu,
    mapPickerField,
    voiceFeedback,
    clienteFromBD,
    autoSaveEnabled,
    distanceStatus,
    savedMsg,
    operationMsg,
  }), [
    autoSaveEnabled,
    clienteFromBD,
    distanceStatus,
    itineraryRows,
    mapPickerField,
    openSection,
    operationMsg,
    params,
    savedMsg,
    selectedId,
    showSocioSuggestions,
    showStatusMenu,
    socio,
    socioSearch,
    units,
    activeUnitId,
    vehiculoActivo,
    voiceFeedback,
  ]);

  const restoreTabSnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      setSelectedId(null);
      const freshDefaults = buildDefaultParams({ tc: params.tc, empresaData });
      setParams(freshDefaults);
      setSocio(newSocio());
      setUnits([createProformaUnit({}, vehiculos, vehiculos[0]?.id || null, fuelPrices, freshDefaults.tc)]);
      setItineraryRows([]);
      setActiveUnitId(null);
      setVehiculoActivo(vehiculos.length > 0 ? vehiculos[0].id : null);
      setOpenSection('');
      setSocioSearch('');
      setShowSocioSuggestions(false);
      setShowStatusMenu(false);
      setMapPickerField('');
      setVoiceFeedback(null);
      setClienteFromBD(false);
      setAutoSaveEnabled(false);
      setDistanceStatus('');
      setSavedMsg('');
      setOperationMsg('');
      lastSavedSignature.current = '';
      return;
    }

    // Sanitize units data to prevent NaN errors
    const safeUnits = (snapshot.units || []).map(u => ({
      ...u,
      id: u.id || `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      km: Number(u.km) || 0,
      combustible: Number(u.combustible) || 0,
      colaborador: Number(u.colaborador) || 0,
      peajes: Number(u.peajes) || 0,
      ferry: Number(u.ferry) || 0,
      sPax: Number(u.sPax) || 1,
    }));

    // Sanitize params to avoid unparsed numeric values
    const safeParams = snapshot.params ? {
      ...normalizeStoredParams(snapshot.params, { fallbackTc: params.tc || 512, empresaData }),
      adicCol: Number(snapshot.params.adicCol) || 0,
      adicViat: Number(snapshot.params.adicViat) || 0,
      hospedaje: Number(snapshot.params.hospedaje) || 0,
      noches: Number(snapshot.params.noches) || 0,
      persHosp: Number(snapshot.params.persHosp) || 0,
      persViat: Number(snapshot.params.persViat) || 0,
      hospedajeTotalManual: Number(snapshot.params.hospedajeTotalManual) || 0,
    } : buildDefaultParams({ tc: params.tc, empresaData });

    setSelectedId(snapshot.selectedId || null);
    setParams(safeParams);
    setSocio(snapshot.socio ? { ...newSocio(), ...snapshot.socio } : newSocio());
    setUnits(safeUnits.length ? safeUnits : [createProformaUnit({}, vehiculos, null, fuelPrices, safeParams.tc)]);
    setItineraryRows(sanitizeItineraryRows(snapshot.itineraryRows || []));
    setVehiculoActivo(snapshot.vehiculoActivo || (vehiculos[0]?.id || null));
    setActiveUnitId(snapshot.activeUnitId || (safeUnits.length ? safeUnits[0].id : null));
    setOpenSection(snapshot.openSection || '');
    setSocioSearch(snapshot.socioSearch || '');
    setShowSocioSuggestions(Boolean(snapshot.showSocioSuggestions));
    setShowStatusMenu(Boolean(snapshot.showStatusMenu));
    setMapPickerField(snapshot.mapPickerField || '');
    setVoiceFeedback(snapshot.voiceFeedback || null);
    setClienteFromBD(Boolean(snapshot.clienteFromBD));
    setAutoSaveEnabled(Boolean(snapshot.autoSaveEnabled));
    setDistanceStatus(snapshot.distanceStatus || '');
    setSavedMsg(snapshot.savedMsg || '');
    setOperationMsg(snapshot.operationMsg || '');
  }, [empresaData, fuelPrices, params.tc, vehiculos]);

  const payloadSignature = useMemo(() => JSON.stringify({
    numero: socio.cfNumero,
    cliente_nombre: socio.sNombre,
    cliente_empresa: socio.sEmpresa,
    total_usd: resData.total,
    data_json: { params, socio, units, itineraryRows, vehiculoId: units[0]?.vehiculoId || vehiculoActivo, estado: currentStatus },
  }), [currentStatus, itineraryRows, params, resData.total, socio, units, vehiculoActivo]);

  const guardar = useCallback(async (estadoOverride, forceCreate = false) => {
    if (savingRef.current) return null;
    const estado = estadoOverride ?? socio._estado ?? 'borrador';
    
    let numeroFinal = socio.cfNumero;
    if (!numeroFinal && forceCreate) {
      numeroFinal = makeProformaNumber();
    }
    
    // No guardamos a la BD si no tenemos numero (caso de borrador no guardado aun)
    if (!numeroFinal) return null;

    const payload = {
      numero: numeroFinal,
      cliente_nombre: socio.sNombre,
      cliente_empresa: socio.sEmpresa,
      total_usd: resData.total,
      data_json: { params, socio: { ...socio, _estado: estado }, units, itineraryRows, vehiculoId: units[0]?.vehiculoId || vehiculoActivo, estado },
    };

    savingRef.current = true;
    try {
      const res = await fetch('/api/tms/proformas', {
        method: 'POST',
        headers: authH,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status} al guardar`);

      setSocio(prev => ({ ...prev, cfNumero: numeroFinal, _estado: estado }));
      const resolvedId = data.id || selectedId;
      setSelectedId(resolvedId);
      if (activeTabId !== 'lista') {
        setTabs(prev => prev.map(tab => (
          tab.id === activeTabId
            ? {
                ...tab,
                id: resolvedId ? `proforma-${resolvedId}` : tab.id,
                type: resolvedId ? 'proforma' : tab.type,
                sourceId: resolvedId || tab.sourceId,
                label: socio.cfNumero,
              }
            : tab
        )));
        if (resolvedId && activeTabId !== `proforma-${resolvedId}`) {
          setTabsData(prev => {
            const next = { ...prev };
            next[`proforma-${resolvedId}`] = next[activeTabId] || buildCurrentTabSnapshot();
            delete next[activeTabId];
            return next;
          });
          setActiveTabId(`proforma-${resolvedId}`);
        }
      }
      lastSavedSignature.current = JSON.stringify(payload);
      setSavedMsg('Guardado ✓');
      setTimeout(() => setSavedMsg(''), 1800);
      // Solo refrescamos el historial, no params — para no pisar km ni otros campos
      const hRes = await fetch('/api/tms/proformas', { headers: authH });
      if (hRes.ok) setHistorial(await hRes.json());
      return { numero: numeroFinal, id: resolvedId, estado };
    } catch (error) {
      console.error('Error guardando proforma:', error);
      setSavedMsg('Error al guardar');
      setTimeout(() => setSavedMsg(''), 2500);
      throw error;
    } finally {
      savingRef.current = false;
    }
  }, [activeTabId, authH, buildCurrentTabSnapshot, itineraryRows, params, resData.total, selectedId, socio, units, vehiculoActivo]);

  // Mantener guardarRef apuntando siempre a la versión más reciente de guardar
  // para poder llamarla desde el autosave sin que sea una dependencia del timer
  guardarRef.current = guardar;

  useEffect(() => {
    if (!autoSaveEnabled || !isDetailTab || !socio.cfNumero) return;
    if (payloadSignature === lastSavedSignature.current) return;

    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      guardarRef.current?.();
    }, 1400);

    return () => clearTimeout(autosaveTimer.current);
  }, [autoSaveEnabled, isDetailTab, payloadSignature]);

  // Sincronizar estado local con tabsData permanentemente
  useEffect(() => {
    if (activeTabId === 'lista') return;
    const snapshot = buildCurrentTabSnapshot();
    setTabsData(prev => ({
      ...prev,
      [activeTabId]: {
        ...(prev[activeTabId] || {}),
        ...snapshot
      }
    }));
  }, [units, socio, params, activeTabId, buildCurrentTabSnapshot]);

  useEffect(() => {
    clearTimeout(autosaveTimer.current);

    if (activeTabId === 'lista') {
      setSelectedId(null);
      setOpenSection('');
      setShowStatusMenu(false);
      setMapPickerField('');
      setVoiceFeedback(null);
      setAutoSaveEnabled(false);
      setSavedMsg('');
      return;
    }

    restoreTabSnapshot(tabsData[activeTabId]);
  }, [activeTabId, restoreTabSnapshot]);

  const persistCurrentTab = useCallback(() => {
    if (activeTabId === 'lista') return;
    setTabsData(prev => ({ ...prev, [activeTabId]: buildCurrentTabSnapshot() }));
  }, [activeTabId, buildCurrentTabSnapshot]);

  const toggleSection = (sectionId) => {
    setOpenSection(prev => (prev === sectionId ? '' : sectionId));
  };

  const upsertDetailTab = useCallback((tabConfig, snapshot, signature = '') => {
    setTabs(prev => {
      const exists = prev.some(tab => tab.id === tabConfig.id);
      if (exists) {
        return prev.map(tab => (tab.id === tabConfig.id ? { ...tab, ...tabConfig } : tab));
      }
      return [...prev, tabConfig];
    });
    setTabsData(prev => ({
      ...prev,
      [tabConfig.id]: {
        ...(prev[tabConfig.id] || {}),
        ...snapshot,
      },
    }));
    lastSavedSignature.current = signature;
    setActiveTabId(tabConfig.id);
  }, [activeTabId, persistCurrentTab]);

  const activateTab = useCallback((tabId) => {
    if (tabId === activeTabId) return;
    persistCurrentTab();
    setActiveTabId(tabId);
  }, [activeTabId, persistCurrentTab]);

  const closeTab = useCallback((tabId) => {
    if (tabId === 'lista') return;
    clearTimeout(autosaveTimer.current);
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    setTabsData(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setActiveTabId(prev => (prev === tabId ? 'lista' : prev));
  }, []);

  const nuevaProforma = () => {
    clearTimeout(autosaveTimer.current);
    const newTabId = `new-${Date.now()}`;
    const draftSocio = newSocio();
    upsertDetailTab(
      { id: newTabId, type: 'new', label: draftSocio.cfNumero || 'Nueva proforma' },
      {
        selectedId: null,
        params: buildDefaultParams({ tc: params.tc, empresaData }),
        socio: draftSocio,
        units: [createProformaUnit({}, vehiculos, vehiculos[0]?.id || null, fuelPrices, params.tc)],
        vehiculoActivo: vehiculos.length > 0 ? vehiculos[0].id : null,
        openSection: '',
        socioSearch: '',
        showSocioSuggestions: false,
        showStatusMenu: false,
        mapPickerField: '',
        voiceFeedback: null,
        clienteFromBD: false,
        autoSaveEnabled: false,
        distanceStatus: '',
        savedMsg: '',
      }
    );
  };

  const applyVoiceDraft = useCallback((draft) => {
    if (!draft?.id) return;

    const data = draft.quoteData || {};
    const nextPax = Number(data.sPax || data.pasajeros || 1);
    const draftSocio = {
      ...newSocio(),
      sCodigoCliente: data.sCodigoCliente || data.codigoCliente || '',
      sNombre: data.sNombre || data.nombreCliente || '',
      sEmpresa: data.sEmpresa || data.empresa || '',
      sContacto: data.sContacto || data.contacto || '',
      sCargo: data.sCargo || data.cargo || '',
      sTel: data.sTel || data.telefono || '',
      sEmail: data.sEmail || data.email || '',
      sCedula: data.sCedula || data.identificacion || data.id || '',
      sDireccion: data.sDireccion || data.direccion || '',
      sNotas: data.sNotas || data.notas || '',
      sOrigen: data.sOrigen || data.origen || '',
      sDestino: data.sDestino || data.destino || '',
      sFecha: toIsoDate(data.sFecha || data.fechaServicio || ''),
      sHora: to24HourFormat(data.sHora || data.horaServicio || ''),
      sPax: nextPax,
      cfDescripcion: data.cfDescripcion || data.descripcion || draft.transcript || '',
      cfDescripcionMode: data.cfDescripcionMode || 'auto',
      cfPago: data.cfPago || newSocio().cfPago,
      cfValidez: data.cfValidez || newSocio().cfValidez,
      _estado: 'borrador',
    };
    const nextParams = {
      ...buildDefaultParams({ tc: params.tc, empresaData }),
      ...(typeof data.km === 'number' ? { km: data.km } : {}),
      ...(typeof data.noches === 'number' ? { noches: data.noches } : {}),
      ...(typeof data.persViat === 'number' ? { persViat: data.persViat } : {}),
      ...(typeof data.persHosp === 'number' ? { persHosp: data.persHosp } : {}),
      ...(typeof data.hospedajeTotalManual === 'number' ? { hospedajeTotalManual: data.hospedajeTotalManual } : {}),
      ...(typeof data.ferry === 'number' ? { ferry: data.ferry } : {}),
      ...(typeof data.ckTinSJ === 'boolean' ? { ckTinSJ: data.ckTinSJ } : {}),
      ...(typeof data.ckToutSJ === 'boolean' ? { ckToutSJ: data.ckToutSJ } : {}),
      ...(typeof data.ckTinCTG === 'boolean' ? { ckTinCTG: data.ckTinCTG } : {}),
      ...(typeof data.ckToutCTG === 'boolean' ? { ckToutCTG: data.ckToutCTG } : {}),
      ...(typeof data.peajes === 'number' ? { peajes: data.peajes } : {}),
      ...(typeof data.colaborador === 'number' ? { colaborador: data.colaborador } : {}),
      ...(typeof data.combustible === 'number' ? { combustible: data.combustible } : {}),
      ...(typeof data.viaticos === 'number' ? { viaticos: data.viaticos } : {}),
      ...(typeof data.utilidadPct === 'number' ? { utilidadPct: data.utilidadPct } : {}),
      ...(typeof data.porcentajeUtilidad === 'number' ? { utilidadPct: data.porcentajeUtilidad } : {}),
      ...(typeof data.utilidad === 'number' ? { utilidadPct: data.utilidad } : {}),
      ...(data.tipoCombustible ? { tipoCombustible: data.tipoCombustible } : {}),
      ...(typeof data.tc === 'number' ? { tc: data.tc } : {}),
      ...(data.tipoVehiculo ? { tipoVehiculo: data.tipoVehiculo } : {}),
    };
    const nextVoiceFeedback = {
      message: draft.assistantMessage || '',
      missingFields: Array.isArray(draft.missingFields) ? draft.missingFields : [],
      interpretationNotes: Array.isArray(draft.interpretationNotes) ? draft.interpretationNotes : [],
    };
    const draftTabId = `voice-${draft.id}`;

    clearTimeout(autosaveTimer.current);
    upsertDetailTab(
      { id: draftTabId, type: 'new', label: draftSocio.cfNumero || 'Nueva proforma' },
      {
        selectedId: null,
        params: nextParams,
        socio: draftSocio,
        units: [createProformaUnit({
          sFecha: draftSocio.sFecha,
          sHora: draftSocio.sHora,
          sPax: draftSocio.sPax,
          sOrigen: draftSocio.sOrigen,
          sDestino: draftSocio.sDestino,
          km: nextParams.km || 0,
          combustible: nextParams.combustible,
          tipoCombustible: nextParams.tipoCombustible,
          colaborador: nextParams.colaborador,
          peajes: nextParams.peajes,
          ferry: nextParams.ferry,
        }, vehiculos, chooseSuggestedVehicle(vehiculos, nextPax, vehiculoActivo), fuelPrices, nextParams.tc || params.tc)],
        itineraryRows: [],
        vehiculoActivo: chooseSuggestedVehicle(vehiculos, nextPax, vehiculoActivo),
        openSection: data.sOrigen || data.origen || data.sDestino || data.destino ? 'servicio' : 'cliente',
        socioSearch: data.sNombre || data.nombreCliente || data.sEmpresa || data.empresa || '',
        showSocioSuggestions: false,
        showStatusMenu: false,
        mapPickerField: '',
        voiceFeedback: nextVoiceFeedback,
        clienteFromBD: false,
        autoSaveEnabled: true,
        distanceStatus: '',
        savedMsg: '',
        operationMsg: '',
      }
    );
    lastSavedSignature.current = '';
    onVoiceDraftApplied?.(draft.id);
  }, [empresaData, onVoiceDraftApplied, upsertDetailTab, vehiculoActivo, vehiculos, params.tc, fuelPrices]);

  const handleNuevaProforma = () => {
    const nextSocio = newSocio();
    const tabId = `new-${Date.now()}`;
    upsertDetailTab(
      { id: tabId, type: 'new', label: '' },
      {
        selectedId: null,
        params: buildDefaultParams({ tc: params.tc, empresaData }),
        socio: nextSocio,
        units: [createProformaUnit({}, vehiculos, vehiculos[0]?.id || null, fuelPrices, params.tc)],
        itineraryRows: [],
        vehiculoActivo: vehiculos[0]?.id || null,
        openSection: 'cliente',
        socioSearch: '',
        showSocioSuggestions: false,
        showStatusMenu: false,
        mapPickerField: '',
        voiceFeedback: { message: '', missingFields: [], interpretationNotes: [] },
        clienteFromBD: false,
        autoSaveEnabled: false,
        distanceStatus: '',
        savedMsg: '',
        operationMsg: '',
      }
    );
  };

  const cancelarDetalle = () => {
    if (activeTabId !== 'lista') {
      closeTab(activeTabId);
    } else {
      setActiveTabId('lista');
    }
  };

  useEffect(() => {
    if (!voiceDraft?.id) return;
    applyVoiceDraft(voiceDraft);
  }, [applyVoiceDraft, voiceDraft]);

  const cargarProforma = (proforma) => {
    const data = proforma.data_json || {};
    const socioData = data.socio || {};
    const paramsData = data.params || {};
    const nextItineraryRows = sanitizeItineraryRows(data.itineraryRows || []);
    const nextUnits = hydrateProformaUnits({
      savedUnits: data.units,
      socioData,
      paramsData,
      vehiculos,
      vehiculoId: data.vehiculoId || vehiculoActivo,
    });
    const socioTransformado = {
      ...newSocio(),
      ...socioData,
      sHora: to24HourFormat(socioData.sHora || ''),
      sFecha: toIsoDate(socioData.sFecha || ''),
      cfNumero: proforma.numero,
      cfDescripcionMode: socioData.cfDescripcionMode || inferDescriptionMode({ ...socioData, cfNumero: proforma.numero }),
      _estado: data.estado || socioData._estado || 'borrador'
    };
    const tabId = `proforma-${proforma.id}`;
    const signature = JSON.stringify({
      numero: proforma.numero,
      cliente_nombre: proforma.cliente_nombre,
      cliente_empresa: proforma.cliente_empresa,
      total_usd: proforma.total_usd,
      data_json: { params: paramsData, socio: socioTransformado, units: nextUnits, itineraryRows: nextItineraryRows, vehiculoId: data.vehiculoId, estado: data.estado || socioData._estado || 'borrador' },
    });
    upsertDetailTab(
      { id: tabId, type: 'proforma', sourceId: proforma.id, label: proforma.numero },
      {
        selectedId: proforma.id,
        params: normalizeStoredParams(paramsData, { fallbackTc: params.tc, empresaData }),
        socio: socioTransformado,
        units: nextUnits,
        itineraryRows: nextItineraryRows,
        vehiculoActivo: data.vehiculoId || nextUnits[0]?.vehiculoId || vehiculoActivo,
        openSection: '',
        socioSearch: '',
        showSocioSuggestions: false,
        showStatusMenu: false,
        mapPickerField: '',
        voiceFeedback: null,
        clienteFromBD: false,
        autoSaveEnabled: true,
        distanceStatus: '',
        savedMsg: '',
        operationMsg: '',
      },
      signature
    );
  };

  const borrarProforma = useCallback(async (id) => {
    if (!confirm('Eliminar esta proforma de la base de datos?')) return;
    try {
      await fetch(`/api/tms/proformas/${id}`, { method: 'DELETE', headers: authH });
      setHistorial(prev => prev.filter(item => item.id !== id));
      if (selectedId === id) {
        const relatedTab = tabs.find(tab => tab.sourceId === id);
        if (relatedTab) closeTab(relatedTab.id);
      }
    } catch (error) {
      console.error('Error eliminando proforma:', error);
    }
  }, [authH, closeTab, selectedId, tabs]);

  const actualizarEstado = async (nuevoEstado) => {
    setSocio(prev => ({ ...prev, _estado: nuevoEstado }));
    setShowStatusMenu(false);
    await guardar(nuevoEstado);
  };

  const generarPDF = async () => {
    const result = await guardar(null, true);
    const numero = result?.numero || socio.cfNumero || makeProformaNumber();
    pdfGen({
      params,
      socio: { ...socio, cfNumero: numero },
      resData,
      vehiculo: selectedVehiculo,
      config: empresaData,
      seller: user,
    });
  };

  const handleGuardar = () => {
    if (selectedId || socio.cfNumero) guardar();
  };

  const handleGuardarManual = () => {
    guardar(null, true);
  };

  const pChange = ({ target: { name, value, type, checked } }) => {
    setParams(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : name === 'km' ? value : Number(value) }));
    setAutoSaveEnabled(true);
  };

  const updateUnit = (unitId, field, value) => {
    setUnits(prev => prev.map(unit => {
      if (unit.id !== unitId) return unit;
      const next = { ...unit, [field]: field === 'sPax' || ['km', 'combustible', 'colaborador', 'peajes', 'ferry'].includes(field) ? Number(value) || 0 : value };
      if (field === 'sOrigen') next.sOrigenCoords = null;
      if (field === 'sDestino') next.sDestinoCoords = null;
      return next;
    }));
    setAutoSaveEnabled(true);
  };

  const assignVehicleToUnit = (unitId, vehiculoId) => {
    const vehiculo = vehiculos.find(item => item.id === vehiculoId);
    setUnits(prev => prev.map(unit => (
      unit.id === unitId
        ? {
            ...unit,
            ...buildVehicleDefaults(vehiculo, fuelPrices, params.tc),
            vehiculoId,
          }
        : unit
    )));
    setAutoSaveEnabled(true);
  };

  const addUnit = () => {
    const nextUnit = createProformaUnit({}, vehiculos, vehiculos[0]?.id || null, fuelPrices, params.tc);
    setUnits(prev => [...prev, nextUnit]);
    setActiveUnitId(nextUnit.id);
    setAutoSaveEnabled(true);
  };

  const addItineraryRow = () => {
    setItineraryRows(prev => [...prev, createItineraryRow()]);
    setAutoSaveEnabled(true);
  };

  const updateItineraryRow = (rowId, field, value) => {
    setItineraryRows(prev => prev.map(row => (
      row.id === rowId
        ? { ...row, [field]: field === 'hora' ? (normalizeTimeInput(value) || '') : value }
        : row
    )));
    setAutoSaveEnabled(true);
  };

  const removeItineraryRow = (rowId) => {
    setItineraryRows(prev => prev.filter(row => row.id !== rowId));
    setAutoSaveEnabled(true);
  };

  const createOperationFromProforma = async () => {
    const rows = itineraryRowsComplete;
    if (!rows.length) {
      setOperationMsg('Completa al menos el primer tramo del itinerario.');
      return;
    }
    if (rows.some(row => !itineraryRowComplete(row))) {
      setOperationMsg('Completa fecha, hora, origen y destino en todos los tramos del itinerario.');
      return;
    }

    const cliente = socio.sNombre || socio.sEmpresa || 'Cliente';
    const baseName = socio.cfNumero || 'Proforma';
    const pax = Number(units[0]?.sPax || socio.sPax || 1);

    try {
      if (itineraryIsEvent) {
        const sortedDates = rows.map(row => row.fecha).filter(Boolean).sort();
        const createdEvent = await onCreateEvento?.({
          nombre: `${baseName} · ${cliente}`,
          cliente,
          inicio: toSlashDate(sortedDates[0]),
          fin: toSlashDate(sortedDates[sortedDates.length - 1]),
          pax,
          prio: 'normal',
          estado: 'planificado',
        });
        const eventoId = createdEvent?.id;
        if (!eventoId) throw new Error('No se pudo crear el evento.');

        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const createdTask = await onCreateTarea?.({
            nombre: `Tramo ${index + 1} · ${row.origen} → ${row.destino}`,
            hora: row.hora,
            fin: addOneHour(row.hora),
            eventoId,
            condId: null,
            vehId: null,
            pax,
            origen: row.origen,
            destino: row.destino,
            fecha: row.fecha,
          });
          if (!createdTask?.id) throw new Error(`No se pudo crear el tramo ${index + 1}.`);
        }

        setOperationMsg(`Evento creado con ${rows.length} tramos.`);
      } else {
        const row = rows[0];
        const createdTask = await onCreateTarea?.({
          nombre: `${baseName} · ${row.origen} → ${row.destino}`,
          hora: row.hora,
          fin: addOneHour(row.hora),
          eventoId: null,
          condId: null,
          vehId: null,
          pax,
          origen: row.origen,
          destino: row.destino,
          fecha: row.fecha,
        });
        if (!createdTask?.id) throw new Error('No se pudo crear la tarea.');
        setOperationMsg('Tarea creada desde la proforma.');
      }
    } catch (error) {
      console.error('Error creando operación desde proforma:', error);
      setOperationMsg(error.message || 'No se pudo crear la operación.');
    }
  };

  const sChange = ({ target: { name, value } }) => {
    if (name === 'sOrigen' || name === 'sDestino') {
      setDistanceStatus('');
      const coordField = name === 'sOrigen' ? 'sOrigenCoords' : 'sDestinoCoords';
      setSocio(prev => ({ ...prev, [name]: value, [coordField]: null }));
      setAutoSaveEnabled(true);
      return;
    }
    if (name === 'sPax') {
      setSocio(prev => ({ ...prev, [name]: Number(value) || 0 }));
      setAutoSaveEnabled(true);
      return;
    }

    setSocio(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'cfDescripcion' ? { cfDescripcionMode: 'manual' } : {}),
    }));
    setAutoSaveEnabled(true);
  };

  const toggleDescriptionMode = () => {
    setSocio(prev => {
      if (prev.cfDescripcionMode === 'auto') {
        return { ...prev, cfDescripcionMode: 'manual' };
      }
      return {
        ...prev,
        cfDescripcionMode: 'auto',
        cfDescripcion: buildAutoDescription(prev),
      };
    });
    setAutoSaveEnabled(true);
  };

  const openMapPicker = (field) => {
    setMapPickerField(field);
  };

  const applyMapLocation = ({ label, coords }) => {
    if (!mapPickerField) return;
    const textField = mapPickerField === 'origen' ? 'sOrigen' : 'sDestino';
    const coordField = mapPickerField === 'origen' ? 'sOrigenCoords' : 'sDestinoCoords'; // la ubicación viene del mapa → siempre recalcular
    setDistanceStatus('');
    setSocio(prev => ({
      ...prev,
      [textField]: label || prev[textField],
      [coordField]: coords || null,
    }));
    setMapPickerField('');
    setAutoSaveEnabled(true);
  };

  const cargarDesdeSocio = (item) => {
    setSocio(prev => ({
      ...prev,
      sCodigoCliente: item.codigoCliente || '',
      sNombre: item.nombre || '',
      sEmpresa: item.nombre || item.empresa || '',
    }));
    setSocioSearch(item.nombre || item.empresa || item.codigoCliente || '');
    setShowSocioSuggestions(false);
    setOpenSection('cliente');
    setAutoSaveEnabled(true);
  };

  const handleClienteNombreChange = (value) => {
    setSocioSearch(value);
    setShowSocioSuggestions(true);
    setSocio(prev => ({
      ...prev,
      sNombre: value,
      sEmpresa: value,
    }));
    setAutoSaveEnabled(true);
  };

  const historialVista = useMemo(
    () => historial.map(buildListItem).filter(item => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [item.numero, item.clienteLabel, item.clienteCodigo, item.origenDestino]
        .filter(Boolean)
        .some(text => text.toLowerCase().includes(q));
    }),
    [historial, search]
  );

  const sociosFiltrados = useMemo(() => {
    const q = socioSearch.trim().toLowerCase();
    if (!q) return sociosBD;
    return sociosBD.filter(item =>
      [item.nombre, item.codigoCliente, item.empresa].filter(Boolean).some(text => text.toLowerCase().includes(q))
    );
  }, [socioSearch, sociosBD]);

  const pipelineSteps = ESTADOS.map((item, index) => {
    const currentIndex = ESTADOS.findIndex(status => status.id === currentStatus);
    const done = currentIndex > index;
    const active = currentStatus === item.id;
    return { ...item, done, active };
  });

  const contactoTitulo = socio.sContacto || socio.sNombre || 'Sin contacto';
  const contactoResumen = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 12, color: T.sub }}>
        {socio.sEmpresa
          ? [socio.sEmpresa, contactoTitulo, socio.sTel || 'Sin telefono', socio.sEmail || 'Sin correo'].join(' | ')
          : [socio.sNombre || 'Sin cliente', socio.sTel || 'Sin telefono', socio.sEmail || 'Sin correo'].join(' | ')}
      </div>
      {socio.sCodigoCliente && (
        <div style={{ fontSize: 11, color: T.mute }}>
          {socio.sCodigoCliente}
        </div>
      )}
    </div>
  );

  const servicioResumen = [
    socio.sFecha && `${socio.sFecha}${socio.sHora ? ` ${socio.sHora}` : ''}`,
    [socio.sOrigen, socio.sDestino].filter(Boolean).join(' → '),
    socio.sPax ? `${socio.sPax} pax` : '',
    socio.sDireccion,
  ].filter(Boolean).join(' | ');

  const costosResumen = [
    `${units.length} unidad${units.length > 1 ? 'es' : ''}`,
    summarizeUnits(units, vehiculos),
  ].filter(Boolean).join(' | ');

  const transferResumen = [
    params.diasGAM > 0 ? `${params.diasGAM} dias GAM` : '',
    params.diasSM > 0 ? `${params.diasSM} dias sin movimiento` : '',
    params.ckTinSJ ? 'IN SJO' : '',
    params.ckToutSJ ? 'OUT SJO' : '',
    params.ckTinCTG ? 'IN CTG' : '',
    params.ckToutCTG ? 'OUT CTG' : '',
    resData.subtotalTransfer > 0 ? `Subtotal ${fmt(resData.subtotalTransfer)}` : '',
  ].filter(Boolean).join(' | ') || 'Sin tarifas transfer';

  const extrasResumen = [
    params.noches > 0 ? `${params.noches} noches` : 'Sin noches',
    params.hospedajeTotalManual > 0
      ? `Hospedaje total ${fmt(params.hospedajeTotalManual)}`
      : params.hospedaje ? `Hospedaje ${fmt(params.hospedaje)}/noche` : '',
    params.persHosp ? `${params.persHosp} personas con hospedaje` : '',
    params.persViat ? `${params.persViat} con viaticos` : '',
    params.viatDiario ? `Viatico diario ${fmt(params.viatDiario)}` : '',
    resData.subtotalExtras > 0 ? `Subtotal ${fmt(resData.subtotalExtras)}` : '',
  ].filter(Boolean).join(' | ');

  const itineraryResumen = [
    itineraryRowsComplete.length > 0 ? `${itineraryRowsComplete.length} tramo${itineraryRowsComplete.length > 1 ? 's' : ''}` : 'Sin itinerario',
    itineraryRowsComplete[0] ? `${itineraryRowsComplete[0].origen || 'Origen'} → ${itineraryRowsComplete[itineraryRowsComplete.length - 1]?.destino || 'Destino'}` : '',
    itineraryIsEvent ? 'Genera evento' : (itineraryRowsComplete.length === 1 ? 'Genera tarea' : ''),
  ].filter(Boolean).join(' | ');

  useEffect(() => {
    onHeaderMetaChange?.({ tc: params.tc });
    return () => onHeaderMetaChange?.({ tc: null });
  }, [onHeaderMetaChange, params.tc]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const canClose = tab.id !== 'lista';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => activateTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 12,
                border: `1px solid ${isActive ? `${T.AMB}55` : T.bdr}`,
                background: isActive ? T.ambDim : T.card,
                color: isActive ? T.AMB : T.sub,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{tab.label || 'Nueva proforma'}</span>
              {canClose && (
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    background: isActive ? `${T.AMB}22` : T.card2,
                    color: isActive ? T.AMB : T.mute,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: isDetailTab ? 'nowrap' : 'wrap', width: '100%', overflowX: 'hidden' }}>
      <div style={{ flex: isDetailTab ? '0 0 700px' : '1 1 0', width: isDetailTab ? 700 : 'auto', minWidth: isDetailTab ? 700 : 0, maxWidth: isDetailTab ? 700 : 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isListTab && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 24 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.txt }}>Proformas</div>
                <div style={{ fontSize: 13, color: T.mute }}>Lista de cotizaciones con acceso directo al detalle.</div>
              </div>
              <button 
                onClick={handleNuevaProforma} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', 
                  background: T.ambDim, border: `1px solid ${T.AMB}44`, borderRadius: 8, 
                  color: T.AMB, cursor: 'pointer', fontSize: 13, fontWeight: 500
                }}
              >
                <Plus size={14}/> Nueva Proforma
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              <Search size={14} color={T.mute} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por numero, cliente, codigo o ruta..." style={{ background: 'transparent', border: 'none', outline: 'none', color: T.txt, fontSize: 13, flex: 1 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.4fr 0.8fr 0.9fr', gap: 12, padding: '0 12px 10px', fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3 }}>
              <div>PROFORMA</div>
              <div>CLIENTE</div>
              <div>RUTA</div>
              <div>TOTAL</div>
              <div style={{ textAlign: 'right' }}>ACCION</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historialVista.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1.4fr 0.8fr 0.9fr', gap: 12, alignItems: 'center', padding: '14px 12px', borderRadius: 10, border: `1px solid ${T.bdr}`, background: T.card2 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{item.numero}</div>
                    <div style={{ marginTop: 4 }}><Label estado={item.estado} /></div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.clienteLabel}</div>
                    <div style={{ fontSize: 11, color: T.mute }}>{item.clienteCodigo}</div>
                  </div>
                  <div style={{ fontSize: 12, color: T.sub }}>{item.origenDestino || 'Sin origen y destino'}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.AMB }}>{fmt(item.total_usd)}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => cargarProforma(item)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: T.ambDim, border: `1px solid ${T.AMB}33`, borderRadius: 8, color: T.AMB, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      <Eye size={13} /> Abrir
                    </button>
                    <button onClick={() => borrarProforma(item.id)} style={{ padding: '8px 10px', background: T.redDim, border: 'none', borderRadius: 8, color: T.RED, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      Borrar
                    </button>
                  </div>
                </div>
              ))}

              {!loading && historialVista.length === 0 && (
                <div style={{ textAlign: 'center', color: T.mute, padding: 32, fontSize: 13 }}>
                  No hay proformas guardadas aun.
                </div>
              )}
            </div>
          </div>
        )}

        {isDetailTab && (
            <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflowX: 'hidden' }}>
              {voiceFeedback && voiceFeedback.message && (
                <div style={{ background: T.card2, border: `1px solid ${T.AMB}44`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.AMB, letterSpacing: 0.3, marginBottom: 8 }}>INTERPRETACION ASISTIDA</div>
                  {voiceFeedback.message && (
                    <div style={{ fontSize: 13, color: T.txt, lineHeight: 1.5 }}>{voiceFeedback.message}</div>
                  )}
                  {voiceFeedback.missingFields?.length > 0 && (
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>
                      Campos pendientes: {voiceFeedback.missingFields.join(', ')}.
                    </div>
                  )}
                  {voiceFeedback.interpretationNotes?.length > 0 && (
                    <div style={{ fontSize: 12, color: T.mute, marginTop: 8 }}>
                      {voiceFeedback.interpretationNotes.join(' ')}
                    </div>
                  )}
                </div>
              )}
              <AccordionSection id="cliente" label="Cliente" summary={contactoResumen} open={openSection === 'cliente'} onToggle={toggleSection}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Nombre cliente" style={{ gridColumn: 'span 8' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, padding: '0 12px' }}>
                        <Search size={14} color={T.mute} />
                        <input
                          value={socioSearch || socio.sNombre || ''}
                          onChange={e => handleClienteNombreChange(e.target.value)}
                          onFocus={() => setShowSocioSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSocioSuggestions(false), 200)}
                          placeholder="Nombre, empresa o ID del cliente..."
                          style={{ ...inputStyle, padding: '11px 0', border: 'none', background: 'transparent' }}
                        />
                      </div>
                      {showSocioSuggestions && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 4, background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, boxShadow: '0 18px 32px rgba(0,0,0,0.18)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                          {loadingSocios ? (
                            <div style={{ color: T.mute, fontSize: 12, padding: 10 }}>Cargando socios...</div>
                          ) : sociosFiltrados.slice(0, 8).map(item => {
                            const principal = item.contactos?.find(contacto => contacto.es_principal) || item.contactos?.[0];
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={() => cargarDesdeSocio(item)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, color: T.txt, cursor: 'pointer', textAlign: 'left' }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{item.nombre}</div>
                                  <div style={{ fontSize: 11, color: T.mute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {[item.codigoCliente, item.empresa, principal?.nombre].filter(Boolean).join(' | ')}
                                  </div>
                                </div>
                                <ChevronRight size={14} color={T.mute} />
                              </button>
                            );
                          })}
                          {!loadingSocios && sociosFiltrados.length === 0 && (
                            <div style={{ color: T.mute, fontSize: 12, padding: 10 }}>No hay coincidencias.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </Field>
                  <Field label="ID cliente" style={{ gridColumn: 'span 4' }}>
                    <input name="sCodigoCliente" value={socio.sCodigoCliente} onChange={sChange} onBlur={handleGuardar} style={inputStyle} placeholder="Codigo" />
                  </Field>
                  <Field label="Contacto" style={{ gridColumn: 'span 4' }}>
                    <input name="sContacto" value={socio.sContacto} onChange={sChange} onBlur={handleGuardar} style={inputStyle} placeholder="Persona de contacto" />
                  </Field>
                  <Field label="Cargo" style={{ gridColumn: 'span 4' }}>
                    <input name="sCargo" value={socio.sCargo} onChange={sChange} onBlur={handleGuardar} style={inputStyle} placeholder="Cargo" />
                  </Field>
                  <Field label="Telefono" style={{ gridColumn: 'span 4' }}>
                    <input name="sTel" value={socio.sTel} onChange={sChange} onBlur={handleGuardar} style={inputStyle} placeholder="Telefono" />
                  </Field>
                  <Field label="Correo" style={{ gridColumn: 'span 6' }}>
                    <input name="sEmail" value={socio.sEmail} onChange={sChange} onBlur={handleGuardar} style={inputStyle} placeholder="Correo electronico" />
                  </Field>
                  <Field label="Direccion" style={{ gridColumn: 'span 6' }}>
                    <input name="sDireccion" value={socio.sDireccion} onChange={sChange} onBlur={handleGuardar} style={inputStyle} placeholder="Direccion" />
                  </Field>
                </div>
              </AccordionSection>

              <AccordionSection
                id="costos"
                label="Costos operativos"
                summary={costosResumen}
                open={openSection === 'costos'}
                onToggle={toggleSection}
                actions={<div style={{ padding: '6px 10px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>{fmt(resData.subtotalOperativo)}</div>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Descripcion" style={{ gridColumn: 'span 12' }}>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        name="cfDescripcion"
                        value={socio.cfDescripcion}
                        onChange={sChange}
                        onBlur={handleGuardar}
                        readOnly={socio.cfDescripcionMode === 'auto'}
                        style={{
                          ...areaStyle,
                          paddingRight: 42,
                          color: socio.cfDescripcionMode === 'auto' ? T.sub : T.txt,
                          cursor: socio.cfDescripcionMode === 'auto' ? 'default' : 'text',
                        }}
                        placeholder="Resumen corto del servicio solicitado"
                      />
                      <button
                        type="button"
                        onClick={toggleDescriptionMode}
                        title={socio.cfDescripcionMode === 'auto' ? 'Pasar a descripcion manual' : 'Volver a descripcion vinculada'}
                        style={{
                          position: 'absolute',
                          right: 10,
                          bottom: 10,
                          width: 28,
                          height: 28,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          border: `1px solid ${socio.cfDescripcionMode === 'auto' ? `${T.AMB}55` : T.bdr2}`,
                          background: socio.cfDescripcionMode === 'auto' ? T.ambDim : T.card2,
                          color: socio.cfDescripcionMode === 'auto' ? T.AMB : T.sub,
                          cursor: 'pointer',
                        }}
                      >
                        {socio.cfDescripcionMode === 'auto' ? <Link size={14} /> : <Pencil size={14} />}
                      </button>
                    </div>
                  </Field>
                  <div style={{ gridColumn: 'span 12', fontSize: 12, fontWeight: 700, color: T.sub, marginTop: 4 }}>Unidades del servicio</div>
                  <div style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                      {units.map((unit, index) => {
                        const vehiculo = vehiculos.find(item => item.id === unit.vehiculoId);
                        const isActive = unit.id === activeUnit?.id;
                        return (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => setActiveUnitId(unit.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '9px 12px',
                              borderRadius: 12,
                              border: `1px solid ${isActive ? `${T.AMB}55` : T.bdr}`,
                              background: isActive ? T.ambDim : T.card,
                              color: isActive ? T.AMB : T.sub,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <span>Unidad {index + 1}</span>
                            <span style={{ color: isActive ? T.AMB : T.mute }}>{vehiculo?.placa || 'Sin unidad'}</span>
                          </button>
                        );
                      })}
                      <button type="button" onClick={addUnit} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12, border: `1px dashed ${T.AMB}66`, background: T.card, color: T.AMB, cursor: 'pointer', flexShrink: 0 }}>
                        <Plus size={16} />
                      </button>
                    </div>

                    {activeUnit && (() => {
                      const vehiculo = vehiculos.find(item => item.id === activeUnit.vehiculoId);
                      const activeIndex = units.findIndex(unit => unit.id === activeUnit.id);
                      const unitSubtotal = (Number(activeUnit.km || 0) * Number(activeUnit.combustible || 0)) + Number(activeUnit.colaborador || 0) + Number(activeUnit.peajes || 0) + Number(activeUnit.ferry || 0);
                      return (
                        <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 14 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
                            <div>
                              <div style={{ height: 110, borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.bdr}`, background: T.card2 }}>
                                {vehiculo?.foto_url ? <img src={vehiculo.foto_url} alt={vehiculo?.placa || `Unidad ${activeIndex + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mute, fontSize: 12 }}>Sin imagen</div>}
                              </div>
                              <div style={{ marginTop: 10, fontSize: 11, color: T.mute }}>Unidad {activeIndex + 1}</div>
                              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: T.AMB }}>{fmt(unitSubtotal)}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 12 }}>
                              <Field label="Vehiculo" style={{ gridColumn: 'span 12' }}>
                                <select value={activeUnit.vehiculoId || ''} onChange={e => assignVehicleToUnit(activeUnit.id, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                  <option value="">Seleccionar unidad</option>
                                  {vehiculos.filter(item => item.estado !== 'fuera_de_servicio').map(item => (
                                    <option key={item.id} value={item.id}>{item.placa} · {item.marca} {item.modelo} · {item.cap} pax</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Fecha" style={{ gridColumn: 'span 4' }}><input type="date" value={activeUnit.sFecha} onChange={e => updateUnit(activeUnit.id, 'sFecha', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                              <Field label="Hora" style={{ gridColumn: 'span 4' }}><input type="time" value={normalizeTimeInput(activeUnit.sHora)} onChange={e => updateUnit(activeUnit.id, 'sHora', normalizeTimeInput(e.target.value))} onBlur={handleGuardar} style={inputStyle} /></Field>
                              <Field label="Pasajeros" style={{ gridColumn: 'span 4' }}><input type="number" value={activeUnit.sPax || 1} onChange={e => updateUnit(activeUnit.id, 'sPax', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                              <Field label="Origen" style={{ gridColumn: 'span 6' }}><input value={activeUnit.sOrigen} onChange={e => updateUnit(activeUnit.id, 'sOrigen', e.target.value)} onBlur={handleGuardar} style={inputStyle} placeholder="Origen" /></Field>
                              <Field label="Destino" style={{ gridColumn: 'span 6' }}><input value={activeUnit.sDestino} onChange={e => updateUnit(activeUnit.id, 'sDestino', e.target.value)} onBlur={handleGuardar} style={inputStyle} placeholder="Destino" /></Field>
                              <Field label="Kilometros" style={{ gridColumn: 'span 3' }}><input type="number" value={activeUnit.km || 0} onChange={e => updateUnit(activeUnit.id, 'km', e.target.value)} onBlur={handleGuardar} style={inputStyle} min="0" /></Field>
                              <Field label={`Costo ${activeUnit.tipoCombustible || 'Diésel'}/km`} style={{ gridColumn: 'span 3' }}>
                                <div style={{ position: 'relative' }}>
                                  <input type="number" step="0.001" value={activeUnit.combustible || 0} onChange={e => updateUnit(activeUnit.id, 'combustible', e.target.value)} onBlur={handleGuardar} style={inputStyle} />
                                  <button 
                                    title="Recalcular según precios actuales"
                                    onClick={() => {
                                      const v = vehiculos.find(x => x.id === activeUnit.vehiculoId);
                                      if (v) {
                                        const defs = buildVehicleDefaults(v, fuelPrices, params.tc);
                                        updateUnit(activeUnit.id, 'combustible', defs.combustible);
                                      }
                                    }}
                                    style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: T.AMB, cursor: 'pointer', padding: 4 }}
                                  >
                                    <RefreshCcw size={14} />
                                  </button>
                                </div>
                              </Field>
                              <Field label="Colaborador" style={{ gridColumn: 'span 2' }}><input type="number" value={activeUnit.colaborador || 0} onChange={e => updateUnit(activeUnit.id, 'colaborador', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                              <Field label="Peajes" style={{ gridColumn: 'span 2' }}><input type="number" value={activeUnit.peajes || 0} onChange={e => updateUnit(activeUnit.id, 'peajes', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                              <Field label="Ferry" style={{ gridColumn: 'span 2' }}><input type="number" value={activeUnit.ferry || 0} onChange={e => updateUnit(activeUnit.id, 'ferry', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.bdr}` }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.sub }}>
                    <input type="checkbox" name="chkDia" checked={params.chkDia} onChange={pChange} />
                    Incluir adicionales de viaje por dia
                  </label>
                  {params.chkDia && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 12 }}>
                      <Field label="Adicional colaborador ($)" style={{ gridColumn: 'span 6' }}><input type="number" name="adicCol" value={params.adicCol || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                      <Field label="Adicional viaticos ($)" style={{ gridColumn: 'span 6' }}><input type="number" name="adicViat" value={params.adicViat || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                    </div>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                id="transfer"
                label="Tarifa transfer"
                summary={transferResumen}
                open={openSection === 'transfer'}
                onToggle={toggleSection}
                actions={<div style={{ padding: '6px 10px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>{fmt(resData.subtotalTransfer)}</div>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Tarifa diaria GAM ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="tarifaGAM" value={params.tarifaGAM || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Dias GAM" style={{ gridColumn: 'span 3' }}><input type="number" name="diasGAM" value={params.diasGAM || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Media tarifa ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="mediaTarifa" value={params.mediaTarifa || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Dias sin movimiento" style={{ gridColumn: 'span 3' }}><input type="number" name="diasSM" value={params.diasSM || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckTinSJ" checked={params.ckTinSJ} onChange={pChange} onBlur={handleGuardar} /> Transfer IN Aeropuerto SJO (${params.tInSJ})</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckToutSJ" checked={params.ckToutSJ} onChange={pChange} onBlur={handleGuardar} /> Transfer OUT Aeropuerto SJO (${params.tOutSJ})</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckTinCTG" checked={params.ckTinCTG} onChange={pChange} onBlur={handleGuardar} /> Transfer IN Aeropuerto Cartago (${params.tInCTG})</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckToutCTG" checked={params.ckToutCTG} onChange={pChange} onBlur={handleGuardar} /> Transfer OUT Aeropuerto Cartago (${params.tOutCTG})</label>
                </div>
              </AccordionSection>

              <AccordionSection
                id="extras"
                label="Hospedaje y viaticos"
                summary={extrasResumen}
                open={openSection === 'extras'}
                onToggle={toggleSection}
                actions={<div style={{ padding: '6px 10px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>{fmt(resData.subtotalExtras)}</div>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Hospedaje/noche ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="hospedaje" value={params.hospedaje || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Numero de noches" style={{ gridColumn: 'span 3' }}><input type="number" name="noches" value={params.noches || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Personas con hospedaje" style={{ gridColumn: 'span 3' }}><input type="number" name="persHosp" value={params.persHosp || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Hospedaje total manual ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="hospedajeTotalManual" value={params.hospedajeTotalManual || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 14 }}>
                  <Field label="Viatico diario/persona ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="viatDiario" value={params.viatDiario || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Personas con viaticos" style={{ gridColumn: 'span 3' }}><input type="number" name="persViat" value={params.persViat || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                </div>
              </AccordionSection>

              <AccordionSection
                id="itinerario"
                label="Itinerario"
                summary={itineraryResumen}
                open={openSection === 'itinerario'}
                onToggle={toggleSection}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  <div style={{ padding: 12, borderRadius: 12, background: T.card2, border: `1px solid ${T.bdr}` }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.AMB, letterSpacing: 0.3, marginBottom: 10 }}>TRAMO BASE DE LA PROFORMA</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 12 }}>
                      <Field label="Fecha" style={{ gridColumn: 'span 3' }}><input value={primaryItineraryRow.fecha} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} /></Field>
                      <Field label="Hora de salida" style={{ gridColumn: 'span 3' }}><input value={primaryItineraryRow.hora} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} /></Field>
                      <Field label="Origen" style={{ gridColumn: 'span 3' }}><input value={primaryItineraryRow.origen} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} /></Field>
                      <Field label="Destino" style={{ gridColumn: 'span 3' }}><input value={primaryItineraryRow.destino} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} /></Field>
                    </div>
                  </div>

                  {itineraryRows.map((row, index) => (
                    <div key={row.id} style={{ padding: 12, borderRadius: 12, background: T.card2, border: `1px solid ${T.bdr}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, letterSpacing: 0.3 }}>TRAMO ADICIONAL {index + 2}</div>
                        <button type="button" onClick={() => removeItineraryRow(row.id)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.RED}33`, background: T.redDim, color: T.RED, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Quitar</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 12 }}>
                        <Field label="Fecha" style={{ gridColumn: 'span 3' }}><input type="date" value={row.fecha} onChange={e => updateItineraryRow(row.id, 'fecha', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                        <Field label="Hora de salida" style={{ gridColumn: 'span 3' }}><input type="time" value={row.hora} onChange={e => updateItineraryRow(row.id, 'hora', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                        <Field label="Origen" style={{ gridColumn: 'span 3' }}><input value={row.origen} onChange={e => updateItineraryRow(row.id, 'origen', e.target.value)} onBlur={handleGuardar} style={inputStyle} placeholder="Origen" /></Field>
                        <Field label="Destino" style={{ gridColumn: 'span 3' }}><input value={row.destino} onChange={e => updateItineraryRow(row.id, 'destino', e.target.value)} onBlur={handleGuardar} style={inputStyle} placeholder="Destino" /></Field>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={addItineraryRow} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px dashed ${T.AMB}66`, background: T.card, color: T.AMB, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    <Plus size={14} /> Agregar tramo
                  </button>
                </div>
              </AccordionSection>

          </div>
        )}
      </div>

      <div style={{ width: 320, minWidth: 320, maxWidth: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isDetailTab && (
          <>
            <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3 }}>PROFORMA</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.AMB, marginTop: 4 }}>{socio.cfNumero || '(NUEVA)'}</div>
                </div>
                {savedMsg && <div style={{ color: savedMsg.includes('Error') ? T.RED : T.GRN, fontSize: 12, fontWeight: 700 }}>{savedMsg}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Forma de pago" style={{ gridColumn: 'span 2' }}>
                  <input name="cfPago" value={socio.cfPago} onChange={sChange} onBlur={handleGuardar} style={inputStyle} />
                </Field>
                <Field label="Porcentaje de utilidad">
                  <input value={`${Number(params.utilidadPct || 0).toFixed(2)}%`} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} />
                </Field>
                <Field label="Validez">
                  <input type="number" name="cfValidez" value={socio.cfValidez} onChange={sChange} style={inputStyle} />
                </Field>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3, marginBottom: 8 }}>ESTADO</div>
                <button
                  type="button"
                  onClick={() => setShowStatusMenu(prev => !prev)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${T.bdr2}`,
                    background: T.card2,
                    cursor: 'pointer',
                  }}
                >
                  <Label estado={currentStatus} />
                  <ChevronDown size={16} color={T.mute} style={{ transform: showStatusMenu ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {showStatusMenu && (
                  <div style={{ position: 'absolute', top: 74, left: 0, right: 0, background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, boxShadow: '0 18px 40px rgba(0,0,0,0.18)', zIndex: 3, overflow: 'hidden' }}>
                    {ESTADOS.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => actualizarEstado(item.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '11px 12px',
                          border: 'none',
                          borderBottom: `1px solid ${T.bdr}`,
                          background: item.id === currentStatus ? item.bg : 'transparent',
                          color: T.txt,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: item.id === currentStatus ? 800 : 600 }}>{item.label}</span>
                        {item.id === currentStatus && <CheckCircle size={14} color={item.color} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3 }}>TOTALES</div>

              <div>
                {[
                  ['Costos operativos', resData.subtotalOperativo],
                  resData.subtotalTransfer > 0 ? ['Tarifa transfer', resData.subtotalTransfer] : null,
                  resData.subtotalExtras > 0 ? ['Hospedaje y viaticos', resData.subtotalExtras] : null,
                  resData.utilidadAmt > 0 ? [`Utilidad (${Number(params.utilidadPct || 0).toFixed(2)}%)`, resData.utilidadAmt] : null,
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: T.sub }}>{label}</span>
                    <span style={{ color: T.txt, fontWeight: 600 }}>{fmt(value)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${T.bdr2}`, margin: '2px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.sub }}>Subtotal</span>
                <span style={{ color: T.txt, fontWeight: 700 }}>{fmt(resData.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.sub }}>IVA ({params.iva}%)</span>
                <span style={{ color: T.txt }}>{fmt(resData.ivaAmt)}</span>
              </div>

              <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>TOTAL USD</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: T.AMB }}>{fmt(resData.total)}</span>
                </div>
                <div style={{ fontSize: 11, color: T.mute, textAlign: 'right', marginTop: 4 }}>CRC {fmtCRC(resData.totalCRC)}</div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.bdr}`, background: T.card2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3, marginBottom: 8 }}>OPERACIÓN</div>
                <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
                  {itineraryIsEvent
                    ? 'Con varios tramos en itinerario se creará un evento con todas las tareas asociadas.'
                    : 'Con un solo tramo se creará una tarea individual para operación diaria.'}
                </div>
                {operationMsg && (
                  <div style={{ fontSize: 12, color: operationMsg.toLowerCase().includes('no se pudo') || operationMsg.toLowerCase().includes('completa') ? T.RED : T.GRN, marginTop: 8 }}>
                    {operationMsg}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  onClick={createOperationFromProforma}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: T.card2,
                    color: T.txt,
                    border: `1px solid ${T.bdr}`,
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Clock size={16} /> {itineraryIsEvent ? 'Crear evento' : 'Crear tarea'}
                </button>
                <button
                  onClick={handleGuardarManual}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: T.BLU,
                    color: '#fff',
                    border: `1px solid ${T.BLU}55`,
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 10px 24px rgba(59,130,246,0.20)',
                  }}
                >
                  <Save size={16} /> Guardar proforma
                </button>
                <button
                  onClick={generarPDF}
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    background: T.ambDim,
                    border: `1px solid ${T.AMB}55`,
                    borderRadius: 12,
                    color: T.AMB,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <FileText size={16} /> Generar PDF
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <MapLocationPicker
        open={Boolean(mapPickerField)}
        title={mapPickerField === 'destino' ? 'Seleccionar destino en mapa' : 'Seleccionar origen en mapa'}
        initialQuery={mapPickerField === 'destino' ? socio.sDestino : socio.sOrigen}
        initialCoords={mapPickerField === 'destino' ? socio.sDestinoCoords : socio.sOrigenCoords}
        onClose={() => setMapPickerField('')}
        onConfirm={applyMapLocation}
      />
    </div>
    </div>
  );
}
