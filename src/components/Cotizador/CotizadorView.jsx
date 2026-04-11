import React, { useState, useEffect } from 'react';
import { Settings, User, Bus, Smartphone, FileText, ChevronRight } from 'lucide-react';
import { T } from '../../App'; // Importación de tokens
import { pdfGen } from '../../utils/pdfGenerator';

export default function CotizadorView({ vehiculos, onSave, historial }) {
  const [tab, setTab] = useState('calc');
  const [subTab, setSubTab] = useState('s1');

  // Estados del formulario y cálculo
  const [vehiculoActivo, setVehiculoActivo] = useState(vehiculos[0]?.id || null);

  // Parámetros numéricos
  const [params, setParams] = useState({
    km: 0,
    combustible: 0.18,
    tipoCombustible: 'Diésel',
    tc: 520,
    colaborador: 25,
    peajes: 15,
    viaticos: 10,
    ferry: 0,
    utilidad: 50,
    iva: 13,
    chkDia: false,
    adicCol: 15,
    adicViat: 15,
    tarifaGAM: 150,
    diasGAM: 0,
    mediaTarifa: 75,
    diasSM: 0,
    tInSJ: 50, ckTinSJ: false,
    tOutSJ: 45, ckToutSJ: false,
    tInCTG: 65, ckTinCTG: false,
    tOutCTG: 60, ckToutCTG: false,
    hospedaje: 40, noches: 0,
    viatDiario: 25, persViat: 1,
  });

  // Datos del socio / cliente
  const [socio, setSocio] = useState({
    cfNumero: 'PRO-001',
    cfValidez: 15,
    cfPago: '50% adelanto, 50% al cierre',
    cfDescripcion: '',
    sNombre: '',
    sCedula: '',
    sEmail: '',
    sTel: '',
    sEmpresa: '',
    sCargo: '',
    sDireccion: '',
    sPais: 'Costa Rica',
    sNotas: '',
    sPax: 1,
    sFecha: '',
    sHora: '',
    sOrigen: '',
    sDestino: ''
  });

  // Variables de Resultado y Historial
  const [resData, setResData] = useState({});
  const [dbHistorial, setDbHistorial] = useState([]);
  const [dbVehiculos, setDbVehiculos] = useState([]);

  // Cargar datos iniciales
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const vRes = await fetch('/api/tms/vehiculos');
      const vData = await vRes.json();
      setDbVehiculos(vData);
      if (vData.length > 0) setVehiculoActivo(vData[0].id);

      const hRes = await fetch('/api/tms/proformas');
      const hData = await hRes.json();
      setDbHistorial(hData);

      const cRes = await fetch('/api/tms/config/global');
      const cData = await cRes.json();
      if (cData.params) setParams(prev => ({ ...prev, ...cData.params }));
    } catch (err) {
      console.error("Error fetching initial data", err);
    }
  };

  // Cargar propiedades predeterminadas cuando se cambia el vehículo
  useEffect(() => {
    const v = dbVehiculos.find(x => x.id === vehiculoActivo);
    if (v) {
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
        viaticoDiario: Number(v.viatico_diario) || prev.viaticoDiario,
      }));
    }
  }, [vehiculoActivo, dbVehiculos]);

  // Recalculo automático
  useEffect(() => {
    const p = params;
    const costoKm = p.km * p.combustible;
    let base = costoKm + p.colaborador + p.peajes + p.viaticos + p.ferry + p.utilidad;
    if (p.chkDia) {
      base += p.adicCol + p.adicViat;
    }
    const tIn1 = p.ckTinSJ ? p.tInSJ : 0;
    const tOut1 = p.ckToutSJ ? p.tOutSJ : 0;
    const tIn2 = p.ckTinCTG ? p.tInCTG : 0;
    const tOut2 = p.ckToutCTG ? p.tOutCTG : 0;
    
    const tarFijas = (p.diasGAM * p.tarifaGAM) + (p.diasSM * p.mediaTarifa) + tIn1 + tOut1 + tIn2 + tOut2;
    const extras = (p.noches * p.hospedaje) + (p.viatDiario * p.persViat);
    
    const subtotal = base + tarFijas + extras;
    const ivaAmt = subtotal * (p.iva / 100);
    const total = subtotal + ivaAmt;
    const totalCRC = total * p.tc;

    setResData({
      costoKm, base, tarFijas, extras, subtotal, ivaAmt, total, totalCRC, tIn1, tOut1, tIn2, tOut2
    });
  }, [params]);

  const pChange = (e) => {
    const { name, value, type, checked } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value)
    }));
  };

  const sChange = (e) => {
    const { name, value } = e.target;
    setSocio(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generarPDF = async () => {
    const u = dbVehiculos.find(v => v.id === vehiculoActivo);
    
    // Guardar en la base de datos primero
    try {
      await fetch('/api/tms/proformas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: socio.cfNumero,
          cliente_nombre: socio.sNombre,
          cliente_empresa: socio.sEmpresa,
          total_usd: resData.total,
          data_json: { params, socio, vehiculoId: vehiculoActivo }
        })
      });
      // Actualizar historial local
      const hRes = await fetch('/api/tms/proformas');
      const hData = await hRes.json();
      setDbHistorial(hData);
    } catch (err) {
      console.error("Error saving proforma", err);
    }

    pdfGen({
      params, socio, resData, vehiculo: u
    });
  };

  const borrarProforma = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar esta proforma?")) return;
    try {
      await fetch(`/api/tms/proformas/${id}`, { method: 'DELETE' });
      setDbHistorial(prev => prev.filter(p => p.id !== id && p.numero !== id));
    } catch (err) {
        console.error("Error deleting proforma", err);
    }
  };

  const cargarHistorial = (p) => {
    if (p.data_json) {
      // Compatibilidad con proformas antiguas
      const cleanParams = { ...p.data_json.params };
      if (cleanParams.diesel !== undefined && cleanParams.combustible === undefined) {
        cleanParams.combustible = cleanParams.diesel;
        cleanParams.tipoCombustible = 'Diésel'; // Default para antiguas
      }
      
      setParams(cleanParams);
      setSocio(p.data_json.socio);
      if (p.data_json.vehiculoId) setVehiculoActivo(p.data_json.vehiculoId);
      setTab('calc');
    }
  };

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button onClick={() => setTab(id)}
      style={{
        display:'flex', alignItems:'center', gap:8, padding:'10px 16px', border:'none', cursor:'pointer', background:'transparent',
        borderBottom: `2px solid ${tab === id ? T.AMB : 'transparent'}`,
        color: tab === id ? T.AMB : T.sub, fontWeight: tab === id ? 600 : 400
      }}>
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
      
      {/* Columna Principal */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
        
        {/* Navegación del Módulo */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.bdr}` }}>
          <TabBtn id="calc" label="Cotización" icon={FileText} />
          <TabBtn id="socio" label="Datos del cliente" icon={User} />
          <TabBtn id="historial" label="Historial" icon={Settings} />
        </div>

        {tab === 'calc' && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin:'0 0 16px', color:T.txt }}>Unidad de Transporte</h3>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:24 }}>
              {dbVehiculos.map(v => (
                <div key={v.id} onClick={() => setVehiculoActivo(v.id)}
                  style={{
                    padding:'12px', border:`2px solid ${vehiculoActivo === v.id ? T.AMB : T.bdr}`, borderRadius:8,
                    cursor:'pointer', background: vehiculoActivo === v.id ? T.ambDim : 'transparent', width: 140, textAlign:'center'
                   }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{v.tipo === 'Bus' ? '🚌' : '🚐'}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:T.txt }}>{v.marca} {v.modelo}</div>
                  <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>{v.capacidad_pasajeros} pax · {v.placa}</div>
                  <div style={{ fontSize:10, color:T.AMB, fontWeight:600, marginTop:2, background:T.ambDim, borderRadius:4 }}>{v.combustible_tipo || 'Diésel'}</div>
                </div>
              ))}
              {dbVehiculos.length === 0 && <div style={{color:T.mute, fontSize:13}}>Cargando unidades desde la base de datos...</div>}
            </div>

            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              {['s1','s2','s3'].map(s => {
                const ls = {s1:'Servicio base', s2:'Tarifas fijas y transfers', s3:'Hospedaje y viáticos'}[s];
                return (
                  <button key={s} onClick={() => setSubTab(s)}
                    style={{
                      padding:'6px 12px', borderRadius:20, border:`1px solid ${subTab === s ? T.AMB : T.bdr2}`,
                      background: subTab === s ? T.AMB : 'transparent', color: subTab === s ? '#000' : T.sub,
                      cursor:'pointer', fontSize:12, fontWeight:600
                    }}>
                    {ls}
                  </button>
                );
              })}
            </div>

            {subTab === 's1' && (
              <div>
                <h4 style={{ color:T.txt, marginBottom:12 }}>Recorrido y costos operativos</h4>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:16 }}>
                  <div className="field"><label>Kilómetros</label><input type="number" name="km" value={params.km} onChange={pChange}/></div>
                  <div className="field"><label>Costo {params.tipoCombustible}/km ($)</label><input type="number" name="combustible" step="0.01" value={params.combustible} onChange={pChange}/></div>
                  <div className="field"><label>Tipo de cambio (₡/$)</label><input type="number" name="tc" value={params.tc} onChange={pChange}/></div>
                  <div className="field"><label>Colaborador ($)</label><input type="number" name="colaborador" value={params.colaborador} onChange={pChange}/></div>
                  <div className="field"><label>Peajes ($)</label><input type="number" name="peajes" value={params.peajes} onChange={pChange}/></div>
                  <div className="field"><label>Viáticos ($)</label><input type="number" name="viaticos" value={params.viaticos} onChange={pChange}/></div>
                  <div className="field"><label>Ferry ($)</label><input type="number" name="ferry" value={params.ferry} onChange={pChange}/></div>
                  <div className="field"><label>Utilidad ($)</label><input type="number" name="utilidad" value={params.utilidad} onChange={pChange}/></div>
                  <div className="field"><label>IVA (%)</label><input type="number" name="iva" value={params.iva} onChange={pChange}/></div>
                </div>
                <div className="chk-row">
                  <input type="checkbox" name="chkDia" checked={params.chkDia} onChange={pChange}/>
                  <label>Incluir adicionales viaje de un día</label>
                </div>
                {params.chkDia && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16, marginTop:8 }}>
                    <div className="field"><label>Adicional colaborador ($)</label><input type="number" name="adicCol" value={params.adicCol} onChange={pChange}/></div>
                    <div className="field"><label>Adicional viáticos ($)</label><input type="number" name="adicViat" value={params.adicViat} onChange={pChange}/></div>
                  </div>
                )}
              </div>
            )}
            
            {subTab === 's2' && (
              <div>
                <h4 style={{ color:T.txt, marginBottom:12 }}>Tarifas fijas</h4>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16, marginBottom:16 }}>
                  <div className="field"><label>Tarifa diaria GAM ($)</label><input type="number" name="tarifaGAM" value={params.tarifaGAM} onChange={pChange}/></div>
                  <div className="field"><label>Días GAM</label><input type="number" name="diasGAM" value={params.diasGAM} onChange={pChange}/></div>
                  <div className="field"><label>Media tarifa - sin mov. ($)</label><input type="number" name="mediaTarifa" value={params.mediaTarifa} onChange={pChange}/></div>
                  <div className="field"><label>Días sin movimiento</label><input type="number" name="diasSM" value={params.diasSM} onChange={pChange}/></div>
                </div>
                
                <h4 style={{ color:T.txt, marginBottom:12 }}>Transfers</h4>
                <div className="chk-row"><input type="checkbox" name="ckTinSJ" checked={params.ckTinSJ} onChange={pChange}/><label>Transfer IN Aeropuerto SJ (${params.tInSJ})</label></div>
                <div className="chk-row"><input type="checkbox" name="ckToutSJ" checked={params.ckToutSJ} onChange={pChange}/><label>Transfer OUT Aeropuerto SJ (${params.tOutSJ})</label></div>
                <div className="chk-row"><input type="checkbox" name="ckTinCTG" checked={params.ckTinCTG} onChange={pChange}/><label>Transfer IN Aeropuerto Cartago (${params.tInCTG})</label></div>
                <div className="chk-row"><input type="checkbox" name="ckToutCTG" checked={params.ckToutCTG} onChange={pChange}/><label>Transfer OUT Aeropuerto Cartago (${params.tOutCTG})</label></div>
              </div>
            )}

            {subTab === 's3' && (
              <div>
                <h4 style={{ color:T.txt, marginBottom:12 }}>Hospedaje y Viáticos diarios</h4>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16 }}>
                  <div className="field"><label>Hospedaje/noche ($)</label><input type="number" name="hospedaje" value={params.hospedaje} onChange={pChange}/></div>
                  <div className="field"><label>Número de noches</label><input type="number" name="noches" value={params.noches} onChange={pChange}/></div>
                  <div className="field"><label>Viático diario/pax ($)</label><input type="number" name="viatDiario" value={params.viatDiario} onChange={pChange}/></div>
                  <div className="field"><label>Personas viáticos</label><input type="number" name="persViat" value={params.persViat} onChange={pChange}/></div>
                </div>
              </div>
            )}

          </div>
        )}

        {tab === 'socio' && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24, display:'grid', gap:16 }}>
            <h3 style={{ margin:0, color:T.txt }}>Datos del requerimiento</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
              <div className="field"><label>No. Proforma</label><input type="text" name="cfNumero" value={socio.cfNumero} onChange={sChange}/></div>
              <div className="field"><label>Válida (días)</label><input type="number" name="cfValidez" value={socio.cfValidez} onChange={sChange}/></div>
              <div className="field"><label>Forma pago</label><input type="text" name="cfPago" value={socio.cfPago} onChange={sChange}/></div>
            </div>
            <div className="field"><label>Descripción del servicio</label><textarea name="cfDescripcion" rows={2} value={socio.cfDescripcion} onChange={sChange}/></div>
            
            <h3 style={{ margin:'10px 0 0', color:T.txt }}>Cliente Final</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div className="field"><label>Nombre Completo</label><input type="text" name="sNombre" value={socio.sNombre} onChange={sChange}/></div>
              <div className="field"><label>Email</label><input type="text" name="sEmail" value={socio.sEmail} onChange={sChange}/></div>
              <div className="field"><label>Empresa</label><input type="text" name="sEmpresa" value={socio.sEmpresa} onChange={sChange}/></div>
              <div className="field"><label>Teléfono</label><input type="text" name="sTel" value={socio.sTel} onChange={sChange}/></div>
            </div>

            <h3 style={{ margin:'10px 0 0', color:T.txt }}>Vuelo / Ruta</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
              <div className="field"><label>No. Pasajeros</label><input type="number" name="sPax" value={socio.sPax} onChange={sChange}/></div>
              <div className="field"><label>Fecha</label><input type="date" name="sFecha" value={socio.sFecha} onChange={sChange}/></div>
              <div className="field"><label>Hora</label><input type="time" name="sHora" value={socio.sHora} onChange={sChange}/></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div className="field"><label>Origen</label><input type="text" name="sOrigen" value={socio.sOrigen} onChange={sChange}/></div>
              <div className="field"><label>Destino</label><input type="text" name="sDestino" value={socio.sDestino} onChange={sChange}/></div>
            </div>
          </div>
        )}

        {tab === 'historial' && (
          <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin:'0 0 16px', color:T.txt }}>Historial de Proformas (en Base de Datos)</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {dbHistorial.map(p => (
                <div key={p.id} style={{ padding:12, background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{fontWeight:600, color:T.txt}}>{p.numero}</div>
                    <div style={{fontSize:12, color:T.mute}}>{p.cliente_nombre} · {p.cliente_empresa} · {new Date(p.fecha_emision).toLocaleDateString()}</div>
                  </div>
                  <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <div style={{fontWeight:700, color:T.AMB}}>${Number(p.total_usd).toFixed(2)}</div>
                    <button onClick={() => cargarHistorial(p)} style={{padding:'4px 8px', background:T.ambDim, color:T.AMB, border:'none', borderRadius:4, cursor:'pointer', fontSize:11}}>Cargar</button>
                    <button onClick={() => borrarProforma(p.id)} style={{padding:'4px 8px', background:T.redDim, color:T.RED, border:'none', borderRadius:4, cursor:'pointer', fontSize:11}}>Borrar</button>
                  </div>
                </div>
              ))}
              {dbHistorial.length === 0 && <div style={{textAlign:'center', color:T.mute, padding:20}}>No hay proformas en la base de datos.</div>}
            </div>
          </div>
        )}

      </div>

      {/* Columna Derecha (Resumen/Vista Móvil) */}
      <div style={{ width: 340, display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ background: T.card, border: `1px solid ${T.AMB}44`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin:'0 0 16px', color:T.txt, fontSize:15 }}>Resumen de Cotización</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span>Subtotal</span><span style={{fontWeight:600}}>${resData.subtotal?.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span>IVA ({params.iva}%)</span><span style={{fontWeight:600}}>${resData.ivaAmt?.toFixed(2)}</span></div>
            <div style={{ borderTop:`1px solid ${T.bdr2}`, margin:'8px 0' }}></div>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.AMB, fontSize:16, fontWeight:700 }}>
              <span>Total USD</span><span>${resData.total?.toFixed(2)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}>
              <span>Total CRC</span><span>₡{Math.round(resData.totalCRC || 0).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={generarPDF} style={{
            width:'100%', padding:'12px', background:T.AMB, color:'#000', border:'none', borderRadius:8, fontWeight:600, marginTop:20, cursor:'pointer'
          }}>
            Generar Proforma PDF
          </button>
        </div>

      </div>
      
    </div>
  );
}
