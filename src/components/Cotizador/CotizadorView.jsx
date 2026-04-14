import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  MapPin,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { pdfGen } from '../../utils/pdfGenerator';
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
  { id: 'totales', label: 'Totales' },
];

const PARAMS_DEFAULT = {
  km: 0, combustible: 0.18, tipoCombustible: 'Diesel', tc: 520,
  colaborador: 25, peajes: 15, viaticos: 10, ferry: 0, utilidad: 50, iva: 13,
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

function newSocio() {
  return {
    cfNumero: makeProformaNumber(),
    cfValidez: 15,
    cfPago: '50% adelanto, 50% al cierre',
    cfDescripcion: '',
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
  return `$${Number(v || 0).toFixed(2)}`;
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
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          padding: '16px 18px',
          minHeight: 108,
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
          <div
            style={{
              maxHeight: open ? 0 : 200,
              opacity: open ? 0 : 1,
              overflow: 'hidden',
              transform: open ? 'translateY(-8px)' : 'translateY(0)',
              transition: 'max-height 0.24s ease, opacity 0.2s ease, transform 0.24s ease, margin-top 0.24s ease',
              marginTop: open ? 0 : 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: T.sub,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {summary}
            </div>
          </div>
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

export default function CotizadorView({ voiceDraft = null, onVoiceDraftApplied }) {
  const { token } = useAuth();
  const authH = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const [viewMode, setViewMode] = useState('lista');
  const [openSection, setOpenSection] = useState('');
  const [vehiculoActivo, setVehiculoActivo] = useState(null);
  const [params, setParams] = useState({ ...PARAMS_DEFAULT });
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

  const autosaveTimer = useRef(null);
  const lastSavedSignature = useRef('');
  const savingRef = useRef(false);
  const guardarRef = useRef(null);


  const { socios: sociosBD, loading: loadingSocios } = useSocios(token);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, hRes, cRes] = await Promise.all([
        fetch('/api/tms/vehiculos', { headers: authH }),
        fetch('/api/tms/proformas', { headers: authH }),
        fetch('/api/tms/config/global', { headers: authH }),
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
    const v = vehiculos.find(item => item.id === vehiculoActivo);
    if (!v) return;
    setParams(prev => ({
      ...prev,
      colaborador: Number(v.colaborador) || prev.colaborador,
      combustible: Number(v.combustible_costo) || prev.combustible,
      tipoCombustible: v.combustible_tipo || prev.tipoCombustible,
      peajes: Number(v.peajes) || prev.peajes,
      viaticos: Number(v.viaticos) || prev.viaticos,
      utilidad: Number(v.utilidad) || prev.utilidad,
      adicCol: Number(v.adic_col) || prev.adicCol,
      adicViat: Number(v.adic_viat) || prev.adicViat,
      tarifaGAM: Number(v.tarifa_gam) || prev.tarifaGAM,
      mediaTarifa: Number(v.media_tarifa) || prev.mediaTarifa,
      tInSJ: Number(v.t_in_sj) || prev.tInSJ,
      tOutSJ: Number(v.t_out_sj) || prev.tOutSJ,
      tInCTG: Number(v.t_in_ctg) || prev.tInCTG,
      tOutCTG: Number(v.t_out_ctg) || prev.tOutCTG,
      hospedaje: Number(v.hospedaje) || prev.hospedaje,
      viatDiario: Number(v.viatico_diario) || prev.viatDiario,
    }));
  }, [vehiculoActivo, vehiculos]);

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
    if (viewMode !== 'detalle') return;

    const suggestedVehicleId = chooseSuggestedVehicle(vehiculos, socio.sPax, vehiculoActivo);
    if (suggestedVehicleId !== vehiculoActivo) {
      setVehiculoActivo(suggestedVehicleId);
    }
  }, [socio.sPax, vehiculoActivo, vehiculos, viewMode]);


  useEffect(() => {
    const p = params;
    const km = Number(p.km) || 0;
    const costoKm = km * p.combustible;
    let base = costoKm + p.colaborador + p.peajes + p.viaticos + p.ferry + p.utilidad;
    if (p.chkDia) base += p.adicCol + p.adicViat;

    const tarFijas =
      (p.diasGAM * p.tarifaGAM) + (p.diasSM * p.mediaTarifa) +
      (p.ckTinSJ ? p.tInSJ : 0) + (p.ckToutSJ ? p.tOutSJ : 0) +
      (p.ckTinCTG ? p.tInCTG : 0) + (p.ckToutCTG ? p.tOutCTG : 0);

    const hospedajeCalculado = p.hospedajeTotalManual > 0
      ? p.hospedajeTotalManual
      : (p.noches * p.hospedaje * Math.max(Number(p.persHosp || 0), 0));
    const extras = hospedajeCalculado + (p.viatDiario * p.persViat);
    const subtotal = base + tarFijas + extras;
    const ivaAmt = subtotal * (p.iva / 100);
    const total = subtotal + ivaAmt;

    setResData({ costoKm, base, tarFijas, hospedajeCalculado, extras, subtotal, ivaAmt, total, totalCRC: total * p.tc });
  }, [params]);

  const currentStatus = socio._estado || 'borrador';
  const selectedVehiculo = vehiculos.find(item => item.id === vehiculoActivo);

  const payloadSignature = useMemo(() => JSON.stringify({
    numero: socio.cfNumero,
    cliente_nombre: socio.sNombre,
    cliente_empresa: socio.sEmpresa,
    total_usd: resData.total,
    data_json: { params, socio, vehiculoId: vehiculoActivo, estado: currentStatus },
  }), [currentStatus, params, resData.total, socio, vehiculoActivo]);

  const guardar = useCallback(async (estadoOverride) => {
    if (savingRef.current) return;
    const estado = estadoOverride ?? socio._estado ?? 'borrador';
    const payload = {
      numero: socio.cfNumero,
      cliente_nombre: socio.sNombre,
      cliente_empresa: socio.sEmpresa,
      total_usd: resData.total,
      data_json: { params, socio: { ...socio, _estado: estado }, vehiculoId: vehiculoActivo, estado },
    };

    savingRef.current = true;
    console.log('[guardar] Enviando payload:', JSON.stringify(payload).slice(0, 200));
    try {
      const res = await fetch('/api/tms/proformas', {
        method: 'POST',
        headers: authH,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      console.log('[guardar] Respuesta:', res.status, JSON.stringify(data).slice(0, 200));
      if (!res.ok) throw new Error(data.error || `Error ${res.status} al guardar`);

      setSocio(prev => ({ ...prev, _estado: estado }));
      setSelectedId(data.id || selectedId);
      lastSavedSignature.current = JSON.stringify(payload);
      setSavedMsg('Guardado ✓');
      setTimeout(() => setSavedMsg(''), 1800);
      // Solo refrescamos el historial, no params — para no pisar km ni otros campos
      const hRes = await fetch('/api/tms/proformas', { headers: authH });
      if (hRes.ok) setHistorial(await hRes.json());
    } catch (error) {
      console.error('Error guardando proforma:', error);
      setSavedMsg('Error al guardar');
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      savingRef.current = false;
    }
  }, [authH, params, resData.total, selectedId, socio, vehiculoActivo]);

  // Mantener guardarRef apuntando siempre a la versión más reciente de guardar
  // para poder llamarla desde el autosave sin que sea una dependencia del timer
  guardarRef.current = guardar;

  useEffect(() => {
    if (!autoSaveEnabled || viewMode !== 'detalle') return;
    if (payloadSignature === lastSavedSignature.current) return;

    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // Llamamos via ref para no tener guardar en las deps del effect
      // (si guardar estuviera en deps, cada cambio de campo cancela el timer)
      guardarRef.current?.();
    }, 900);

    return () => clearTimeout(autosaveTimer.current);
  // guardar NO va en deps — usamos guardarRef para leer la versión fresca
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, payloadSignature, viewMode]);

  const toggleSection = (sectionId) => {
    setOpenSection(prev => (prev === sectionId ? '' : sectionId));
  };

  const nuevaProforma = () => {
    clearTimeout(autosaveTimer.current);
    setSelectedId(null);
    setParams({ ...PARAMS_DEFAULT });
    setSocio(newSocio());
    setVoiceFeedback(null);
    setOpenSection('');
    setSocioSearch('');
    setShowSocioSuggestions(false);
    setViewMode('detalle');
    setShowStatusMenu(false);
    setMapPickerField('');
    if (vehiculos.length > 0) setVehiculoActivo(vehiculos[0].id);
    lastSavedSignature.current = '';
    setAutoSaveEnabled(false);
  };

  const applyVoiceDraft = useCallback((draft) => {
    if (!draft?.id) return;

    const data = draft.quoteData || {};
    const nextPax = Number(data.sPax || data.pasajeros || 1);
    clearTimeout(autosaveTimer.current);
    setSelectedId(null);
    setParams(prev => ({
      ...prev,
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
    }));
    setSocio({
      ...newSocio(),
      sCodigoCliente: data.sCodigoCliente || data.codigoCliente || '',
      sNombre: data.sNombre || data.nombreCliente || '',
      sEmpresa: data.sEmpresa || data.empresa || '',
      sContacto: data.sContacto || data.contacto || '',
      sCargo: data.sCargo || data.cargo || '',
      sTel: data.sTel || data.telefono || '',
      sEmail: data.sEmail || data.email || '',
      sDireccion: data.sDireccion || data.direccion || '',
      sOrigen: data.sOrigen || data.origen || '',
      sDestino: data.sDestino || data.destino || '',
      sFecha: data.sFecha || data.fechaServicio || '',
      sHora: data.sHora || data.horaServicio || '',
      sPax: nextPax,
      cfDescripcion: data.cfDescripcion || data.descripcion || draft.transcript || '',
      cfPago: data.cfPago || newSocio().cfPago,
      cfValidez: data.cfValidez || newSocio().cfValidez,
      _estado: 'borrador',
    });
    setVehiculoActivo(prev => chooseSuggestedVehicle(vehiculos, nextPax, prev));
    setVoiceFeedback({
      message: draft.assistantMessage || '',
      missingFields: Array.isArray(draft.missingFields) ? draft.missingFields : [],
      interpretationNotes: Array.isArray(draft.interpretationNotes) ? draft.interpretationNotes : [],
    });
    setSocioSearch(data.sNombre || data.nombreCliente || data.sEmpresa || data.empresa || '');
    setViewMode('detalle');
    setOpenSection(data.sOrigen || data.origen || data.sDestino || data.destino ? 'servicio' : 'cliente');
    setShowSocioSuggestions(false);
    setShowStatusMenu(false);
    setAutoSaveEnabled(true);
    lastSavedSignature.current = '';
    onVoiceDraftApplied?.(draft.id);
  }, [onVoiceDraftApplied, vehiculos]);

  const cancelarDetalle = () => {
    clearTimeout(autosaveTimer.current);
    setViewMode('lista');
    setSelectedId(null);
    setVoiceFeedback(null);
    setAutoSaveEnabled(false);
    setSavedMsg('');
    setShowStatusMenu(false);
    setMapPickerField('');
  };

  useEffect(() => {
    if (!voiceDraft?.id) return;
    applyVoiceDraft(voiceDraft);
  }, [applyVoiceDraft, voiceDraft]);

  const cargarProforma = (proforma) => {
    const data = proforma.data_json || {};
    const socioData = data.socio || {};
    const paramsData = data.params || {};

    setSelectedId(proforma.id);
    setParams({ ...PARAMS_DEFAULT, ...paramsData });
    setSocio({ ...newSocio(), ...socioData, cfNumero: proforma.numero, _estado: data.estado || socioData._estado || 'borrador' });
    setVehiculoActivo(data.vehiculoId || vehiculoActivo);
    setVoiceFeedback(null);
    setOpenSection('');
    setSocioSearch('');
    setShowSocioSuggestions(false);
    setViewMode('detalle');
    setAutoSaveEnabled(true);
    setShowStatusMenu(false);
    setMapPickerField('');
    lastSavedSignature.current = JSON.stringify({
      numero: proforma.numero,
      cliente_nombre: proforma.cliente_nombre,
      cliente_empresa: proforma.cliente_empresa,
      total_usd: proforma.total_usd,
      data_json: { ...data, socio: { ...newSocio(), ...socioData, cfNumero: proforma.numero, _estado: data.estado || socioData._estado || 'borrador' } },
    });
  };

  const borrarProforma = async (id) => {
    if (!confirm('Eliminar esta proforma de la base de datos?')) return;
    try {
      await fetch(`/api/tms/proformas/${id}`, { method: 'DELETE', headers: authH });
      setHistorial(prev => prev.filter(item => item.id !== id));
      if (selectedId === id) cancelarDetalle();
    } catch (error) {
      console.error('Error eliminando proforma:', error);
    }
  };

  const actualizarEstado = async (nuevoEstado) => {
    setSocio(prev => ({ ...prev, _estado: nuevoEstado }));
    setShowStatusMenu(false);
    await guardar(nuevoEstado);
  };

  const generarPDF = async () => {
    await guardar();
    pdfGen({ params, socio, resData, vehiculo: selectedVehiculo });
  };

  const pChange = ({ target: { name, value, type, checked } }) => {
    setParams(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : name === 'km' ? value : Number(value) }));
    setAutoSaveEnabled(true);
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

    setSocio(prev => ({ ...prev, [name]: value }));
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
    const principal = item.contactos?.find(contacto => contacto.es_principal) || item.contactos?.[0] || {};
    setSocio(prev => ({
      ...prev,
      sCodigoCliente: item.codigoCliente || '',
      sNombre: item.nombre || '',
      sEmail: principal.email || item.email || '',
      sTel: principal.telefono || item.telefono || '',
      sEmpresa: item.empresa || '',
      sCedula: item.identificacion || '',
      sCargo: principal.cargo || '',
      sContacto: principal.nombre || '',
      sDireccion: item.direccion || '',
    }));
    setSocioSearch(item.nombre || item.empresa || item.codigoCliente || '');
    setShowSocioSuggestions(false);
    setOpenSection('cliente');
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
    Number(params.km) ? `${Number(params.km)} km` : '0 km',
    `Combustible ${fmt(resData.costoKm)}`,
    `Base ${fmt(resData.base)}`,
    resData.tarFijas > 0 ? `Transfers ${fmt(resData.tarFijas)}` : '',
  ].filter(Boolean).join(' | ');

  const extrasResumen = [
    params.noches > 0 ? `${params.noches} noches` : 'Sin noches',
    params.hospedajeTotalManual > 0
      ? `Hospedaje total ${fmt(params.hospedajeTotalManual)}`
      : params.hospedaje ? `Hospedaje ${fmt(params.hospedaje)}/noche` : '',
    params.persHosp ? `${params.persHosp} personas con hospedaje` : '',
    params.persViat ? `${params.persViat} con viaticos` : '',
    params.viatDiario ? `Viatico diario ${fmt(params.viatDiario)}` : '',
  ].filter(Boolean).join(' | ');

  const totalesResumen = `Subtotal ${fmt(resData.subtotal)} | IVA ${fmt(resData.ivaAmt)} | Total ${fmt(resData.total)}`;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: viewMode === 'detalle' ? 'nowrap' : 'wrap', width: '100%', overflowX: 'hidden' }}>
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {viewMode === 'lista' && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.txt }}>Proformas</div>
                <div style={{ fontSize: 13, color: T.mute }}>Lista de cotizaciones con acceso directo al detalle.</div>
              </div>
              <button onClick={cargarDatos} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', background: 'transparent', border: `1px solid ${T.bdr2}`, borderRadius: 8, color: T.sub, cursor: 'pointer', fontSize: 13 }}>
                <RefreshCcw size={14} /> Actualizar
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              <Search size={14} color={T.mute} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por numero, cliente, codigo o ruta..." style={{ background: 'transparent', border: 'none', outline: 'none', color: T.txt, fontSize: 13, flex: 1 }} />
            </div>

            <button onClick={nuevaProforma} style={{ marginBottom: 18, padding: '8px 0', background: 'transparent', border: 'none', color: T.AMB, cursor: 'pointer', fontSize: 13, fontWeight: 800 }}>
              Crear proforma
            </button>

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

        {viewMode === 'detalle' && (
            <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflowX: 'hidden' }}>
              {voiceFeedback && (
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
                  <Field label="Buscar cliente o empresa" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card2, border: `1px solid ${showSocioSuggestions ? `${T.AMB}55` : T.bdr2}`, borderRadius: 10, padding: '0 12px' }}>
                        <Search size={14} color={showSocioSuggestions ? T.AMB : T.mute} />
                        <input
                          value={socioSearch}
                          onChange={e => {
                            setSocioSearch(e.target.value);
                            setShowSocioSuggestions(true);
                          }}
                          onFocus={() => setShowSocioSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSocioSuggestions(false), 120)}
                          placeholder="Escribe nombre, empresa o ID del socio..."
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
                  <Field label="ID cliente" style={{ gridColumn: 'span 2' }}>
                    <input name="sCodigoCliente" value={socio.sCodigoCliente} onChange={sChange} style={inputStyle} placeholder="Codigo" />
                  </Field>
                  <Field label="Cliente" style={{ gridColumn: 'span 5' }}>
                    <input name="sNombre" value={socio.sNombre} onChange={sChange} style={inputStyle} placeholder="Nombre del cliente" />
                  </Field>
                  <Field label="Empresa" style={{ gridColumn: 'span 5' }}>
                    <input name="sEmpresa" value={socio.sEmpresa} onChange={sChange} style={inputStyle} placeholder="Empresa" />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 14 }}>
                  <Field label="Contacto" style={{ gridColumn: 'span 4' }}>
                    <input name="sContacto" value={socio.sContacto} onChange={sChange} style={inputStyle} placeholder="Persona de contacto" />
                  </Field>
                  <Field label="Cargo" style={{ gridColumn: 'span 4' }}>
                    <input name="sCargo" value={socio.sCargo} onChange={sChange} style={inputStyle} placeholder="Cargo" />
                  </Field>
                  <Field label="Telefono" style={{ gridColumn: 'span 4' }}>
                    <input name="sTel" value={socio.sTel} onChange={sChange} style={inputStyle} placeholder="Telefono" />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 14 }}>
                  <Field label="Correo" style={{ gridColumn: 'span 6' }}>
                    <input name="sEmail" value={socio.sEmail} onChange={sChange} style={inputStyle} placeholder="Correo electronico" />
                  </Field>
                  <Field label="Direccion" style={{ gridColumn: 'span 6' }}>
                    <input name="sDireccion" value={socio.sDireccion} onChange={sChange} style={inputStyle} placeholder="Direccion" />
                  </Field>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Field label="Descripcion del servicio / comentarios">
                    <textarea name="cfDescripcion" value={socio.cfDescripcion} onChange={sChange} style={areaStyle} placeholder="Resumen corto del servicio solicitado" />
                  </Field>
                </div>
              </AccordionSection>

              <AccordionSection id="servicio" label="Servicio" summary={servicioResumen} open={openSection === 'servicio'} onToggle={toggleSection}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Fecha de servicio" style={{ gridColumn: 'span 3' }}><input type="date" name="sFecha" value={socio.sFecha} onChange={sChange} style={inputStyle} /></Field>
                  <Field label="Hora de servicio" style={{ gridColumn: 'span 3' }}><input type="time" name="sHora" value={socio.sHora} onChange={sChange} style={inputStyle} /></Field>
                  <Field label="Origen" style={{ gridColumn: 'span 3' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
                      <input name="sOrigen" value={socio.sOrigen} onChange={sChange} style={inputStyle} placeholder="Escribe o elige desde el mapa" />
                      <button type="button" onClick={() => openMapPicker('origen')} style={mapIconButtonStyle} title="Elegir origen en el mapa">
                        <MapPin size={16} />
                      </button>
                    </div>
                  </Field>
                  <Field label="Destino" style={{ gridColumn: 'span 3' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
                      <input name="sDestino" value={socio.sDestino} onChange={sChange} style={inputStyle} placeholder="Escribe o elige desde el mapa" />
                      <button type="button" onClick={() => openMapPicker('destino')} style={mapIconButtonStyle} title="Elegir destino en el mapa">
                        <MapPin size={16} />
                      </button>
                    </div>
                  </Field>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => calculateDistance()}
                    style={{
                      padding: '9px 12px',
                      background: T.ambDim,
                      border: `1px solid ${T.AMB}44`,
                      borderRadius: 8,
                      color: T.AMB,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Calcular km
                  </button>
                  {distanceStatus && (
                    <div style={{ fontSize: 12, color: distanceStatus.toLowerCase().includes('distancia estimada') ? T.GRN : T.mute }}>
                      {distanceStatus}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: T.mute }}>
                    Puedes calcular automatico o escribir los kilometros manualmente.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 14 }}>
                  <Field label="Pasajeros" style={{ gridColumn: 'span 2' }}><input type="number" name="sPax" value={socio.sPax} onChange={sChange} style={inputStyle} /></Field>
                  <Field label="Direccion" style={{ gridColumn: 'span 10' }}><input name="sDireccion" value={socio.sDireccion} onChange={sChange} style={inputStyle} /></Field>
                </div>
              </AccordionSection>

              <AccordionSection id="costos" label="Costos operativos" summary={costosResumen} open={openSection === 'costos'} onToggle={toggleSection}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Kilometros" style={{ gridColumn: 'span 4' }}>
                    <input type="number" name="km" value={params.km} onChange={pChange} style={inputStyle} min="0" />
                  </Field>
                                    <Field label={`Costo ${params.tipoCombustible}/km ($)`} style={{ gridColumn: 'span 4' }}><input type="number" step="0.01" name="combustible" value={params.combustible} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Tipo cambio" style={{ gridColumn: 'span 4' }}><input type="number" name="tc" value={params.tc} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Colaborador ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="colaborador" value={params.colaborador} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Peajes ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="peajes" value={params.peajes} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Viaticos ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="viaticos" value={params.viaticos} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Ferry ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="ferry" value={params.ferry} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Utilidad ($)" style={{ gridColumn: 'span 6' }}><input type="number" name="utilidad" value={params.utilidad} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="IVA (%)" style={{ gridColumn: 'span 6' }}><input type="number" name="iva" value={params.iva} onChange={pChange} style={inputStyle} /></Field>
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.bdr}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 12 }}>Tarifa transfer</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14 }}>
                    <Field label="Tarifa diaria GAM ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="tarifaGAM" value={params.tarifaGAM} onChange={pChange} style={inputStyle} /></Field>
                    <Field label="Dias GAM" style={{ gridColumn: 'span 3' }}><input type="number" name="diasGAM" value={params.diasGAM} onChange={pChange} style={inputStyle} /></Field>
                    <Field label="Media tarifa ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="mediaTarifa" value={params.mediaTarifa} onChange={pChange} style={inputStyle} /></Field>
                    <Field label="Dias sin movimiento" style={{ gridColumn: 'span 3' }}><input type="number" name="diasSM" value={params.diasSM} onChange={pChange} style={inputStyle} /></Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckTinSJ" checked={params.ckTinSJ} onChange={pChange} /> Transfer IN Aeropuerto SJO (${params.tInSJ})</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckToutSJ" checked={params.ckToutSJ} onChange={pChange} /> Transfer OUT Aeropuerto SJO (${params.tOutSJ})</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckTinCTG" checked={params.ckTinCTG} onChange={pChange} /> Transfer IN Aeropuerto Cartago (${params.tInCTG})</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.sub, fontSize: 13 }}><input type="checkbox" name="ckToutCTG" checked={params.ckToutCTG} onChange={pChange} /> Transfer OUT Aeropuerto Cartago (${params.tOutCTG})</label>
                  </div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.bdr}` }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.sub }}>
                    <input type="checkbox" name="chkDia" checked={params.chkDia} onChange={pChange} />
                    Incluir adicionales de viaje por dia
                  </label>
                  {params.chkDia && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 12 }}>
                      <Field label="Adicional colaborador ($)" style={{ gridColumn: 'span 6' }}><input type="number" name="adicCol" value={params.adicCol} onChange={pChange} style={inputStyle} /></Field>
                      <Field label="Adicional viaticos ($)" style={{ gridColumn: 'span 6' }}><input type="number" name="adicViat" value={params.adicViat} onChange={pChange} style={inputStyle} /></Field>
                    </div>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection id="extras" label="Hospedaje y viaticos" summary={extrasResumen} open={openSection === 'extras'} onToggle={toggleSection}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 16 }}>
                  <Field label="Hospedaje/noche ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="hospedaje" value={params.hospedaje} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Numero de noches" style={{ gridColumn: 'span 3' }}><input type="number" name="noches" value={params.noches} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Personas con hospedaje" style={{ gridColumn: 'span 3' }}><input type="number" name="persHosp" value={params.persHosp} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Hospedaje total manual ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="hospedajeTotalManual" value={params.hospedajeTotalManual} onChange={pChange} style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14, marginTop: 14 }}>
                  <Field label="Viatico diario/persona ($)" style={{ gridColumn: 'span 3' }}><input type="number" name="viatDiario" value={params.viatDiario} onChange={pChange} style={inputStyle} /></Field>
                  <Field label="Personas con viaticos" style={{ gridColumn: 'span 3' }}><input type="number" name="persViat" value={params.persViat} onChange={pChange} style={inputStyle} /></Field>
                </div>
              </AccordionSection>

              <AccordionSection id="totales" label="Totales" summary={totalesResumen} open={openSection === 'totales'} onToggle={toggleSection} accent={T.GRN}>
                <div style={{ marginTop: 16 }}>
                  {[
                    ['Combustible', resData.costoKm],
                    ['Colaborador', params.colaborador],
                    ['Peajes', params.peajes],
                    ['Viaticos', params.viaticos],
                    params.ferry > 0 ? ['Ferry', params.ferry] : null,
                    params.utilidad > 0 ? ['Utilidad', params.utilidad] : null,
                    params.chkDia ? ['Adicional dia', params.adicCol + params.adicViat] : null,
                    resData.tarFijas > 0 ? ['Tarifas / transfers', resData.tarFijas] : null,
                    resData.hospedajeCalculado > 0 ? ['Hospedaje', resData.hospedajeCalculado] : null,
                    (params.viatDiario * params.persViat) > 0 ? ['Viaticos diarios', params.viatDiario * params.persViat] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                      <span style={{ color: T.sub }}>{label}</span>
                      <span style={{ color: T.txt, fontWeight: 600 }}>{fmt(value)}</span>
                    </div>
                  ))}

                  <div style={{ borderTop: `1px solid ${T.bdr2}`, margin: '14px 0 12px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: T.sub }}>Subtotal</span>
                    <span style={{ color: T.txt, fontWeight: 700 }}>{fmt(resData.subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
                    <span style={{ color: T.sub }}>IVA ({params.iva}%)</span>
                    <span style={{ color: T.txt }}>{fmt(resData.ivaAmt)}</span>
                  </div>

                  <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>TOTAL USD</span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: T.AMB }}>{fmt(resData.total)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.mute, textAlign: 'right', marginTop: 4 }}>CRC {Math.round(resData.totalCRC || 0).toLocaleString('es-CR')}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    <button onClick={generarPDF} style={{ width: '100%', padding: 13, background: T.AMB, border: 'none', borderRadius: 10, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <FileText size={16} /> Generar PDF
                    </button>
                    <button onClick={cancelarDetalle} style={{ width: '100%', padding: 12, background: 'transparent', border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.sub, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Cerrar detalle
                    </button>
                  </div>
                </div>
              </AccordionSection>
          </div>
        )}
      </div>

      <div style={{ width: 320, minWidth: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {viewMode === 'detalle' && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.mute, letterSpacing: 0.3 }}>PROFORMA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.AMB, marginTop: 4 }}>{socio.cfNumero}</div>
              </div>
              {savedMsg && <div style={{ color: savedMsg.includes('Error') ? T.RED : T.GRN, fontSize: 12, fontWeight: 700 }}>{savedMsg}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}>
              <Field label="Forma de pago">
                <input name="cfPago" value={socio.cfPago} onChange={sChange} style={inputStyle} />
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
  );
}
