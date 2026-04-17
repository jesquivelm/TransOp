import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Link,
  Map,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { pdfGen } from '../../utils/pdfGenerator';
import { normalizeTimeInput } from '../../utils/voiceDrafts';
import { useSocios } from '../../hooks/useSocios';
import { T } from '../../theme';

const ESTADOS = [
  { id: 'borrador', label: 'Borrador', color: T.mute, bg: 'rgba(100,116,139,0.14)' },
  { id: 'enviada', label: 'Enviada', color: T.BLU, bg: T.bluDim },
  { id: 'seguimiento', label: 'Seguimiento', color: T.AMB, bg: T.ambDim },
  { id: 'aprobada', label: 'Aprobada', color: T.GRN, bg: T.grnDim },
  { id: 'rechazada', label: 'Rechazada', color: T.RED, bg: T.redDim },
];

const UNIT_PANEL_TABS = [
  { id: 'operacion', label: 'Operación' },
  { id: 'itinerario', label: 'Itinerario' },
];

const MONEY_SCHEMA_VERSION = 'crc_v2';
const DEFAULT_CRC_PER_USD = 512;
const DEFAULT_EUR_PER_USD = 0.92;
const BASE_CURRENCY = 'CRC';
const DISPLAY_CURRENCIES = [
  { code: 'CRC', label: 'Colones', symbol: '₡' },
  { code: 'USD', label: 'Dólares', symbol: '$' },
  { code: 'EUR', label: 'Euros', symbol: '€' },
];
const LEGACY_TRANSFER_PRESETS = [
  { id: 'transfer-in-sjo', descripcion: 'Transfer IN Aeropuerto SJO', legacyUsd: 50 },
  { id: 'transfer-out-sjo', descripcion: 'Transfer OUT Aeropuerto SJO', legacyUsd: 45 },
  { id: 'transfer-in-ctg', descripcion: 'Transfer IN Aeropuerto Cartago', legacyUsd: 65 },
  { id: 'transfer-out-ctg', descripcion: 'Transfer OUT Aeropuerto Cartago', legacyUsd: 60 },
];

const PARAMS_DEFAULT = {
  km: 0,
  combustible: 92.16,
  tipoCombustible: 'Diesel',
  tc: DEFAULT_CRC_PER_USD,
  eurRate: DEFAULT_EUR_PER_USD,
  colaborador: 12800,
  peajes: 7680,
  carga: 0,
  viaticos: 5120,
  ferry: 0,
  utilidad: 0,
  utilidadPct: 0,
  descuentoPct: 0,
  iva: 13,
  chkDia: false,
  adicCol: 7680,
  adicViat: 7680,
  tarifaGAM: 76800,
  diasGAM: 0,
  mediaTarifa: 38400,
  diasSM: 0,
  selectedTransfers: [],
  hospedaje: 20480,
  noches: 0,
  viatDiario: 12800,
  persViat: 1,
  persHosp: 1,
  hospedajeTotalManual: 0,
  moneySchema: MONEY_SCHEMA_VERSION,
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
    cfMoneda: 'CRC',
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

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getCurrencyMeta(code = BASE_CURRENCY) {
  return DISPLAY_CURRENCIES.find(item => item.code === code) || DISPLAY_CURRENCIES[0];
}

function getCrcPerUsd(tc) {
  return Number(tc) > 0 ? Number(tc) : DEFAULT_CRC_PER_USD;
}

function getEurPerUsd(rate) {
  return Number(rate) > 0 ? Number(rate) : DEFAULT_EUR_PER_USD;
}

function convertLegacyUsdToCrc(value, tc = DEFAULT_CRC_PER_USD) {
  return roundMoney((Number(value) || 0) * getCrcPerUsd(tc));
}

function createDefaultTransferCatalog(tc = DEFAULT_CRC_PER_USD) {
  return LEGACY_TRANSFER_PRESETS.map(item => ({
    id: item.id,
    descripcion: item.descripcion,
    costo: convertLegacyUsdToCrc(item.legacyUsd, tc),
    activo: true,
  }));
}

function normalizeTransferCatalog(rawValue, tc = DEFAULT_CRC_PER_USD) {
  const fallback = createDefaultTransferCatalog(tc);
  if (!Array.isArray(rawValue) || rawValue.length === 0) return fallback;
  return rawValue.map((item, index) => ({
    id: item.id || `transfer-${index + 1}`,
    descripcion: String(item.descripcion || item.nombre || `Transfer ${index + 1}`).trim(),
    costo: roundMoney(Number(item.costo ?? item.costo_crc ?? item.valor) || 0),
    activo: item.activo !== false,
  })).filter(item => item.descripcion);
}

function normalizeSelectedTransfers(rawTransfers = []) {
  if (!Array.isArray(rawTransfers)) return [];
  return rawTransfers.map((item, index) => ({
    id: item.id || `selected-transfer-${index + 1}`,
    descripcion: String(item.descripcion || item.nombre || `Transfer ${index + 1}`).trim(),
    costo: roundMoney(Number(item.costo ?? item.costo_crc ?? item.valor) || 0),
  })).filter(item => item.descripcion);
}

function legacyFlagsToSelectedTransfers(rawParams = {}, tc = DEFAULT_CRC_PER_USD) {
  const catalog = createDefaultTransferCatalog(tc);
  const picks = [];
  if (rawParams.ckTinSJ) picks.push(catalog.find(item => item.id === 'transfer-in-sjo'));
  if (rawParams.ckToutSJ) picks.push(catalog.find(item => item.id === 'transfer-out-sjo'));
  if (rawParams.ckTinCTG) picks.push(catalog.find(item => item.id === 'transfer-in-ctg'));
  if (rawParams.ckToutCTG) picks.push(catalog.find(item => item.id === 'transfer-out-ctg'));
  return picks.filter(Boolean);
}

function normalizeLegacyParamMoney(rawParams = {}, tc = DEFAULT_CRC_PER_USD) {
  const fields = [
    'combustible', 'colaborador', 'peajes', 'carga', 'viaticos', 'ferry', 'utilidad',
    'adicCol', 'adicViat', 'tarifaGAM', 'mediaTarifa', 'hospedaje', 'viatDiario', 'hospedajeTotalManual',
  ];
  const next = { ...rawParams };
  fields.forEach(field => {
    if (rawParams[field] == null) return;
    next[field] = convertLegacyUsdToCrc(rawParams[field], tc);
  });
  return next;
}

function normalizeUnitMoney(unit = {}, tc = DEFAULT_CRC_PER_USD) {
  if (unit.moneySchema === MONEY_SCHEMA_VERSION) {
    return {
      ...unit,
      combustible: roundMoney(Number(unit.combustible) || 0),
      precioCombustibleLitro: roundMoney(Number(unit.precioCombustibleLitro) || 0),
      rendimiento: roundMoney(Number(unit.rendimiento) || 0),
      colaborador: roundMoney(Number(unit.colaborador) || 0),
      peajes: roundMoney(Number(unit.peajes) || 0),
      carga: roundMoney(Number(unit.carga) || 0),
      ferry: roundMoney(Number(unit.ferry) || 0),
      moneySchema: MONEY_SCHEMA_VERSION,
    };
  }
  return {
    ...unit,
    combustible: convertLegacyUsdToCrc(unit.combustible, tc),
    precioCombustibleLitro: roundMoney(Number(unit.precioCombustibleLitro) || 0),
    rendimiento: roundMoney(Number(unit.rendimiento) || 0),
    colaborador: convertLegacyUsdToCrc(unit.colaborador, tc),
    peajes: convertLegacyUsdToCrc(unit.peajes, tc),
    carga: convertLegacyUsdToCrc(unit.carga, tc),
    ferry: convertLegacyUsdToCrc(unit.ferry, tc),
    moneySchema: MONEY_SCHEMA_VERSION,
  };
}

function getFuelPriceByType(tipoCombustible = 'Diésel', fuelPrices = null) {
  if (!fuelPrices) return 0;
  const tipo = String(tipoCombustible || 'Diésel').toLowerCase();
  return Number(
    fuelPrices[
      tipo === 'súper' || tipo === 'super'
        ? 'super'
        : tipo === 'regular'
          ? 'regular'
          : 'diesel'
    ]
  ) || 0;
}

function calcFuelCostPerKm(precioCombustibleLitro = 0, rendimiento = 0) {
  const price = Number(precioCombustibleLitro) || 0;
  const performance = Number(rendimiento) || 0;
  if (price <= 0 || performance <= 0) return 0;
  return roundMoney(price / performance);
}

function applyFuelMetrics(unit = {}) {
  const precioCombustibleLitro = roundMoney(Number(unit.precioCombustibleLitro) || 0);
  const rendimiento = roundMoney(Number(unit.rendimiento) || 0);
  return {
    ...unit,
    precioCombustibleLitro,
    rendimiento,
    combustible: calcFuelCostPerKm(precioCombustibleLitro, rendimiento),
  };
}

function normalizeVehicleMoney(value, tc = DEFAULT_CRC_PER_USD, legacyThreshold = 250) {
  const numeric = Number(value) || 0;
  if (!numeric) return 0;
  if (numeric <= legacyThreshold) return convertLegacyUsdToCrc(numeric, tc);
  return roundMoney(numeric);
}

function vehicleMoneyOrFallback(value, fallbackValue = 0, tc = DEFAULT_CRC_PER_USD, legacyThreshold = 250) {
  if (value == null || value === '') return roundMoney(Number(fallbackValue) || 0);
  return normalizeVehicleMoney(value, tc, legacyThreshold);
}

function preferPositiveNumber(value, fallbackValue = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return Number(fallbackValue) || 0;
}

function convertCrcToDisplay(value, currency = BASE_CURRENCY, exchange = {}) {
  const amount = Number(value) || 0;
  if (currency === 'USD') return amount / getCrcPerUsd(exchange.tc);
  if (currency === 'EUR') return (amount / getCrcPerUsd(exchange.tc)) * getEurPerUsd(exchange.eurRate);
  return amount;
}

function formatMoney(value, currency = BASE_CURRENCY, exchange = {}) {
  const safeCurrency = getCurrencyMeta(currency).code;
  const amount = convertCrcToDisplay(value, safeCurrency, exchange);
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${getCurrencyMeta(safeCurrency).symbol}${roundMoney(amount).toFixed(2)}`;
  }
}

function fmtCRC(v) {
  return formatMoney(v, 'CRC');
}

function MonetaryInput({ symbol = '₡', style = {}, inputStyle: customInputStyle = {}, ...props }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span
        style={{
          position: 'absolute',
          left: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          color: T.mute,
          fontSize: 13,
          pointerEvents: 'none',
        }}
      >
        {symbol}
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        {...props}
        style={{ ...inputStyle, paddingLeft: 28, ...customInputStyle }}
      />
    </div>
  );
}

function PercentInput({ style = {}, inputStyle: customInputStyle = {}, ...props }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        type="number"
        step="0.01"
        min="0"
        {...props}
        style={{ ...inputStyle, paddingRight: 28, ...customInputStyle }}
      />
      <span
        style={{
          position: 'absolute',
          right: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          color: T.mute,
          fontSize: 13,
          pointerEvents: 'none',
        }}
      >
        %
      </span>
    </div>
  );
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

function buildVehicleDefaults(vehiculo = {}, fuelPrices = null, tc = 512, fallback = {}) {
  const rendimiento = roundMoney(Number(vehiculo.rendimiento) || 0);
  const precioCombustibleLitro = roundMoney(
    getFuelPriceByType(vehiculo.combustible_tipo || 'Diésel', fuelPrices)
    || vehicleMoneyOrFallback(vehiculo.combustible_costo, fallback.precioCombustibleLitro, tc, 9999)
  );
  const combustible = calcFuelCostPerKm(precioCombustibleLitro, rendimiento);
  return {
    colaborador: vehicleMoneyOrFallback(vehiculo.colaborador, fallback.colaborador, tc),
    combustible: Number(combustible) || 0,
    precioCombustibleLitro,
    rendimiento: rendimiento || roundMoney(Number(fallback.rendimiento) || 0),
    tipoCombustible: vehiculo.combustible_tipo || 'Diésel',
    peajes: vehicleMoneyOrFallback(vehiculo.peajes, fallback.peajes, tc),
    carga: vehicleMoneyOrFallback(vehiculo.carga, fallback.carga, tc),
    viaticos: vehicleMoneyOrFallback(vehiculo.viaticos, fallback.viaticos, tc),
    utilidad: vehicleMoneyOrFallback(vehiculo.utilidad, fallback.utilidad, tc),
    ferry: vehicleMoneyOrFallback(vehiculo.ferry, fallback.ferry, tc),
    moneySchema: MONEY_SCHEMA_VERSION,
  };
}

function createProformaUnit(base = {}, vehiculos = [], preferredVehiculoId = null, fuelPrices = null, tc = 512, options = {}) {
  const { allowSuggestedVehicle = true } = options;
  const normalizedBase = normalizeUnitMoney(base, tc);
  const hasBaseValue = (field) => Object.prototype.hasOwnProperty.call(base, field) && base[field] != null;
  const unitId = base.id || `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const vehiculoId = base.vehiculoId
    || preferredVehiculoId
    || (allowSuggestedVehicle ? chooseSuggestedVehicle(vehiculos, base.sPax || 0, null) : null)
    || (allowSuggestedVehicle ? (vehiculos[0]?.id || null) : null);
  const vehiculo = vehiculos.find(item => item.id === vehiculoId) || {};
  const defaults = buildVehicleDefaults(vehiculo, fuelPrices, tc, normalizedBase);
  const clonedRows = sanitizeItineraryRows(base.itineraryRows || []).map(row => createItineraryRow({
    ...row,
    vehiculoId: allowSuggestedVehicle ? (row.vehiculoId || vehiculoId || null) : null,
    vehiculoLabel: allowSuggestedVehicle ? row.vehiculoLabel || formatVehicleLabel(vehiculo) : '',
  }));
  const itinerary = base.itinerary
    ? {
        ...base.itinerary,
        unitId,
      }
    : null;
  return applyFuelMetrics({
    id: unitId,
    sFecha: base.sFecha || '',
    sHora: base.sHora || '',
    sPax: Number(base.sPax || 1),
    sOrigen: base.sOrigen || '',
    sOrigenCoords: base.sOrigenCoords || null,
    sDestino: base.sDestino || '',
    sDestinoCoords: base.sDestinoCoords || null,
    km: Number(base.km || 0),
    combustible: Number(hasBaseValue('combustible') ? normalizedBase.combustible : defaults.combustible),
    precioCombustibleLitro: Number(hasBaseValue('precioCombustibleLitro') ? normalizedBase.precioCombustibleLitro : defaults.precioCombustibleLitro),
    rendimiento: Number(hasBaseValue('rendimiento') ? normalizedBase.rendimiento : defaults.rendimiento),
    tipoCombustible: base.tipoCombustible || defaults.tipoCombustible,
    colaborador: Number(hasBaseValue('colaborador') ? normalizedBase.colaborador : defaults.colaborador),
    peajes: Number(hasBaseValue('peajes') ? normalizedBase.peajes : defaults.peajes),
    carga: Number(hasBaseValue('carga') ? normalizedBase.carga : defaults.carga),
    ferry: Number(hasBaseValue('ferry') ? normalizedBase.ferry : defaults.ferry),
    cobrarCombustible: base.cobrarCombustible !== false,
    cobrarColaborador: base.cobrarColaborador !== false,
    cobrarPeajes: base.cobrarPeajes !== false,
    cobrarCarga: base.cobrarCarga !== false,
    cobrarFerry: base.cobrarFerry !== false,
    ...defaults,
    ...normalizedBase,
    ...(hasBaseValue('combustible') ? { combustible: Number(normalizedBase.combustible) || 0 } : { combustible: Number(defaults.combustible) || 0 }),
    ...(hasBaseValue('precioCombustibleLitro') ? { precioCombustibleLitro: Number(normalizedBase.precioCombustibleLitro) || 0 } : { precioCombustibleLitro: Number(defaults.precioCombustibleLitro) || 0 }),
    ...(hasBaseValue('rendimiento') ? { rendimiento: Number(normalizedBase.rendimiento) || 0 } : { rendimiento: Number(defaults.rendimiento) || 0 }),
    ...(hasBaseValue('colaborador') ? { colaborador: Number(normalizedBase.colaborador) || 0 } : { colaborador: Number(defaults.colaborador) || 0 }),
    ...(hasBaseValue('peajes') ? { peajes: Number(normalizedBase.peajes) || 0 } : { peajes: Number(defaults.peajes) || 0 }),
    ...(hasBaseValue('carga') ? { carga: Number(normalizedBase.carga) || 0 } : { carga: Number(defaults.carga) || 0 }),
    ...(hasBaseValue('ferry') ? { ferry: Number(normalizedBase.ferry) || 0 } : { ferry: Number(defaults.ferry) || 0 }),
    moneySchema: MONEY_SCHEMA_VERSION,
    vehiculoId,
    itinerary,
    itineraryRows: clonedRows,
  });
}

function createUnitDraftFromSource(sourceUnit = {}, vehiculos = [], fuelPrices = null, tc = 512) {
  return createProformaUnit({
    sFecha: sourceUnit.sFecha || '',
    sHora: sourceUnit.sHora || '',
    sPax: Number(sourceUnit.sPax || 1),
    sOrigen: sourceUnit.sOrigen || '',
    sOrigenCoords: sourceUnit.sOrigenCoords || null,
    sDestino: sourceUnit.sDestino || '',
    sDestinoCoords: sourceUnit.sDestinoCoords || null,
    km: Number(sourceUnit.km || 0),
    combustible: Number(sourceUnit.combustible || 0),
    precioCombustibleLitro: Number(sourceUnit.precioCombustibleLitro || 0),
    rendimiento: Number(sourceUnit.rendimiento || 0),
    tipoCombustible: sourceUnit.tipoCombustible || 'Diésel',
    colaborador: Number(sourceUnit.colaborador || 0),
    peajes: Number(sourceUnit.peajes || 0),
    carga: Number(sourceUnit.carga || 0),
    ferry: Number(sourceUnit.ferry || 0),
    cobrarCombustible: sourceUnit.cobrarCombustible !== false,
    cobrarColaborador: sourceUnit.cobrarColaborador !== false,
    cobrarPeajes: sourceUnit.cobrarPeajes !== false,
    cobrarCarga: sourceUnit.cobrarCarga !== false,
    cobrarFerry: sourceUnit.cobrarFerry !== false,
    itinerary: sourceUnit.itinerary ? { ...sourceUnit.itinerary } : null,
    itineraryRows: sanitizeItineraryRows(sourceUnit.itineraryRows || []).map(row => ({
      ...row,
      vehiculoId: null,
      vehiculoLabel: '',
    })),
    vehiculoId: null,
  }, vehiculos, null, fuelPrices, tc, { allowSuggestedVehicle: false });
}

function hydrateProformaUnits({ savedUnits = [], socioData = {}, paramsData = {}, vehiculos = [], vehiculoId = null, fuelPrices = null }) {
  if (Array.isArray(savedUnits) && savedUnits.length > 0) {
    return savedUnits.map(unit => createProformaUnit(
      unit,
      vehiculos,
      unit.vehiculoId || vehiculoId,
      fuelPrices,
      paramsData.tc || PARAMS_DEFAULT.tc,
    ));
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
    precioCombustibleLitro: paramsData.precioCombustibleLitro,
    rendimiento: paramsData.rendimiento,
    tipoCombustible: paramsData.tipoCombustible,
    colaborador: paramsData.colaborador,
    peajes: paramsData.peajes,
    carga: paramsData.carga,
    ferry: paramsData.ferry,
    vehiculoId,
  }, vehiculos, vehiculoId, fuelPrices, paramsData.tc || PARAMS_DEFAULT.tc)];
}

function createItineraryRow(base = {}) {
  return {
    id: base.id || `itin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: base.fecha || '',
    hora: normalizeTimeInput(base.hora || '') || '',
    origen: base.origen || '',
    destino: base.destino || '',
    recorrido: base.recorrido || '',
    tiempoEstimado: base.tiempoEstimado || '',
    vehiculoId: base.vehiculoId || null,
    vehiculoLabel: base.vehiculoLabel || '',
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

function buildItineraryFromRouteResult(routeResult, unitData = {}) {
  if (!routeResult) return null;
  const { origin, destination, waypoints = [], originDesc = '', destinationDesc = '', waypointsDesc = [], dates = [], result } = routeResult;
  const segments = [];
  const legs = result?.legs || [];
  const allPoints = [origin, ...waypoints, destination];
  const allDescs = [originDesc, ...waypointsDesc, destinationDesc];
  for (let d = 0; d < dates.length; d++) {
    const daySegments = [];
    let segIndex = 0;
    for (let i = 0; i < allPoints.length - 1; i++) {
      const fromPt = allPoints[i];
      const toPt = allPoints[i + 1];
      const leg = legs[segIndex + d * (allPoints.length - 1)] || legs[segIndex];
      const distanceValue = Number(leg?.distance?.value ?? leg?.distance ?? 0);
      const durationValue = Number(leg?.duration?.value ?? leg?.duration ?? 0);
      daySegments.push({
        order: i + 1,
        from: fromPt,
        to: toPt,
        fromDesc: allDescs[i] || '',
        toDesc: allDescs[i + 1] || '',
        distance_m: distanceValue,
        duration_s: durationValue,
      });
      segIndex++;
    }
    if (daySegments.length > 0) {
      segments.push({
        date: dates[d],
        segments: daySegments,
      });
    }
  }
  if (segments.length === 0) {
    for (let i = 0; i < allPoints.length - 1; i++) {
      const leg = legs[i] || {};
      const distanceValue = Number(leg?.distance?.value ?? leg?.distance ?? 0);
      const durationValue = Number(leg?.duration?.value ?? leg?.duration ?? 0);
      segments.push({
        date: dates[0] || routeResult?.date || '',
        segments: [{
          order: i + 1,
          from: allPoints[i],
          to: allPoints[i + 1],
          fromDesc: allDescs[i] || '',
          toDesc: allDescs[i + 1] || '',
          distance_m: distanceValue,
          duration_s: durationValue,
        }],
      });
    }
  }
  const totalDistance = segments.reduce((acc, day) => acc + day.segments.reduce((a, s) => a + (s.distance_m || 0), 0), 0);
  const totalDuration = segments.reduce((acc, day) => acc + day.segments.reduce((a, s) => a + (s.duration_s || 0), 0), 0);
  return {
    unitId: unitData.id || null,
    days: segments,
    totals: {
      distance_m: totalDistance,
      duration_s: totalDuration,
    },
    raw: routeResult,
  };
}

function formatDistance(meters) {
  if (!meters || meters <= 0) return '0 km';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function formatVehicleLabel(vehiculo = null) {
  if (!vehiculo) return '';
  return [vehiculo.placa, [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}

function getTaskVehicleId(task = {}) {
  return task?.vehId || task?.vehiculoId || task?.vehiculo_id || null;
}

function getUnitServiceDate(unit = {}, fallbackDate = '') {
  if (unit?.sFecha) return unit.sFecha;
  const firstRowWithDate = sanitizeItineraryRows(unit?.itineraryRows || []).find(row => row.fecha);
  return firstRowWithDate?.fecha || fallbackDate || '';
}

function sumItineraryDistanceKm(rows = []) {
  return rows.reduce((sum, row) => {
    const raw = String(row?.recorrido || '').trim().toLowerCase();
    if (!raw) return sum;
    const numeric = Number.parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(numeric)) return sum;
    return sum + numeric;
  }, 0);
}

function sumItineraryDurationSeconds(rows = []) {
  return rows.reduce((sum, row) => {
    const raw = String(row?.tiempoEstimado || '').trim().toLowerCase();
    if (!raw) return sum;
    const hoursMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*h/);
    const minutesMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*min/);
    const hours = hoursMatch ? Number.parseFloat(hoursMatch[1].replace(',', '.')) : 0;
    const minutes = minutesMatch ? Number.parseFloat(minutesMatch[1].replace(',', '.')) : 0;
    if (!Number.isFinite(hours) && !Number.isFinite(minutes)) return sum;
    return sum + ((Number.isFinite(hours) ? hours : 0) * 3600) + ((Number.isFinite(minutes) ? minutes : 0) * 60);
  }, 0);
}

function summarizeItinerary(itinerary) {
  if (!itinerary || !itinerary.days || itinerary.days.length === 0) return null;
  const { days, totals } = itinerary;
  const stops = days.reduce((acc, d) => acc + (d.segments?.length || 0) + 1, 0);
  return {
    stops: stops,
    days: days.length,
    distance: formatDistance(totals?.distance_m || 0),
    duration: formatDuration(totals?.duration_s || 0),
  };
}

function summarizeItineraryRows(rows = []) {
  const safeRows = sanitizeItineraryRows(rows).filter(itineraryRowComplete);
  if (!safeRows.length) return null;
  return {
    stops: safeRows.length + 1,
    days: new Set(safeRows.map(row => row.fecha).filter(Boolean)).size || 1,
    distance: formatDistance(sumItineraryDistanceKm(safeRows) * 1000),
    duration: formatDuration(sumItineraryDurationSeconds(safeRows)),
  };
}

function buildItineraryRowsFromRouteResult(routeResult, { initialTime = '' } = {}) {
  const itinerary = buildItineraryFromRouteResult(routeResult);
  if (!itinerary?.days?.length) return [];
  const rows = [];
  itinerary.days.forEach(day => {
    (day.segments || []).forEach((segment, index) => {
      rows.push(createItineraryRow({
        fecha: day.date || '',
        hora: rows.length === 0 ? (normalizeTimeInput(initialTime || '') || '') : '',
        origen: segment.fromDesc || segment.from || '',
        destino: segment.toDesc || segment.to || '',
        recorrido: formatDistance(segment.distance_m || 0),
        tiempoEstimado: formatDuration(segment.duration_s || 0),
        vehiculoId: routeResult?.vehiculoId || null,
        vehiculoLabel: routeResult?.vehicleLabel || '',
      }));
    });
  });
  return rows;
}

function buildItineraryRowsFromRouteResults(routeResults, { initialTime = '', defaultVehiculoId = null, defaultVehiculoLabel = '' } = {}) {
  const rows = [];
  (Array.isArray(routeResults) ? routeResults : []).forEach((routeResult, routeIndex) => {
    const nextRows = buildItineraryRowsFromRouteResult(routeResult, {
      initialTime: rows.length === 0 ? initialTime : '',
    }).map(row => createItineraryRow({
      ...row,
      vehiculoId: row.vehiculoId || defaultVehiculoId,
      vehiculoLabel: row.vehiculoLabel || defaultVehiculoLabel,
    }));
    rows.push(...nextRows);
  });
  return rows;
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
  const safeTc = getCrcPerUsd(tc);
  return {
    ...PARAMS_DEFAULT,
    tc: safeTc,
    eurRate: DEFAULT_EUR_PER_USD,
    utilidadPct: getEmpresaUtilidadPct(empresaData),
    utilidad: 0,
    selectedTransfers: [],
    moneySchema: MONEY_SCHEMA_VERSION,
  };
}

function normalizeStoredParams(rawParams = {}, { fallbackTc = PARAMS_DEFAULT.tc, empresaData = {} } = {}) {
  const hasUtilityPct = rawParams.utilidadPct != null
    || rawParams.porcentajeUtilidad != null
    || rawParams.porcentaje_utilidad != null;
  const safeTc = Number(rawParams.tc) || Number(fallbackTc) || PARAMS_DEFAULT.tc;
  const baseParams = rawParams.moneySchema === MONEY_SCHEMA_VERSION
    ? rawParams
    : normalizeLegacyParamMoney(rawParams, safeTc);
  const selectedTransfers = Array.isArray(baseParams.selectedTransfers) && baseParams.selectedTransfers.length > 0
    ? normalizeSelectedTransfers(baseParams.selectedTransfers)
    : legacyFlagsToSelectedTransfers(rawParams, safeTc);
  return {
    ...PARAMS_DEFAULT,
    ...baseParams,
    tc: safeTc,
    eurRate: Number(baseParams.eurRate) || DEFAULT_EUR_PER_USD,
    utilidadPct: hasUtilityPct
      ? (Number(baseParams.utilidadPct ?? rawParams.porcentajeUtilidad ?? rawParams.porcentaje_utilidad) || 0)
      : getEmpresaUtilidadPct(empresaData),
    utilidad: hasUtilityPct ? 0 : (Number(baseParams.utilidad) || 0),
    descuentoPct: Number(baseParams.descuentoPct) || 0,
    selectedTransfers,
    moneySchema: MONEY_SCHEMA_VERSION,
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

function RouteDesignerModal({ unitId, unitItinerary, vehiculoId = null, vehicleLabel = '', googleMapsApiKey, onClose, onSave }) {
  const iframeRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingState, setLoadingState] = useState('Cargando...');

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'route-apply') {
          onSave(data.route);
        } else if (data.type === 'routes-apply') {
          onSave(data.routes || []);
        }
      } catch (e) { 
        console.error('Error parsing message from iframe:', e);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSave]);

  const handleLoadIframe = () => {
    setLoadingState('');
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'reset-session' }, '*');
        iframeRef.current.contentWindow.postMessage({
          type: 'designer-context',
          context: { unitId, vehicleLabel, vehiculoId },
        }, '*');
        if (unitItinerary?.raw?.origin) {
          iframeRef.current.contentWindow.postMessage({ type: 'load-route', route: unitItinerary.raw }, '*');
        }
      } catch (e) {
        console.error('Error sending route context to iframe:', e);
      }
    }
  };

  const iframeSrc = googleMapsApiKey 
    ? `/designroute.html?apiKey=${encodeURIComponent(googleMapsApiKey)}&mode=embedded`
    : '/designroute.html';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        padding: isExpanded ? 0 : 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isExpanded ? '12px 20px' : '0 0 12px 0',
          background: isExpanded ? T.card : 'transparent',
          borderRadius: isExpanded ? 0 : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Map size={20} color={T.AMB} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Route Designer</div>
            {(vehicleLabel || unitId) && (
              <div style={{ fontSize: 11, color: T.mute }}>
                {vehicleLabel ? `Vehículo: ${vehicleLabel}` : `Unidad: ${unitId.slice(-6)}`}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '8px 12px',
              background: T.card2,
              border: `1px solid ${T.bdr}`,
              borderRadius: 8,
              color: T.txt,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {isExpanded ? 'Compactar' : 'Pantalla completa'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              background: T.redDim,
              border: `1px solid ${T.RED}`,
              borderRadius: 8,
              color: T.RED,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {loadingState && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: T.card,
            zIndex: 1,
            color: T.sub,
          }}>
            {loadingState}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          onLoad={handleLoadIframe}
          onError={() => setLoadingState('Error cargando el mapa')}
          style={{
            flex: 1,
            width: isExpanded ? '100%' : '100%',
            height: isExpanded ? '100%' : 'calc(100vh - 180px)',
            border: `1px solid ${T.bdr}`,
            borderRadius: isExpanded ? 0 : 14,
            background: '#fff',
          }}
          allow="geolocation; allow-scripts"
        />
      </div>
    </div>
  );
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

export default function CotizadorView({
  voiceDraft = null,
  onVoiceDraftApplied,
  onHeaderMetaChange,
  onCreateEvento,
  onCreateTarea,
  onFocusTask,
  mode = 'root',
  initialTabId = null,
  initialTabLabel = '',
  initialSnapshot = null,
  onOpenProforma = null,
  onSnapshotChange = null,
  onTabMetaChange = null,
}) {
  const { token, user } = useAuth();
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const isExternalDetailMode = mode === 'detail';
  const detailTabId = initialTabId || 'proforma-detalle';
  const detailTabLabel = initialTabLabel || initialSnapshot?.socio?.cfNumero || 'Nueva proforma';

  const [tabs, setTabs] = useState(() => (
    isExternalDetailMode
      ? [{ id: detailTabId, type: initialSnapshot?.selectedId ? 'proforma' : 'new', label: detailTabLabel }]
      : [{ id: 'lista', type: 'list', label: 'Proformas' }]
  ));
  const [activeTabId, setActiveTabId] = useState(isExternalDetailMode ? detailTabId : 'lista');
  const [tabsData, setTabsData] = useState(() => (
    isExternalDetailMode && initialSnapshot
      ? { [detailTabId]: initialSnapshot }
      : {}
  ));

  // Persistencia de pestañas en localStorage para evitar pérdida de datos al cambiar de módulo
  useEffect(() => {
    if (mode !== 'standalone') return;
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
    if (mode !== 'standalone') return;
    if (tabs.length > 0) {
      localStorage.setItem('tms_cotizador_tabs', JSON.stringify(tabs));
      localStorage.setItem('tms_cotizador_tabs_data', JSON.stringify(tabsData));
    }
  }, [tabs, tabsData]);
  const [openSection, setOpenSection] = useState('');
  const [vehiculoActivo, setVehiculoActivo] = useState(null);
  const [units, setUnits] = useState([createProformaUnit()]);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [activeUnitTab, setActiveUnitTab] = useState('operacion');
  const [params, setParams] = useState(() => buildDefaultParams());
  const [draftDefaults, setDraftDefaults] = useState(() => buildDefaultParams());
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
  const [scheduledTasksByDate, setScheduledTasksByDate] = useState({});
  const [conductores, setConductores] = useState([]);
  const [showConductorPicker, setShowConductorPicker] = useState(false);
  const [fuelPrices, setFuelPrices] = useState(null);
  const [empresaData, setEmpresaData] = useState({});
  const [cotizacionesConfig, setCotizacionesConfig] = useState(() => ({
    monedaBase: BASE_CURRENCY,
    monedaDefault: BASE_CURRENCY,
    transfers: createDefaultTransferCatalog(DEFAULT_CRC_PER_USD),
  }));
  const [itineraryRows, setItineraryRows] = useState([]);
  const [operationMsg, setOperationMsg] = useState('');
  const [showRouteDesigner, setShowRouteDesigner] = useState(false);
  const [routeDesignerUnitId, setRouteDesignerUnitId] = useState(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');

  const autosaveTimer = useRef(null);
  const lastSavedSignature = useRef('');
  const savingRef = useRef(false);
  const guardarRef = useRef(null);
  const isHydratingTabRef = useRef(false);
  const hydratedExternalDetailRef = useRef('');
  const pendingRestoreTabIdRef = useRef('lista');
  const draftDefaultsRef = useRef(draftDefaults);
  const empresaDataRef = useRef(empresaData);
  const vehiculosRef = useRef(vehiculos);
  const fuelPricesRef = useRef(fuelPrices);
  const clienteSearchWrapperRef = useRef(null);
  const [socioDropdownStyle, setSocioDropdownStyle] = useState(null);

  const { socios: sociosBD, loading: loadingSocios } = useSocios(token);
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  const isListTab = activeTab?.type === 'list';
  const isDetailTab = !isListTab;
  const activeUnit = units.find(unit => unit.id === activeUnitId) || units[0] || null;
  const effectiveProformaNumber = socio.cfNumero || (activeTab?.type === 'proforma' ? activeTab?.label || '' : '');
  const displayCurrency = socio.cfMoneda || cotizacionesConfig.monedaDefault || BASE_CURRENCY;
  const moneyExchange = useMemo(() => ({ tc: params.tc, eurRate: params.eurRate }), [params.eurRate, params.tc]);
  const transferCatalog = useMemo(
    () => normalizeTransferCatalog(cotizacionesConfig.transfers, params.tc),
    [cotizacionesConfig.transfers, params.tc]
  );
  const createDraftParams = useCallback((overrides = {}) => ({
    ...draftDefaultsRef.current,
    ...overrides,
    moneySchema: MONEY_SCHEMA_VERSION,
  }), []);

  useEffect(() => {
    draftDefaultsRef.current = draftDefaults;
  }, [draftDefaults]);

  useEffect(() => {
    empresaDataRef.current = empresaData;
  }, [empresaData]);

  useEffect(() => {
    vehiculosRef.current = vehiculos;
  }, [vehiculos]);

  useEffect(() => {
    fuelPricesRef.current = fuelPrices;
  }, [fuelPrices]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, hRes, cRes, tcRes, fRes, eRes, qRes, apiRes] = await Promise.all([
        fetch('/api/tms/vehiculos', { headers: authH }),
        fetch('/api/tms/proformas', { headers: authH }),
        fetch('/api/tms/config/global', { headers: authH }),
        fetch('/api/tms/tipos-cambio/ultimo', { headers: authH }),
        fetch('/api/tms/combustibles/actual', { headers: authH }),
        fetch('/api/tms/config/empresa', { headers: authH }),
        fetch('/api/tms/config/cotizaciones', { headers: authH }),
        fetch('/api/tms/config/apis', { headers: authH }),
      ]);

      if (vRes.ok) {
        const vData = await vRes.json();
        setVehiculos(vData);
        if (vData.length > 0 && !vehiculoActivo) setVehiculoActivo(vData[0].id);
      }

      if (hRes.ok) setHistorial(await hRes.json());

      let nextEmpresa = empresaDataRef.current || {};
      if (eRes && eRes.ok) {
        const eData = await eRes.json();
        if (eData.success) {
          nextEmpresa = eData.data || {};
          setEmpresaData(nextEmpresa);
        }
      }

      let nextTc = draftDefaultsRef.current?.tc || DEFAULT_CRC_PER_USD;
      let nextEurRate = draftDefaultsRef.current?.eurRate || DEFAULT_EUR_PER_USD;
      let configGlobal = null;
      if (cRes.ok) {
        configGlobal = await cRes.json();
        if (configGlobal?.params?.tc) nextTc = Number(configGlobal.params.tc) || nextTc;
        if (configGlobal?.params?.eurRate) nextEurRate = Number(configGlobal.params.eurRate) || nextEurRate;
      }
      if (tcRes.ok) {
        const tcData = await tcRes.json();
        if (tcData.success && tcData.rates) {
          nextTc = Number(tcData.rates?.crc) || nextTc || DEFAULT_CRC_PER_USD;
          nextEurRate = Number(tcData.rates?.eur) || nextEurRate || DEFAULT_EUR_PER_USD;
        }
      }

      let nextDraftDefaults = {
        ...buildDefaultParams({ tc: nextTc, empresaData: nextEmpresa }),
        eurRate: nextEurRate,
      };
      if (configGlobal?.params) {
          const normalizedConfigParams = normalizeStoredParams(configGlobal.params, { fallbackTc: nextTc, empresaData: nextEmpresa });
          const { km: _km, ...restParams } = normalizedConfigParams;
          nextDraftDefaults = {
            ...nextDraftDefaults,
            ...restParams,
            tc: nextTc,
            eurRate: nextEurRate,
          };
      }
      if (fRes.ok) {
        const fData = await fRes.json();
        if (fData.success) setFuelPrices(fData.prices);
      }
      if (qRes.ok) {
        const qData = await qRes.json();
        setCotizacionesConfig(prev => ({
          monedaBase: BASE_CURRENCY,
          monedaDefault: qData?.monedaDefault || prev.monedaDefault || BASE_CURRENCY,
          transfers: normalizeTransferCatalog(qData?.transfers, nextTc || DEFAULT_CRC_PER_USD),
        }));
        nextDraftDefaults = {
          ...nextDraftDefaults,
          colaborador: Number(qData?.colaborador ?? nextDraftDefaults.colaborador) || 0,
          peajes: Number(qData?.peajes ?? nextDraftDefaults.peajes) || 0,
          carga: Number(qData?.carga ?? nextDraftDefaults.carga) || 0,
          viaticos: Number(qData?.viaticos ?? nextDraftDefaults.viaticos) || 0,
          ferry: Number(qData?.ferry ?? nextDraftDefaults.ferry) || 0,
          utilidadPct: Number(qData?.utilidadPct ?? nextDraftDefaults.utilidadPct) || 0,
          iva: Number(qData?.iva ?? nextDraftDefaults.iva) || 0,
        };
      }
      if (apiRes.ok) {
        const apiData = await apiRes.json().catch(() => ({}));
        const gmapsKey = apiData?.googleMapsApiKey || '';
        setGoogleMapsApiKey(gmapsKey);
        if (gmapsKey) localStorage.setItem('google_maps_api_key', gmapsKey);
      }
      setDraftDefaults(nextDraftDefaults);
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
    if (!units.length) {
      if (activeUnitId !== null) setActiveUnitId(null);
      return;
    }
    if (!activeUnitId || !units.some(unit => unit.id === activeUnitId)) {
      setActiveUnitId(units[0].id);
    }
  }, [activeUnitId, units]);

  useEffect(() => {
    setItineraryRows(sanitizeItineraryRows(activeUnit?.itineraryRows || []));
  }, [activeUnit]);

  const relevantServiceDates = useMemo(
    () => Array.from(new Set(
      units
        .map(unit => getUnitServiceDate(unit, socio.sFecha))
        .filter(Boolean)
    )),
    [socio.sFecha, units]
  );

  useEffect(() => {
    if (!token) return undefined;
    if (!relevantServiceDates.length) {
      setScheduledTasksByDate({});
      return undefined;
    }

    let cancelled = false;

    Promise.all(relevantServiceDates.map(async (date) => {
      try {
        const response = await fetch(`/api/tms/tareas?fecha=${encodeURIComponent(date)}`, { headers: authH });
        const payload = response.ok ? await response.json().catch(() => []) : [];
        return [date, Array.isArray(payload) ? payload : []];
      } catch (error) {
        console.error(`Error cargando tareas para ${date}:`, error);
        return [date, []];
      }
    }))
      .then(entries => {
        if (!cancelled) setScheduledTasksByDate(Object.fromEntries(entries));
      });

    return () => {
      cancelled = true;
    };
  }, [authH, relevantServiceDates, token]);

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
      const combustiblePorKm = calcFuelCostPerKm(unit.precioCombustibleLitro, unit.rendimiento);
      const costoCombustible = roundMoney(Number(unit.km || 0) * combustiblePorKm);
      const costoKm = costoCombustible;
      const subtotal =
        (unit.cobrarCombustible !== false ? costoKm : 0)
        + Number(unit.colaborador || 0)
        + (unit.cobrarPeajes !== false ? Number(unit.peajes || 0) : 0)
        + (unit.cobrarCarga !== false ? Number(unit.carga || 0) : 0)
        + (unit.cobrarFerry !== false ? Number(unit.ferry || 0) : 0);
      return { ...unit, combustiblePorKm, costoCombustible, costoKm, subtotal };
    });
    const baseUnits = unitBreakdown.reduce((acc, unit) => acc + unit.subtotal, 0);
    const adicionalDia = p.chkDia ? Number(p.adicCol || 0) + Number(p.adicViat || 0) : 0;
    const base = baseUnits + adicionalDia;
    const selectedTransfers = normalizeSelectedTransfers(p.selectedTransfers);
    const subtotalTransfersConfigurados = selectedTransfers.reduce((acc, item) => acc + (Number(item.costo) || 0), 0);
    const tarFijas =
      (p.diasGAM * p.tarifaGAM) + (p.diasSM * p.mediaTarifa) + subtotalTransfersConfigurados;

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
    const subtotalAntesDescuento = utilidadBase + utilidadAmt;
    const descuentoAmt = subtotalAntesDescuento * (Number(p.descuentoPct || 0) / 100);
    const subtotalAntesIVA = subtotalAntesDescuento - descuentoAmt;
    const ivaAmt = subtotalAntesIVA * (p.iva / 100);
    const total = subtotalAntesIVA + ivaAmt;

    setResData({
      unitBreakdown,
      costoKm: baseUnits,
      base,
      adicionalDia,
      selectedTransfers,
      subtotalOperativo,
      subtotalTransfer,
      subtotalExtras,
      tarFijas,
      hospedajeCalculado,
      viaticosDiarios,
      extras,
      utilidadAmt,
      descuentoAmt,
      subtotalBase: utilidadBase,
      subtotal: subtotalAntesIVA,
      ivaAmt,
      total,
      totalCRC: total,
    });
  }, [params, units]);

  const currentStatus = socio._estado || 'borrador';
  const selectedVehiculo = vehiculos.find(item => item.id === (activeUnit?.vehiculoId || units[0]?.vehiculoId || vehiculoActivo));
  const itineraryRowsView = useMemo(() => sanitizeItineraryRows(itineraryRows), [itineraryRows]);
  const itineraryRowsComplete = useMemo(() => {
    return sanitizeItineraryRows(itineraryRows).filter(row => itineraryRowComplete(row));
  }, [itineraryRows]);
  const operationRowsComplete = useMemo(() => (
    units.flatMap((unit, unitIndex) => sanitizeItineraryRows(unit.itineraryRows).filter(row => itineraryRowComplete(row)).map(row => ({
      ...row,
      __unitId: unit.id,
      __unitIndex: unitIndex,
      __unitPax: Number(unit.sPax || socio.sPax || 1),
    })))
  ), [socio.sPax, units]);
  const itineraryIsEvent = operationRowsComplete.length > 1;
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
    activeUnitTab,
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
    activeUnitTab,
    vehiculoActivo,
    voiceFeedback,
  ]);

  const restoreTabSnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      // Evita que un tab existente parpadee como "nueva" mientras llega su snapshot.
      return;
    }

    const fallbackTc = Number(snapshot.params?.tc) || draftDefaultsRef.current?.tc || DEFAULT_CRC_PER_USD;
    const fallbackEmpresaData = empresaDataRef.current || {};

    // Sanitize units data to prevent NaN errors
    const safeUnits = (snapshot.units || []).map(u => ({
      ...normalizeUnitMoney(u, fallbackTc),
      id: u.id || `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      km: Number(u.km) || 0,
      sPax: Number(u.sPax) || 1,
    }));

    // Sanitize params to avoid unparsed numeric values
    const safeParams = snapshot.params ? {
      ...normalizeStoredParams(snapshot.params, { fallbackTc, empresaData: fallbackEmpresaData }),
      adicCol: Number(snapshot.params.adicCol) || 0,
      adicViat: Number(snapshot.params.adicViat) || 0,
      hospedaje: Number(snapshot.params.hospedaje) || 0,
      noches: Number(snapshot.params.noches) || 0,
      persHosp: Number(snapshot.params.persHosp) || 0,
      persViat: Number(snapshot.params.persViat) || 0,
      hospedajeTotalManual: Number(snapshot.params.hospedajeTotalManual) || 0,
    } : { ...draftDefaultsRef.current };

    setSelectedId(snapshot.selectedId || null);
    setParams(safeParams);
    setSocio(snapshot.socio ? { ...newSocio(), ...snapshot.socio } : newSocio());
    setUnits(safeUnits.length ? safeUnits : [createProformaUnit({}, vehiculosRef.current, null, fuelPricesRef.current, safeParams.tc)]);
    setItineraryRows(sanitizeItineraryRows(snapshot.itineraryRows || []));
    setVehiculoActivo(snapshot.vehiculoActivo || (vehiculosRef.current[0]?.id || null));
    setActiveUnitId(snapshot.activeUnitId || (safeUnits.length ? safeUnits[0].id : null));
    setActiveUnitTab(snapshot.activeUnitTab || 'operacion');
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
  }, []);

  useEffect(() => {
    if (!isExternalDetailMode || !initialSnapshot) return;
    if (hydratedExternalDetailRef.current === detailTabId) return;
    restoreTabSnapshot(initialSnapshot);
    hydratedExternalDetailRef.current = detailTabId;
  }, [detailTabId, initialSnapshot, isExternalDetailMode, restoreTabSnapshot]);

  const payloadSignature = useMemo(() => JSON.stringify({
    numero: socio.cfNumero,
    cliente_nombre: socio.sNombre,
    cliente_empresa: socio.sEmpresa,
    total_usd: resData.total,
    data_json: {
      params,
      socio,
      units,
      itineraryRows,
      vehiculoId: units[0]?.vehiculoId || vehiculoActivo,
      estado: currentStatus,
      financialSummary: {
        currency: displayCurrency,
        totalCrc: resData.total,
        totalDisplay: convertCrcToDisplay(resData.total, displayCurrency, moneyExchange),
      },
    },
  }), [currentStatus, displayCurrency, itineraryRows, moneyExchange, params, resData.total, socio, units, vehiculoActivo]);

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
      data_json: {
        params: { ...params, moneySchema: MONEY_SCHEMA_VERSION },
        socio: { ...socio, _estado: estado },
        units: units.map(unit => ({ ...unit, moneySchema: MONEY_SCHEMA_VERSION })),
        itineraryRows,
        vehiculoId: units[0]?.vehiculoId || vehiculoActivo,
        estado,
        financialSummary: {
          currency: displayCurrency,
          totalCrc: resData.total,
          totalDisplay: convertCrcToDisplay(resData.total, displayCurrency, moneyExchange),
        },
      },
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

      const resolvedNumero = data.numero || numeroFinal;
      const resolvedId = data.id || selectedId;
      const nextTabId = isExternalDetailMode ? activeTabId : (resolvedId ? `proforma-${resolvedId}` : activeTabId);
      const nextSocio = { ...socio, cfNumero: resolvedNumero, _estado: estado };
      const nextSnapshot = {
        selectedId: resolvedId || null,
        params: { ...params },
        socio: nextSocio,
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
        autoSaveEnabled: true,
        distanceStatus,
        savedMsg: 'Guardado ✓',
        operationMsg,
      };

      setSocio(nextSocio);
      setSelectedId(resolvedId || null);
      setAutoSaveEnabled(true);
      onTabMetaChange?.({
        label: resolvedNumero || 'Nueva proforma',
        sourceId: resolvedId || null,
        snapshot: nextSnapshot,
      });
      if (activeTabId !== 'lista' && !isExternalDetailMode) {
        setTabs(prev => prev.map(tab => (
          tab.id === activeTabId
            ? {
                ...tab,
                id: nextTabId,
                type: resolvedId ? 'proforma' : tab.type,
                sourceId: resolvedId || tab.sourceId,
                label: resolvedNumero || tab.label || 'Nueva proforma',
              }
            : tab
        )));
        setTabsData(prev => {
          const next = { ...prev, [nextTabId]: nextSnapshot };
          if (nextTabId !== activeTabId) {
            delete next[activeTabId];
          }
          return next;
        });
        if (nextTabId !== activeTabId) {
          setActiveTabId(nextTabId);
        }
      }
      lastSavedSignature.current = JSON.stringify({
        ...payload,
        numero: resolvedNumero,
        data_json: { ...payload.data_json, socio: nextSocio, estado },
      });
      setSavedMsg('Guardado ✓');
      setTimeout(() => setSavedMsg(''), 1800);
      // Solo refrescamos el historial, no params — para no pisar km ni otros campos
      const hRes = await fetch('/api/tms/proformas', { headers: authH });
      if (hRes.ok) setHistorial(await hRes.json());
      return { numero: resolvedNumero, id: resolvedId, estado };
    } catch (error) {
      console.error('Error guardando proforma:', error);
      setSavedMsg('Error al guardar');
      setTimeout(() => setSavedMsg(''), 2500);
      throw error;
    } finally {
      savingRef.current = false;
    }
  }, [
    activeTabId,
    activeUnitId,
    authH,
    clienteFromBD,
    distanceStatus,
    itineraryRows,
    displayCurrency,
    mapPickerField,
    moneyExchange,
    openSection,
    operationMsg,
    params,
    resData.total,
    selectedId,
    showSocioSuggestions,
    showStatusMenu,
    socio,
    socioSearch,
    units,
    vehiculoActivo,
    voiceFeedback,
    onTabMetaChange,
  ]);

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
    if (isExternalDetailMode) return;
    if (activeTabId === 'lista') return;
    if (isHydratingTabRef.current) return;
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
    if (!isExternalDetailMode || !onSnapshotChange) return;
    onSnapshotChange(buildCurrentTabSnapshot());
  }, [activeTabId, autoSaveEnabled, buildCurrentTabSnapshot, clienteFromBD, distanceStatus, isExternalDetailMode, mapPickerField, onSnapshotChange, openSection, operationMsg, params, savedMsg, selectedId, showSocioSuggestions, showStatusMenu, socio, socioSearch, units, activeUnitId, vehiculoActivo, voiceFeedback, itineraryRows]);

  useEffect(() => {
    clearTimeout(autosaveTimer.current);

    if (activeTabId === 'lista') {
      pendingRestoreTabIdRef.current = 'lista';
      setSelectedId(null);
      setOpenSection('');
      setShowStatusMenu(false);
      setMapPickerField('');
      setVoiceFeedback(null);
      setAutoSaveEnabled(false);
      setSavedMsg('');
      return;
    }

    if (pendingRestoreTabIdRef.current !== activeTabId) return;
    const snapshot = tabsData[activeTabId];
    if (!snapshot) return;

    isHydratingTabRef.current = true;
    restoreTabSnapshot(snapshot);
    queueMicrotask(() => {
      isHydratingTabRef.current = false;
      pendingRestoreTabIdRef.current = '';
    });
  }, [activeTabId, tabsData, restoreTabSnapshot]);

  const toggleSection = (sectionId) => {
    setOpenSection(prev => (prev === sectionId ? '' : sectionId));
  };

  const upsertDetailTab = useCallback((tabConfig, snapshot, signature = '') => {
    if (onOpenProforma) {
      onOpenProforma(tabConfig, snapshot);
      lastSavedSignature.current = signature;
      return;
    }
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
    pendingRestoreTabIdRef.current = tabConfig.id;
    setActiveTabId(tabConfig.id);
  }, [onOpenProforma]);

  const closeTab = useCallback((tabId) => {
    if (isExternalDetailMode) return;
    if (tabId === 'lista') return;
    clearTimeout(autosaveTimer.current);
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    setTabsData(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setActiveTabId(prev => (prev === tabId ? 'lista' : prev));
  }, [isExternalDetailMode]);

  const applyVoiceDraft = useCallback((draft) => {
    if (!draft?.id) return;

    const data = draft.quoteData || {};
    const nextPax = Number(data.sPax || data.pasajeros || 1);
    const draftSocio = {
      ...newSocio(),
      cfMoneda: data.cfMoneda || cotizacionesConfig.monedaDefault || BASE_CURRENCY,
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
      ...createDraftParams(),
      ...(typeof data.km === 'number' ? { km: data.km } : {}),
      ...(typeof data.noches === 'number' ? { noches: data.noches } : {}),
      ...(typeof data.persViat === 'number' ? { persViat: data.persViat } : {}),
      ...(typeof data.persHosp === 'number' ? { persHosp: data.persHosp } : {}),
      ...(typeof data.hospedajeTotalManual === 'number' ? { hospedajeTotalManual: data.hospedajeTotalManual } : {}),
      ...(typeof data.ferry === 'number' ? { ferry: data.ferry } : {}),
      ...(typeof data.carga === 'number' ? { carga: data.carga } : {}),
      ...(typeof data.ckTinSJ === 'boolean' ? { ckTinSJ: data.ckTinSJ } : {}),
      ...(typeof data.ckToutSJ === 'boolean' ? { ckToutSJ: data.ckToutSJ } : {}),
      ...(typeof data.ckTinCTG === 'boolean' ? { ckTinCTG: data.ckTinCTG } : {}),
      ...(typeof data.ckToutCTG === 'boolean' ? { ckToutCTG: data.ckToutCTG } : {}),
      ...(typeof data.peajes === 'number' ? { peajes: data.peajes } : {}),
      ...(typeof data.colaborador === 'number' ? { colaborador: data.colaborador } : {}),
      ...(typeof data.combustible === 'number' ? { combustible: data.combustible } : {}),
      ...(typeof data.precioCombustibleLitro === 'number' ? { precioCombustibleLitro: data.precioCombustibleLitro } : {}),
      ...(typeof data.rendimiento === 'number' ? { rendimiento: data.rendimiento } : {}),
      ...(typeof data.viaticos === 'number' ? { viaticos: data.viaticos } : {}),
      ...(typeof data.utilidadPct === 'number' ? { utilidadPct: data.utilidadPct } : {}),
      ...(typeof data.porcentajeUtilidad === 'number' ? { utilidadPct: data.porcentajeUtilidad } : {}),
      ...(typeof data.utilidad === 'number' ? { utilidadPct: data.utilidad } : {}),
      ...(data.tipoCombustible ? { tipoCombustible: data.tipoCombustible } : {}),
      ...(typeof data.tc === 'number' ? { tc: data.tc } : {}),
      ...(typeof data.eurRate === 'number' ? { eurRate: data.eurRate } : {}),
      ...(data.tipoVehiculo ? { tipoVehiculo: data.tipoVehiculo } : {}),
      selectedTransfers: Array.isArray(data.selectedTransfers) && data.selectedTransfers.length > 0
        ? normalizeSelectedTransfers(data.selectedTransfers)
        : legacyFlagsToSelectedTransfers(data, data.tc || draftDefaults.tc || DEFAULT_CRC_PER_USD),
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
          precioCombustibleLitro: nextParams.precioCombustibleLitro,
          rendimiento: nextParams.rendimiento,
          tipoCombustible: nextParams.tipoCombustible,
          colaborador: nextParams.colaborador,
          peajes: nextParams.peajes,
          carga: nextParams.carga,
          ferry: nextParams.ferry,
        }, vehiculos, null, fuelPrices, nextParams.tc || draftDefaults.tc, { allowSuggestedVehicle: false })],
        itineraryRows: [],
        activeUnitTab: 'operacion',
        vehiculoActivo: null,
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
  }, [cotizacionesConfig.monedaDefault, createDraftParams, draftDefaults.tc, onVoiceDraftApplied, upsertDetailTab, vehiculoActivo, vehiculos, fuelPrices]);

  const handleNuevaProforma = () => {
    const nextSocio = { ...newSocio(), cfMoneda: cotizacionesConfig.monedaDefault || BASE_CURRENCY };
    const tabId = `new-${Date.now()}`;
    upsertDetailTab(
      { id: tabId, type: 'new', label: '' },
      {
        selectedId: null,
        params: createDraftParams(),
        socio: nextSocio,
        units: [createProformaUnit({
          moneySchema: MONEY_SCHEMA_VERSION,
          combustible: draftDefaults.combustible,
          precioCombustibleLitro: draftDefaults.precioCombustibleLitro,
          rendimiento: draftDefaults.rendimiento,
          tipoCombustible: draftDefaults.tipoCombustible,
          colaborador: draftDefaults.colaborador,
          peajes: draftDefaults.peajes,
          carga: draftDefaults.carga,
          viaticos: draftDefaults.viaticos,
          utilidad: draftDefaults.utilidad,
          ferry: draftDefaults.ferry,
        }, vehiculos, null, fuelPrices, draftDefaults.tc, { allowSuggestedVehicle: false })],
        itineraryRows: [],
        activeUnitTab: 'operacion',
        vehiculoActivo: null,
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
      fuelPrices,
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
        params: normalizeStoredParams(paramsData, { fallbackTc: draftDefaults.tc, empresaData }),
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
      const numericFields = ['sPax', 'km', 'combustible', 'precioCombustibleLitro', 'rendimiento', 'colaborador', 'peajes', 'carga', 'ferry'];
      const next = {
        ...unit,
        [field]: numericFields.includes(field) ? Number(value) || 0 : value,
      };
      if (field === 'sOrigen') next.sOrigenCoords = null;
      if (field === 'sDestino') next.sDestinoCoords = null;
      return applyFuelMetrics(next);
    }));
    setAutoSaveEnabled(true);
  };

  const assignVehicleToUnit = (unitId, vehiculoId) => {
    const vehiculo = vehiculos.find(item => item.id === vehiculoId);
    const vehiculoLabel = formatVehicleLabel(vehiculo);
    setUnits(prev => prev.map(unit => (
      unit.id !== unitId
        ? unit
        : (() => {
            const vehiculoDefaults = vehiculo ? buildVehicleDefaults(vehiculo, fuelPrices, params.tc, {
              colaborador: unit.colaborador ?? draftDefaults.colaborador,
              peajes: unit.peajes ?? draftDefaults.peajes,
              carga: unit.carga ?? draftDefaults.carga,
              ferry: unit.ferry ?? draftDefaults.ferry,
              viaticos: unit.viaticos ?? draftDefaults.viaticos,
              rendimiento: unit.rendimiento,
              precioCombustibleLitro: unit.precioCombustibleLitro,
              utilidad: params.utilidad,
            }) : {};

            return applyFuelMetrics({
              ...unit,
              ...vehiculoDefaults,
              combustible: preferPositiveNumber(vehiculoDefaults.combustible, unit.combustible ?? draftDefaults.combustible),
              precioCombustibleLitro: preferPositiveNumber(vehiculoDefaults.precioCombustibleLitro, unit.precioCombustibleLitro ?? draftDefaults.precioCombustibleLitro),
              rendimiento: preferPositiveNumber(vehiculoDefaults.rendimiento, unit.rendimiento ?? draftDefaults.rendimiento),
              tipoCombustible: vehiculoDefaults.tipoCombustible || unit.tipoCombustible || draftDefaults.tipoCombustible || 'Diésel',
              colaborador: preferPositiveNumber(vehiculoDefaults.colaborador, unit.colaborador ?? draftDefaults.colaborador),
              peajes: preferPositiveNumber(vehiculoDefaults.peajes, unit.peajes ?? draftDefaults.peajes),
              carga: preferPositiveNumber(vehiculoDefaults.carga, unit.carga ?? draftDefaults.carga),
              viaticos: preferPositiveNumber(vehiculoDefaults.viaticos, unit.viaticos ?? draftDefaults.viaticos),
              utilidad: preferPositiveNumber(vehiculoDefaults.utilidad, unit.utilidad ?? draftDefaults.utilidad),
              ferry: preferPositiveNumber(vehiculoDefaults.ferry, unit.ferry ?? draftDefaults.ferry),
              vehiculoId,
              itineraryRows: sanitizeItineraryRows(unit.itineraryRows || []).map(row => ({
                ...row,
                vehiculoId,
                vehiculoLabel,
              })),
            });
          })()
    )));
    setAutoSaveEnabled(true);
  };

  const refreshUnitOperationalDefaults = (unitId) => {
    setUnits(prev => prev.map(unit => {
      if (unit.id !== unitId) return unit;
      const vehiculo = vehiculos.find(item => item.id === unit.vehiculoId);
      const vehiculoDefaults = vehiculo ? buildVehicleDefaults(vehiculo, fuelPrices, params.tc, {
        colaborador: draftDefaults.colaborador,
        peajes: draftDefaults.peajes,
        carga: draftDefaults.carga,
        ferry: draftDefaults.ferry,
        viaticos: draftDefaults.viaticos,
        rendimiento: unit.rendimiento,
        precioCombustibleLitro: unit.precioCombustibleLitro,
        utilidad: params.utilidad,
      }) : {};
      return applyFuelMetrics({
        ...unit,
        ...vehiculoDefaults,
        combustible: preferPositiveNumber(vehiculoDefaults.combustible, draftDefaults.combustible ?? unit.combustible),
        precioCombustibleLitro: preferPositiveNumber(vehiculoDefaults.precioCombustibleLitro, draftDefaults.precioCombustibleLitro ?? unit.precioCombustibleLitro),
        rendimiento: preferPositiveNumber(vehiculoDefaults.rendimiento, draftDefaults.rendimiento ?? unit.rendimiento),
        tipoCombustible: vehiculoDefaults.tipoCombustible || draftDefaults.tipoCombustible || unit.tipoCombustible || 'Diésel',
        colaborador: preferPositiveNumber(vehiculoDefaults.colaborador, draftDefaults.colaborador ?? unit.colaborador),
        peajes: preferPositiveNumber(vehiculoDefaults.peajes, draftDefaults.peajes ?? unit.peajes),
        carga: preferPositiveNumber(vehiculoDefaults.carga, draftDefaults.carga ?? unit.carga),
        viaticos: preferPositiveNumber(vehiculoDefaults.viaticos, draftDefaults.viaticos ?? unit.viaticos),
        utilidad: preferPositiveNumber(vehiculoDefaults.utilidad, draftDefaults.utilidad ?? unit.utilidad),
        ferry: preferPositiveNumber(vehiculoDefaults.ferry, draftDefaults.ferry ?? unit.ferry),
      });
    }));
    setParams(prev => ({
      ...prev,
      combustible: Number(draftDefaults.combustible ?? prev.combustible) || 0,
      precioCombustibleLitro: Number(draftDefaults.precioCombustibleLitro ?? prev.precioCombustibleLitro) || 0,
      rendimiento: Number(draftDefaults.rendimiento ?? prev.rendimiento) || 0,
      tipoCombustible: draftDefaults.tipoCombustible || prev.tipoCombustible || 'Diésel',
      colaborador: Number(draftDefaults.colaborador ?? prev.colaborador) || 0,
      peajes: Number(draftDefaults.peajes ?? prev.peajes) || 0,
      carga: Number(draftDefaults.carga ?? prev.carga) || 0,
      viaticos: Number(draftDefaults.viaticos ?? prev.viaticos) || 0,
      ferry: Number(draftDefaults.ferry ?? prev.ferry) || 0,
      utilidadPct: Number(draftDefaults.utilidadPct ?? prev.utilidadPct) || 0,
      iva: Number(draftDefaults.iva ?? prev.iva) || 0,
    }));
    setAutoSaveEnabled(true);
  };

  const syncUnitFromItineraryRows = useCallback((unit, nextRows) => {
    const rows = sanitizeItineraryRows(nextRows);
    const firstRow = rows[0] || null;
    const lastRow = rows[rows.length - 1] || null;
    const totalKm = Math.round(sumItineraryDistanceKm(rows));
    const next = {
      ...unit,
      itineraryRows: rows,
    };
    if (firstRow) {
      next.sFecha = firstRow.fecha || '';
      next.sHora = firstRow.hora || '';
      next.sOrigen = firstRow.origen || '';
      next.sDestino = lastRow?.destino || firstRow.destino || '';
    } else {
      next.sFecha = '';
      next.sHora = '';
      next.sOrigen = '';
      next.sDestino = '';
    }
    if (rows.some(row => String(row.recorrido || '').trim())) {
      next.km = totalKm;
    } else if (!rows.length) {
      next.km = 0;
    }
    return applyFuelMetrics(next);
  }, []);

  const updateActiveUnitItineraryRows = (updater) => {
    const currentRows = sanitizeItineraryRows(activeUnit?.itineraryRows || []);
    const nextRows = sanitizeItineraryRows(typeof updater === 'function' ? updater(currentRows) : updater);
    if (!activeUnit?.id) {
      setItineraryRows(nextRows);
      setAutoSaveEnabled(true);
      return;
    }
    setUnits(prev => prev.map(unit => (
      unit.id === activeUnit.id
        ? syncUnitFromItineraryRows(unit, nextRows)
        : unit
    )));
    setItineraryRows(nextRows);
    setAutoSaveEnabled(true);
  };

  const addUnit = () => {
    const sourceUnit = activeUnit || units[units.length - 1] || {};
    const nextUnit = createUnitDraftFromSource(sourceUnit, vehiculos, fuelPrices, params.tc);
    setUnits(prev => [...prev, nextUnit]);
    setActiveUnitId(nextUnit.id);
    setActiveUnitTab('operacion');
    setAutoSaveEnabled(true);
  };

  const toggleTransfer = (transfer) => {
    setParams(prev => {
      const current = normalizeSelectedTransfers(prev.selectedTransfers);
      const exists = current.some(item => item.id === transfer.id);
      return {
        ...prev,
        selectedTransfers: exists
          ? current.filter(item => item.id !== transfer.id)
          : [...current, { id: transfer.id, descripcion: transfer.descripcion, costo: roundMoney(Number(transfer.costo) || 0) }],
      };
    });
    setAutoSaveEnabled(true);
  };

  const addItineraryRow = () => {
    updateActiveUnitItineraryRows(prev => [...prev, createItineraryRow({
      vehiculoId: activeUnit?.vehiculoId || null,
      vehiculoLabel: formatVehicleLabel(selectedVehiculo),
    })]);
  };

  const clearActiveUnitItinerary = () => {
    if (!activeUnit?.id) return;
    setUnits(prev => prev.map(unit => (
      unit.id === activeUnit.id
        ? syncUnitFromItineraryRows({ ...unit, itinerary: null }, [])
        : unit
    )));
    setItineraryRows([]);
    setAutoSaveEnabled(true);
  };

  const updateItineraryRow = (rowId, field, value) => {
    updateActiveUnitItineraryRows(prev => prev.map(row => (
      row.id === rowId
        ? { ...row, [field]: field === 'hora' ? (normalizeTimeInput(value) || '') : value }
        : row
    )));
  };

  const removeItineraryRow = (rowId) => {
    updateActiveUnitItineraryRows(prev => prev.filter(row => row.id !== rowId));
  };

  const createOperationFromProforma = async () => {
    const rows = operationRowsComplete;
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
    const pax = units.reduce((sum, unit) => sum + (Number(unit.sPax) || 0), 0) || Number(activeUnit?.sPax || units[0]?.sPax || socio.sPax || 1);

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

        let firstTask = null;
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const createdTask = await onCreateTarea?.({
            nombre: `U${(row.__unitIndex || 0) + 1} · Tramo ${index + 1} · ${row.origen} → ${row.destino}`,
            hora: row.hora,
            fin: addOneHour(row.hora),
            eventoId,
            condId: null,
            vehId: null,
            pax: row.__unitPax || pax,
            origen: row.origen,
            destino: row.destino,
            fecha: row.fecha,
          }, { navigate: false });
          if (!createdTask?.id) throw new Error(`No se pudo crear el tramo ${index + 1}.`);
          if (!firstTask) firstTask = createdTask;
        }

        onFocusTask?.(firstTask);
        setOperationMsg(`Evento creado con ${rows.length} tramos.`);
      } else {
        const row = rows[0];
        const createdTask = await onCreateTarea?.({
          nombre: `${baseName} · U${(row.__unitIndex || 0) + 1} · ${row.origen} → ${row.destino}`,
          hora: row.hora,
          fin: addOneHour(row.hora),
          eventoId: null,
          condId: null,
          vehId: null,
          pax: row.__unitPax || pax,
          origen: row.origen,
          destino: row.destino,
          fecha: row.fecha,
        }, { navigate: false });
        if (!createdTask?.id) throw new Error('No se pudo crear la tarea.');
        onFocusTask?.(createdTask);
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
    setShowSocioSuggestions(Boolean(value.trim()));
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
    if (!q) return [];
    return sociosBD.filter(item =>
      [item.nombre, item.codigoCliente, item.empresa].filter(Boolean).some(text => text.toLowerCase().includes(q))
    );
  }, [socioSearch, sociosBD]);

  const shouldShowSocioSuggestions = showSocioSuggestions && socioSearch.trim().length > 0;
  const visibleSocios = useMemo(() => sociosFiltrados.slice(0, 4), [sociosFiltrados]);

  useEffect(() => {
    if (!shouldShowSocioSuggestions) {
      setSocioDropdownStyle(null);
      return undefined;
    }

    const updateDropdownPosition = () => {
      const node = clienteSearchWrapperRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setSocioDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [shouldShowSocioSuggestions, socioSearch, activeTabId]);

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
    ...(resData.selectedTransfers || []).map(item => item.descripcion),
    resData.subtotalTransfer > 0 ? `Subtotal ${formatMoney(resData.subtotalTransfer, displayCurrency, moneyExchange)}` : '',
  ].filter(Boolean).join(' | ') || 'Sin tarifas transfer';

  const extrasResumen = [
    params.noches > 0 ? `${params.noches} noches` : 'Sin noches',
    params.hospedajeTotalManual > 0
      ? `Hospedaje total ${formatMoney(params.hospedajeTotalManual, displayCurrency, moneyExchange)}`
      : params.hospedaje ? `Hospedaje ${formatMoney(params.hospedaje, displayCurrency, moneyExchange)}/noche` : '',
    params.persHosp ? `${params.persHosp} personas con hospedaje` : '',
    params.persViat ? `${params.persViat} con viaticos` : '',
    params.viatDiario ? `Viatico diario ${formatMoney(params.viatDiario, displayCurrency, moneyExchange)}` : '',
    resData.subtotalExtras > 0 ? `Subtotal ${formatMoney(resData.subtotalExtras, displayCurrency, moneyExchange)}` : '',
  ].filter(Boolean).join(' | ');

  useEffect(() => {
    onHeaderMetaChange?.({ tc: params.tc, moneda: displayCurrency });
  }, [displayCurrency, onHeaderMetaChange, params.tc]);

  const socioSuggestionsDropdown = shouldShowSocioSuggestions && socioDropdownStyle
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: socioDropdownStyle.top,
            left: socioDropdownStyle.left,
            width: socioDropdownStyle.width,
            zIndex: 1000,
            background: T.card,
            border: `1px solid ${T.bdr}`,
            borderRadius: 12,
            boxShadow: '0 18px 32px rgba(0,0,0,0.18)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {loadingSocios ? (
            <div style={{ color: T.mute, fontSize: 12, padding: 10 }}>Cargando socios...</div>
          ) : visibleSocios.map(item => {
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
          {!loadingSocios && visibleSocios.length === 0 && (
            <div style={{ color: T.mute, fontSize: 12, padding: 10 }}>No hay coincidencias.</div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: isDetailTab ? 'nowrap' : 'wrap', width: '100%', overflowX: 'hidden' }}>
      <div style={{ flex: isDetailTab ? '0 0 700px' : '1 1 0', width: isDetailTab ? 700 : 'auto', minWidth: isDetailTab ? 700 : 0, maxWidth: isDetailTab ? 700 : 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isListTab && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 24 }}>
             <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
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
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.AMB }}>
                    {formatMoney(
                      item.data_json?.financialSummary?.totalCrc ?? item.total_usd,
                      item.data_json?.financialSummary?.currency || item.data_json?.socio?.cfMoneda || BASE_CURRENCY,
                      {
                        tc: item.data_json?.params?.tc || params.tc,
                        eurRate: item.data_json?.params?.eurRate || params.eurRate,
                      }
                    )}
                  </div>
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
                    <div ref={clienteSearchWrapperRef} style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 10, padding: '0 12px' }}>
                        <Search size={14} color={T.mute} />
                        <input
                          value={socioSearch || socio.sNombre || ''}
                          onChange={e => handleClienteNombreChange(e.target.value)}
                          onFocus={() => setShowSocioSuggestions(Boolean((socioSearch || socio.sNombre || '').trim()))}
                          onBlur={() => setTimeout(() => setShowSocioSuggestions(false), 200)}
                          autoComplete="off"
                          placeholder="Nombre, empresa o ID del cliente..."
                          style={{ ...inputStyle, padding: '11px 0', border: 'none', background: 'transparent' }}
                        />
                      </div>
                    </div>
                  </Field>
                  <Field label="ID cliente" style={{ gridColumn: 'span 4' }}>
                    <input name="sCodigoCliente" value={socio.sCodigoCliente} onChange={sChange} onBlur={handleGuardar} autoComplete="off" style={inputStyle} placeholder="Codigo" />
                  </Field>
                  <Field label="Contacto" style={{ gridColumn: 'span 4' }}>
                    <input name="sContacto" value={socio.sContacto} onChange={sChange} onBlur={handleGuardar} autoComplete="off" style={inputStyle} placeholder="Persona de contacto" />
                  </Field>
                  <Field label="Cargo" style={{ gridColumn: 'span 4' }}>
                    <input name="sCargo" value={socio.sCargo} onChange={sChange} onBlur={handleGuardar} autoComplete="off" style={inputStyle} placeholder="Cargo" />
                  </Field>
                  <Field label="Telefono" style={{ gridColumn: 'span 4' }}>
                    <input name="sTel" value={socio.sTel} onChange={sChange} onBlur={handleGuardar} autoComplete="off" style={inputStyle} placeholder="Telefono" />
                  </Field>
                  <Field label="Correo" style={{ gridColumn: 'span 6' }}>
                    <input name="sEmail" value={socio.sEmail} onChange={sChange} onBlur={handleGuardar} autoComplete="off" style={inputStyle} placeholder="Correo electronico" />
                  </Field>
                  <Field label="Direccion" style={{ gridColumn: 'span 6' }}>
                    <input name="sDireccion" value={socio.sDireccion} onChange={sChange} onBlur={handleGuardar} autoComplete="off" style={inputStyle} placeholder="Direccion" />
                  </Field>
                </div>
              </AccordionSection>

              <AccordionSection
                id="costos"
                label="Costos operativos"
                summary={costosResumen}
                open={openSection === 'costos'}
                onToggle={toggleSection}
                actions={<div style={{ padding: '6px 10px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>{formatMoney(resData.subtotalOperativo, displayCurrency, moneyExchange)}</div>}
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
                      const activeUnitFuelCostPerKm = calcFuelCostPerKm(activeUnit.precioCombustibleLitro, activeUnit.rendimiento);
                      const activeUnitFuelTotal = roundMoney((Number(activeUnit.km || 0) || 0) * activeUnitFuelCostPerKm);
                      const activeIndex = units.findIndex(unit => unit.id === activeUnit.id);
                      const requiredPax = Number(socio.sPax || 0);
                      const unitCapacity = Number(vehiculo?.cap || 0);
                      const totalAssignedCapacity = units.reduce((sum, unit) => {
                        const currentVehicle = vehiculos.find(item => item.id === unit.vehiculoId);
                        return sum + (Number(currentVehicle?.cap || 0) || 0);
                      }, 0);
                      const remainingPax = Math.max(requiredPax - totalAssignedCapacity, 0);
                      const serviceDate = getUnitServiceDate(activeUnit, socio.sFecha);
                      const occupiedTasks = serviceDate ? (scheduledTasksByDate[serviceDate] || []) : [];
                      const occupiedVehicleIds = new Set(occupiedTasks.map(getTaskVehicleId).filter(Boolean));
                      const selectedVehicleIds = new Set(
                        units
                          .filter(unit => unit.id !== activeUnit.id)
                          .map(unit => unit.vehiculoId)
                          .filter(Boolean)
                      );
                      const availableVehicles = vehiculos
                        .filter(item => item.estado !== 'fuera_de_servicio')
                        .filter(item => (
                          item.id === activeUnit.vehiculoId
                          || (!selectedVehicleIds.has(item.id) && !occupiedVehicleIds.has(item.id))
                        ));
                      const activeVehicleDuplicated = Boolean(activeUnit.vehiculoId && selectedVehicleIds.has(activeUnit.vehiculoId));
                      const activeVehicleOccupied = Boolean(activeUnit.vehiculoId && occupiedVehicleIds.has(activeUnit.vehiculoId));
                      const unitSubtotal =
                        activeUnitFuelTotal
                        + Number(activeUnit.colaborador || 0)
                        + (activeUnit.cobrarPeajes !== false ? Number(activeUnit.peajes || 0) : 0)
                        + (activeUnit.cobrarCarga !== false ? Number(activeUnit.carga || 0) : 0)
                        + (activeUnit.cobrarFerry !== false ? Number(activeUnit.ferry || 0) : 0);
                      const itinerarySummary = summarizeItineraryRows(activeUnit.itineraryRows || []) || (activeUnit.itinerary ? summarizeItinerary(activeUnit.itinerary) : null);

                      return (
                        <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 14 }}>
                          {itinerarySummary && (
                            <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: T.grnDim, border: `1px solid ${T.GRN}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Map size={16} color={T.GRN} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: T.GRN }}>{itinerarySummary.stops} paradas</span>
                              </div>
                              <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                                <span style={{ color: T.GRN }}>{itinerarySummary.distance}</span>
                                <span style={{ color: T.GRN }}>{itinerarySummary.duration}</span>
                                {itinerarySummary.days > 1 && <span style={{ color: T.GRN }}>{itinerarySummary.days} d&iacute;as</span>}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
                            <div>
                              <div style={{ height: 110, borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.bdr}`, background: T.card2 }}>
                                {vehiculo?.foto_url ? <img src={vehiculo.foto_url} alt={vehiculo?.placa || `Unidad ${activeIndex + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mute, fontSize: 12 }}>Sin imagen</div>}
                              </div>
                            </div>
                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: 11, color: T.mute }}>Unidad {activeIndex + 1}</div>
                                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: T.txt }}>{vehiculo?.placa || 'Sin unidad asignada'}</div>
                                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: T.sub }}>
                                    {unitCapacity ? `${unitCapacity} pax disponibles` : 'Sin capacidad definida'}
                                  </div>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 4, borderRadius: 999, background: T.card2, border: `1px solid ${T.bdr}` }}>
                                  {UNIT_PANEL_TABS.map(tab => {
                                    const isCurrentTab = activeUnitTab === tab.id;
                                    return (
                                      <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveUnitTab(tab.id)}
                                        style={{
                                          border: 'none',
                                          borderRadius: 999,
                                          padding: '8px 12px',
                                          background: isCurrentTab ? T.ambDim : 'transparent',
                                          color: isCurrentTab ? T.AMB : T.sub,
                                          fontSize: 12,
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {tab.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                              {activeUnitTab === 'itinerario' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: itineraryRowsView.length > 3 ? 520 : 'none', overflowY: itineraryRowsView.length > 3 ? 'auto' : 'visible', paddingRight: itineraryRowsView.length > 3 ? 4 : 0 }}>
                                    {itineraryRowsView.map((row, index) => (
                                      <div key={row.id} style={{ padding: 12, borderRadius: 12, background: T.card2, border: `1px solid ${T.bdr}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                                          <div style={{ fontSize: 11, fontWeight: 800, color: index === 0 ? T.AMB : T.sub, letterSpacing: 0.3 }}>TRAMO {index + 1}</div>
                                          <button type="button" onClick={() => removeItineraryRow(row.id)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.RED}33`, background: T.redDim, color: T.RED, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Quitar</button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 12 }}>
                                          <Field label="Origen" style={{ gridColumn: 'span 6' }}><input value={row.origen} onChange={e => updateItineraryRow(row.id, 'origen', e.target.value)} onBlur={handleGuardar} style={inputStyle} placeholder="Origen" /></Field>
                                          <Field label="Destino" style={{ gridColumn: 'span 6' }}><input value={row.destino} onChange={e => updateItineraryRow(row.id, 'destino', e.target.value)} onBlur={handleGuardar} style={inputStyle} placeholder="Destino" /></Field>
                                          <Field label="Fecha" style={{ gridColumn: 'span 3' }}><input type="date" value={row.fecha} onChange={e => updateItineraryRow(row.id, 'fecha', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                                          <Field label="Hora" style={{ gridColumn: 'span 3' }}><input type="time" value={row.hora} onChange={e => updateItineraryRow(row.id, 'hora', e.target.value)} onBlur={handleGuardar} style={inputStyle} /></Field>
                                          <Field label="Recorrido" style={{ gridColumn: 'span 3' }}><input value={row.recorrido || ''} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} placeholder="0 km" /></Field>
                                          <Field label="Duración" style={{ gridColumn: 'span 3' }}><input value={row.tiempoEstimado || ''} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} placeholder="0 min" /></Field>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {!itineraryRowsView.length && (
                                    <div style={{ padding: 14, borderRadius: 12, background: T.card2, border: `1px dashed ${T.bdr}`, color: T.mute, fontSize: 13 }}>
                                      No hay tramos cargados. La nueva unidad copia por defecto el itinerario actual, y desde el mapa puedes volver a traerlo completo.
                                    </div>
                                  )}

                                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 40px', gap: 10, alignItems: 'stretch' }}>
                                    <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.bdr}`, background: T.card2 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, marginBottom: 6 }}>TOTAL KM</div>
                                      <div style={{ fontSize: 16, fontWeight: 800, color: T.txt }}>{formatDistance(sumItineraryDistanceKm(itineraryRowsView) * 1000)}</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.bdr}`, background: T.card2 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, marginBottom: 6 }}>TOTAL TIEMPO</div>
                                      <div style={{ fontSize: 16, fontWeight: 800, color: T.txt }}>{formatDuration(sumItineraryDurationSeconds(itineraryRowsView))}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <button
                                        type="button"
                                        title="Diseñar ruta"
                                        onClick={() => { setRouteDesignerUnitId(activeUnit.id); setShowRouteDesigner(true); }}
                                        style={{
                                          width: 40,
                                          height: 40,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: 10,
                                          border: `1px solid ${googleMapsApiKey ? T.AMB : T.bdr2}`,
                                          background: googleMapsApiKey ? T.ambDim : T.card2,
                                          color: googleMapsApiKey ? T.AMB : T.mute,
                                          cursor: googleMapsApiKey ? 'pointer' : 'not-allowed',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Map size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Limpiar itinerario"
                                        onClick={clearActiveUnitItinerary}
                                        style={{
                                          width: 40,
                                          height: 40,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: 10,
                                          border: `1px solid ${T.RED}33`,
                                          background: T.redDim,
                                          color: T.RED,
                                          cursor: 'pointer',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(240px,.85fr)', gap: 14, alignItems: 'start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 24 }}>
                                      <Field label="Unidad">
                                        <select value={activeUnit.vehiculoId || ''} onChange={e => assignVehicleToUnit(activeUnit.id, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                          <option value="">{availableVehicles.length ? 'Seleccionar unidad' : 'No hay unidades disponibles'}</option>
                                          {availableVehicles.map(item => (
                                            <option key={item.id} value={item.id}>{item.placa} · {item.marca} {item.modelo} · {item.cap} pax</option>
                                          ))}
                                        </select>
                                      </Field>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 10 }}>
                                        <Field label="PAX unidad" style={{ gridColumn: 'span 4' }}>
                                          <input value={unitCapacity || 0} readOnly style={{ ...inputStyle, color: T.sub, cursor: 'default' }} />
                                        </Field>
                                        <Field label="Kilómetros" style={{ gridColumn: 'span 4' }}>
                                          <input type="number" value={activeUnit.km || 0} onChange={e => updateUnit(activeUnit.id, 'km', e.target.value)} onBlur={handleGuardar} style={inputStyle} min="0" />
                                        </Field>
                                        <Field label="Rendimiento" style={{ gridColumn: 'span 4' }}>
                                          <div style={{ position: 'relative' }}>
                                            <input type="number" step="0.01" min="0" value={activeUnit.rendimiento || 0} onChange={e => updateUnit(activeUnit.id, 'rendimiento', e.target.value)} onBlur={handleGuardar} style={{ ...inputStyle, paddingRight: 42 }} />
                                            <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: T.mute, fontSize: 12, pointerEvents: 'none' }}>km/l</span>
                                          </div>
                                        </Field>
                                        <Field label={`Precio ${activeUnit.tipoCombustible || 'Diésel'} / litro`} style={{ gridColumn: 'span 6' }}>
                                          <MonetaryInput value={activeUnit.precioCombustibleLitro || 0} onChange={e => updateUnit(activeUnit.id, 'precioCombustibleLitro', e.target.value)} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} />
                                        </Field>
                                        <Field label="Faltan por cubrir" style={{ gridColumn: 'span 6' }}>
                                          <input value={`${remainingPax} pax`} readOnly style={{ ...inputStyle, color: remainingPax > 0 ? T.AMB : T.GRN, fontWeight: 700, cursor: 'default' }} />
                                        </Field>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minHeight: 34, marginTop: 2 }}>
                                        <button
                                          type="button"
                                          title="Recargar costos base desde configuración y unidad"
                                          onClick={() => refreshUnitOperationalDefaults(activeUnit.id)}
                                          style={{
                                            width: 34,
                                            height: 34,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 10,
                                            border: `1px solid ${T.AMB}33`,
                                            background: T.ambDim,
                                            color: T.AMB,
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                          }}
                                        >
                                          <RefreshCcw size={14} />
                                        </button>
                                      </div>

                                      {(activeVehicleDuplicated || activeVehicleOccupied || (!availableVehicles.length && !activeUnit.vehiculoId)) && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: `${T.RED}10`, border: `1px solid ${T.RED}22`, color: T.RED, fontSize: 12, lineHeight: 1.45 }}>
                                          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                          <span>
                                            {activeVehicleDuplicated
                                              ? 'Esta unidad ya está asignada en otra pestaña de la misma proforma.'
                                              : activeVehicleOccupied
                                                ? `La unidad seleccionada ya tiene operación programada para ${serviceDate}.`
                                                : `No hay unidades libres para ${serviceDate || 'la fecha seleccionada'}.`}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 42 }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {[
                                          { field: 'combustible', label: 'Combustible', readOnly: true, value: activeUnitFuelTotal },
                                          { field: 'colaborador', label: 'Colaborador' },
                                          { field: 'peajes', toggle: 'cobrarPeajes', label: 'Peajes' },
                                          { field: 'carga', toggle: 'cobrarCarga', label: 'Carga' },
                                          { field: 'ferry', toggle: 'cobrarFerry', label: 'Ferry' },
                                        ].map(item => (
                                          <div
                                            key={item.field}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '92px minmax(0,1fr)',
                                              gap: 10,
                                              alignItems: 'center',
                                              opacity: item.toggle && activeUnit[item.toggle] === false ? 0.58 : 1,
                                            }}
                                          >
                                            <label
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                gap: 8,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: T.sub,
                                                whiteSpace: 'nowrap',
                                                textAlign: 'right',
                                              }}
                                            >
                                              {item.toggle ? (
                                                <input type="checkbox" checked={activeUnit[item.toggle] !== false} onChange={e => updateUnit(activeUnit.id, item.toggle, e.target.checked)} />
                                              ) : (
                                                <span style={{ width: 14 }} />
                                              )}
                                              <span>{item.label}</span>
                                            </label>
                                            {item.readOnly ? (
                                              <input
                                                value={formatMoney(item.value || 0, displayCurrency, moneyExchange)}
                                                readOnly
                                                style={{ ...inputStyle, color: T.sub, cursor: 'default', textAlign: 'right', fontWeight: 700 }}
                                              />
                                            ) : (
                                              <MonetaryInput
                                                value={activeUnit[item.field] || 0}
                                                onChange={e => updateUnit(activeUnit.id, item.field, e.target.value)}
                                                onBlur={handleGuardar}
                                                symbol={getCurrencyMeta(BASE_CURRENCY).symbol}
                                                inputStyle={{ textAlign: 'right', fontWeight: 700 }}
                                              />
                                            )}
                                          </div>
                                        ))}
                                        <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: 10, alignItems: 'center', marginTop: 2 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: T.mute, textAlign: 'right' }}>Total</div>
                                          <input
                                            value={formatMoney(unitSubtotal, displayCurrency, moneyExchange)}
                                            readOnly
                                            style={{ ...inputStyle, color: T.AMB, cursor: 'default', textAlign: 'right', fontWeight: 800 }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
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
                      <Field label="Adicional colaborador" style={{ gridColumn: 'span 6' }}><MonetaryInput name="adicCol" value={params.adicCol || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
                      <Field label="Adicional viaticos" style={{ gridColumn: 'span 6' }}><MonetaryInput name="adicViat" value={params.adicViat || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
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
                actions={<div style={{ padding: '6px 10px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>{formatMoney(resData.subtotalTransfer, displayCurrency, moneyExchange)}</div>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Tarifa diaria GAM" style={{ gridColumn: 'span 3' }}><MonetaryInput name="tarifaGAM" value={params.tarifaGAM || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
                  <Field label="Dias GAM" style={{ gridColumn: 'span 3' }}><input type="number" name="diasGAM" value={params.diasGAM || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Tarifa media" style={{ gridColumn: 'span 3' }}><MonetaryInput name="mediaTarifa" value={params.mediaTarifa || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
                  <Field label="Dias sin movimiento" style={{ gridColumn: 'span 3' }}><input type="number" name="diasSM" value={params.diasSM || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>Transfers configurados</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                    {transferCatalog.filter(item => item.activo !== false).map(item => {
                      const checked = (params.selectedTransfers || []).some(selected => selected.id === item.id);
                      return (
                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: T.sub, fontSize: 13, padding: '10px 12px', borderRadius: 10, border: `1px solid ${checked ? `${T.AMB}44` : T.bdr}`, background: checked ? T.ambDim : T.card }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleTransfer(item)} />
                            <span>{item.descripcion}</span>
                          </span>
                          <span style={{ color: T.txt, fontWeight: 700 }}>{fmtCRC(item.costo)}</span>
                        </label>
                      );
                    })}
                  </div>
                  {transferCatalog.filter(item => item.activo !== false).length === 0 && (
                    <div style={{ fontSize: 12, color: T.mute }}>No hay transfers activos configurados en Ajustes {'>'} Cotizaciones.</div>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                id="extras"
                label="Hospedaje y viaticos"
                summary={extrasResumen}
                open={openSection === 'extras'}
                onToggle={toggleSection}
                actions={<div style={{ padding: '6px 10px', borderRadius: 999, background: T.ambDim, color: T.AMB, fontSize: 11, fontWeight: 800 }}>{formatMoney(resData.subtotalExtras, displayCurrency, moneyExchange)}</div>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Hospedaje por noche" style={{ gridColumn: 'span 3' }}><MonetaryInput name="hospedaje" value={params.hospedaje || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
                  <Field label="Numero de noches" style={{ gridColumn: 'span 3' }}><input type="number" name="noches" value={params.noches || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Personas con hospedaje" style={{ gridColumn: 'span 3' }}><input type="number" name="persHosp" value={params.persHosp || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
                  <Field label="Hospedaje total manual" style={{ gridColumn: 'span 3' }}><MonetaryInput name="hospedajeTotalManual" value={params.hospedajeTotalManual || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 14 }}>
                  <Field label="Viatico diario por persona" style={{ gridColumn: 'span 3' }}><MonetaryInput name="viatDiario" value={params.viatDiario || 0} onChange={pChange} onBlur={handleGuardar} symbol={getCurrencyMeta(BASE_CURRENCY).symbol} /></Field>
                  <Field label="Personas con viaticos" style={{ gridColumn: 'span 3' }}><input type="number" name="persViat" value={params.persViat || 0} onChange={pChange} onBlur={handleGuardar} style={inputStyle} /></Field>
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.AMB, marginTop: 4 }}>{effectiveProformaNumber || '(NUEVA)'}</div>
                </div>
                {savedMsg && <div style={{ color: savedMsg.includes('Error') ? T.RED : T.GRN, fontSize: 12, fontWeight: 700 }}>{savedMsg}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Forma de pago" style={{ gridColumn: 'span 2' }}>
                  <input name="cfPago" value={socio.cfPago} onChange={sChange} onBlur={handleGuardar} style={inputStyle} />
                </Field>
                <Field label="Moneda">
                  <select name="cfMoneda" value={displayCurrency} onChange={sChange} onBlur={handleGuardar} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {DISPLAY_CURRENCIES.map(item => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Utilidad">
                  <PercentInput name="utilidadPct" value={params.utilidadPct || 0} onChange={pChange} onBlur={handleGuardar} />
                </Field>
                <Field label="Descuento">
                  <PercentInput name="descuentoPct" value={params.descuentoPct || 0} onChange={pChange} onBlur={handleGuardar} />
                </Field>
                <Field label="IVA">
                  <PercentInput name="iva" value={params.iva || 0} onChange={pChange} onBlur={handleGuardar} />
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
                  resData.descuentoAmt > 0 ? [`Descuento (${Number(params.descuentoPct || 0).toFixed(2)}%)`, -resData.descuentoAmt] : null,
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: T.sub }}>{label}</span>
                    <span style={{ color: T.txt, fontWeight: 600 }}>{formatMoney(value, displayCurrency, moneyExchange)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${T.bdr2}`, margin: '2px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.sub }}>Subtotal</span>
                <span style={{ color: T.txt, fontWeight: 700 }}>{formatMoney(resData.subtotal, displayCurrency, moneyExchange)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.sub }}>IVA ({params.iva}%)</span>
                <span style={{ color: T.txt }}>{formatMoney(resData.ivaAmt, displayCurrency, moneyExchange)}</span>
              </div>

              <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>TOTAL {displayCurrency}</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: T.AMB }}>{formatMoney(resData.total, displayCurrency, moneyExchange)}</span>
                </div>
                <div style={{ fontSize: 11, color: T.mute, textAlign: 'right', marginTop: 4 }}>{fmtCRC(resData.totalCRC)} base</div>
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

      {showRouteDesigner && googleMapsApiKey && (
        <RouteDesignerModal
          unitId={routeDesignerUnitId}
          unitItinerary={units.find(u => u.id === routeDesignerUnitId)?.itinerary}
          vehiculoId={units.find(u => u.id === routeDesignerUnitId)?.vehiculoId || null}
          vehicleLabel={(() => {
            const unit = units.find(u => u.id === routeDesignerUnitId);
            const vehiculo = vehiculos.find(item => item.id === unit?.vehiculoId);
            return vehiculo ? `${vehiculo.placa} · ${vehiculo.marca} ${vehiculo.modelo}` : '';
          })()}
          googleMapsApiKey={googleMapsApiKey}
          onClose={() => { setShowRouteDesigner(false); setRouteDesignerUnitId(null); }}
          onSave={(routePayload) => {
            if (routeDesignerUnitId) {
              const sourceUnit = units.find(unit => unit.id === routeDesignerUnitId) || activeUnit || null;
              const currentVehicle = vehiculos.find(item => item.id === sourceUnit?.vehiculoId) || null;
              const defaultVehiculoLabel = formatVehicleLabel(currentVehicle);
              const routeResults = Array.isArray(routePayload) ? routePayload : [routePayload];
              const validRouteResults = routeResults.filter(Boolean);
              const routeRows = buildItineraryRowsFromRouteResults(validRouteResults, {
                initialTime: sourceUnit?.sHora || socio.sHora || '',
                defaultVehiculoId: sourceUnit?.vehiculoId || null,
                defaultVehiculoLabel,
              });
              const itinerary = {
                unitId: routeDesignerUnitId,
                importedRoutes: validRouteResults.map(route => ({
                  ...route,
                  vehiculoId: route.vehiculoId || sourceUnit?.vehiculoId || null,
                  vehicleLabel: route.vehicleLabel || defaultVehiculoLabel,
                })),
                totals: {
                  distance_m: validRouteResults.reduce((sum, route) => sum + Number(route?.result?.totalDistance || 0), 0),
                  duration_s: validRouteResults.reduce((sum, route) => sum + Number(route?.result?.totalTime || 0), 0),
                },
              };
              setUnits(prev => prev.map(unit => {
                if (unit.id === routeDesignerUnitId) {
                  const updated = syncUnitFromItineraryRows(unit, routeRows);
                  updated.itinerary = itinerary;
                  return updated;
                }
                return unit;
              }));
              setActiveUnitId(routeDesignerUnitId);
              setItineraryRows(routeRows);
              setActiveUnitTab('operacion');
              setOpenSection('costos');
              setSavedMsg('Itinerario cargado desde mapas ✓');
              setAutoSaveEnabled(true);
            }
            setShowRouteDesigner(false);
            setRouteDesignerUnitId(null);
          }}
        />
      )}

      {!googleMapsApiKey && showRouteDesigner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.62)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
          }}
          onClick={() => { setShowRouteDesigner(false); setRouteDesignerUnitId(null); }}
        >
          <div
            style={{
              width: 400,
              padding: 32,
              background: T.card,
              border: `1px solid ${T.bdr}`,
              borderRadius: 18,
              boxShadow: '0 30px 80px rgba(15,23,42,0.35)',
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Map size={48} color={T.RED} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Google Maps API no configurada</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 20 }}>
              Ve a Configuraci&oacute;n → APIs para agregar tu API Key de Google Maps.
            </div>
            <button
              onClick={() => { setShowRouteDesigner(false); setRouteDesignerUnitId(null); }}
              style={{
                padding: '10px 20px',
                background: T.AMB,
                color: '#000',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      </div>
      {socioSuggestionsDropdown}
    </div>
  );
}
