import React, { useState, useEffect } from 'react';
import { Settings, User, Bus, Smartphone, FileText, ChevronRight, Plus, Trash2, Image as ImageIcon, LayoutDashboard, Clock } from 'lucide-react';
import { T } from '../../App'; 
import { useAuth } from '../../context/AuthContext';
import { pdfGen } from '../../utils/pdfGenerator';
import VistaMovil from './VistaMovil';

export default function CotizadorView({ vehiculos, onSave, historial }) {
  const { token } = useAuth();
  const [tab, setTab] = useState('calc');
  const [subTab, setSubTab] = useState('s1');
  const [configTab, setConfigTab] = useState('empresa');

  // 1. ESTADOS DE DATOS
  const [vehiculoActivo, setVehiculoActivo] = useState(null);
  const [dbVehiculos, setDbVehiculos] = useState([]);
  const [dbHistorial, setDbHistorial] = useState([]);
  const [logoData, setLogoData] = useState(localStorage.getItem('transop_logo') || null);

  // Parámetros de cálculo
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
    cfNumero: 'PRO-' + Math.floor(1000 + Math.random() * 9000),
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

  // Itinerario (Franjas del día)
  const [franjasDia, setFranjasDia] = useState([
    { hora: '05:00 - 06:00', actividad: 'Preparación', detalle: 'Revisión unidad y documentos' },
    { hora: '06:00 - 07:00', actividad: 'Recogida', detalle: 'Punto de salida acordado' },
    { hora: '07:00 - 12:00', actividad: 'Traslado principal', detalle: 'Recorrido hacia el destino' },
    { hora: '12:00 - 13:00', actividad: 'Almuerzo / descanso', detalle: 'Parada programada' }
  ]);

  // Configuración de empresa
  const [empresaConfig, setEmpresaConfig] = useState({
    nombre: 'Transportes Miguel',
    tel: '+506 8000-0000',
    email: 'info@transop.com',
    web: 'www.transop.com',
    cedJur: '3-101-000000',
    pais: 'San José, Costa Rica',
    dir: 'San José Centro',
    tituloPDF: 'PROFORMA DE SERVICIO DE TRANSPORTE',
    terminos: 'Esta proforma tiene validez por los días indicados. Los precios están sujetos a cambio sin previo aviso. El servicio se confirma con el pago del adelanto acordado. Cancelación con menos de 24 horas: se cobra el 50% del servicio.',
    nota: ''
  });

  const [resData, setResData] = useState({});

  // 2. EFECTOS E INICIALIZACIÓN
  useEffect(() => {
    if (token) fetchInitialData();
  }, [token]);

  const fetchInitialData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [vRes, hRes, cRes] = await Promise.all([
        fetch('/api/tms/vehiculos', { headers }),
        fetch('/api/tms/proformas', { headers }),
        fetch('/api/tms/config/global', { headers })
      ]);
      
      const vData = await vRes.json();
      setDbVehiculos(vData);
      if (vData.length > 0) setVehiculoActivo(vData[0].id);

      const hData = await hRes.json();
      setDbHistorial(hData);

      const cData = await cRes.json();
      if (cData && cData.empresa) setEmpresaConfig(prev => ({ ...prev, ...cData.empresa }));
      if (cData && cData.franjas_base) setFranjasDia(cData.franjas_base);
    } catch (err) {
      console.error("Error fetching initial data", err);
    }
  };

  // Sincronizar parámetros al cambiar vehículo
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
        adic_col: Number(v.adic_col) || prev.adic_col,
        adic_viat: Number(v.adic_viat) || prev.adic_viat,
        tarifa_gam: Number(v.tarifa_gam) || prev.tarifa_gam,
        media_tarifa: Number(v.media_tarifa) || prev.media_tarifa,
        t_in_sj: Number(v.t_in_sj) || prev.t_in_sj,
        t_out_sj: Number(v.t_out_sj) || prev.t_out_sj,
        t_in_ctg: Number(v.t_in_ctg) || prev.t_in_ctg,
        t_out_ctg: Number(v.t_out_ctg) || prev.t_out_ctg,
        hospedaje: Number(v.hospedaje) || prev.hospedaje,
        viatDiario: Number(v.viatico_diario) || prev.viatDiario,
      }));
    }
  }, [vehiculoActivo, dbVehiculos]);

  // Cálculo de totales
  useEffect(() => {
    const p = params;
    const costoKm = p.km * p.combustible;
    let base = costoKm + p.colaborador + p.peajes + p.viaticos + p.ferry + p.utilidad;
    if (p.chkDia) base += (p.adic_col || 15) + (p.adic_viat || 15);
    
    const tIn1 = p.ckTinSJ ? (p.t_in_sj || 50) : 0;
    const tOut1 = p.ckToutSJ ? (p.t_out_sj || 45) : 0;
    const tIn2 = p.ckTinCTG ? (p.t_in_ctg || 65) : 0;
    const tOut2 = p.ckToutCTG ? (p.t_out_ctg || 60) : 0;
    
    const tarFijas = (p.diasGAM * (p.tarifa_gam || 150)) + (p.diasSM * (p.media_tarifa || 75)) + tIn1 + tOut1 + tIn2 + tOut2;
    const extras = (p.noches * (p.hospedaje || 40)) + (p.viatDiario * p.persViat);
    
    const subtotal = base + tarFijas + extras;
    const ivaAmt = subtotal * (p.iva / 100);
    const total = subtotal + ivaAmt;
    const totalCRC = total * p.tc;

    setResData({
      costoKm, base, tarFijas, extras, subtotal, ivaAmt, total, totalCRC
    });
  }, [params]);

  // 3. HANDLERS
  const pChange = (e) => {
    const { name, value, type, checked } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'tipoCombustible' ? value : Number(value))
    }));
  };

  const sChange = (e) => {
    const { name, value } = e.target;
    setSocio(prev => ({ ...prev, [name]: value }));
  };

  const cChange = (e) => {
    const { name, value } = e.target;
    setEmpresaConfig(prev => ({ ...prev, [name]: value }));
  };

  const franjaChange = (index, field, value) => {
    const newFranjas = [...franjasDia];
    newFranjas[index][field] = value;
    setFranjasDia(newFranjas);
  };

  const addFranja = () => setFranjasDia([...franjasDia, { hora: '00:00 - 00:00', actividad: '', detalle: '' }]);
  const removeFranja = (index) => setFranjasDia(franjasDia.filter((_, i) => i !== index));

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoData(event.target.result);
        localStorage.setItem('transop_logo', event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const generarPDF = async () => {
    const u = dbVehiculos.find(v => v.id === vehiculoActivo);
    
    // Guardar en la base de datos
    try {
      await fetch('/api/tms/proformas', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          numero: socio.cfNumero,
          cliente_nombre: socio.sNombre,
          cliente_empresa: socio.sEmpresa,
          total_usd: resData.total,
          data_json: { params, socio, vehiculoId: vehiculoActivo, franjasDia, empresaConfig }
        })
      });
      fetchInitialData(); 
    } catch (err) { console.error("Error saving proforma", err); }

    pdfGen({
      params, socio, resData, vehiculo: u, logoData, franjasDia, empresaConfig
    });
  };

  const cargarHistorial = (p) => {
    if (p.data_json) {
      setParams(p.data_json.params);
      setSocio(p.data_json.socio);
      if (p.data_json.franjasDia) setFranjasDia(p.data_json.franjasDia);
      if (p.data_json.vehiculoId) setVehiculoActivo(p.data_json.vehiculoId);
      setTab('calc');
    }
  };

  const borrarProforma = async (id) => {
    if (!confirm("¿Eliminar esta proforma?")) return;
    try {
      await fetch(`/api/tms/proformas/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDbHistorial(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error("Error deleting proforma", err); }
  };

  // 4. COMPONENTES UI
  const TabBtn = ({ id, label, icon: Icon, active, onClick }) => (
    <button onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:8, padding:'10px 16px', border:'none', cursor:'pointer', background:'transparent',
        borderBottom: `2px solid ${active ? T.AMB : 'transparent'}`,
        color: active ? T.AMB : T.sub, fontWeight: active ? 600 : 400, fontSize: 13
      }}>
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div style={{ display:'flex', gap:24, alignItems:'flex-start' }}>
      
      {/* Columna Principal */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
        
        {/* Navegación del Módulo */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.bdr}`, overflowX:'auto' }}>
          <TabBtn id="calc" label="Cotización" icon={FileText} active={tab==='calc'} onClick={()=>setTab('calc')} />
          <TabBtn id="socio" label="Datos del cliente" icon={User} active={tab==='socio'} onClick={()=>setTab('socio')} />
          <TabBtn id="movil" label="Vista Móvil" icon={Smartphone} active={tab==='movil'} onClick={()=>setTab('movil')} />
          <TabBtn id="hist" label="Historial" icon={Clock} active={tab==='hist'} onClick={()=>setTab('hist')} />
          <TabBtn id="config" label="Configuración" icon={Settings} active={tab==='config'} onClick={()=>setTab('config')} />
        </div>

        {/* CONTENIDO DE PESTAÑAS */}
        <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24, minHeight: 500 }}>
          
          {tab === 'calc' && (
            <div>
              <h3 style={{ margin:'0 0 16px', color:T.txt, fontSize: 16 }}>Unidad de Transporte</h3>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:24 }}>
                {dbVehiculos.map(v => (
                  <div key={v.id} onClick={() => setVehiculoActivo(v.id)}
                    style={{
                      padding:'12px', border:`2px solid ${vehiculoActivo === v.id ? T.AMB : T.bdr}`, borderRadius:10,
                      cursor:'pointer', background: vehiculoActivo === v.id ? T.ambDim : 'transparent', 
                      width: 140, textAlign:'center', transition: 'all 0.2s'
                     }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{v.tipo === 'Bus' ? '🚌' : '🚐'}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.txt }}>{v.marca || 'N/A'} {v.modelo || ''}</div>
                    <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>{v.capacidad_pasajeros} pax · {v.placa}</div>
                  </div>
                ))}
                {dbVehiculos.length === 0 && <div style={{color:T.mute, fontSize:13}}>No hay unidades configuradas en la base de datos.</div>}
              </div>

              <div style={{ display:'flex', gap:6, marginBottom:20 }}>
                {[['s1','Base'], ['s2','Fijas'], ['s3','Noches']].map(([id, label]) => (
                  <button key={id} onClick={() => setSubTab(id)}
                    style={{
                      padding:'6px 14px', borderRadius:20, border:`1px solid ${subTab === id ? T.AMB : T.bdr2}`,
                      background: subTab === id ? T.AMB : 'transparent', color: subTab === id ? '#000' : T.sub,
                      cursor:'pointer', fontSize:12, fontWeight:600
                    }}>{label}</button>
                ))}
              </div>

              {subTab === 's1' && (
                <div style={{ display:'grid', gap:16 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
                    <div className="field"><label>Kilómetros</label><input type="number" name="km" value={params.km} onChange={pChange}/></div>
                    <div className="field"><label>Costo combustible/km</label><input type="number" name="combustible" step="0.01" value={params.combustible} onChange={pChange}/></div>
                    <div className="field"><label>T/C ₡/$</label><input type="number" name="tc" value={params.tc} onChange={pChange}/></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
                    <div className="field"><label>Colaborador ($)</label><input type="number" name="colaborador" value={params.colaborador} onChange={pChange}/></div>
                    <div className="field"><label>Peajes ($)</label><input type="number" name="peajes" value={params.peajes} onChange={pChange}/></div>
                    <div className="field"><label>Utilidad ($)</label><input type="number" name="utilidad" value={params.utilidad} onChange={pChange}/></div>
                  </div>
                  <div className="chk-row">
                    <input type="checkbox" name="chkDia" checked={params.chkDia} onChange={pChange}/>
                    <label>Incluir adicionales viaje de un día (${(params.adic_col || 15) + (params.adic_viat || 15)})</label>
                  </div>
                </div>
              )}

              {subTab === 's2' && (
                <div style={{ display:'grid', gap:20 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <div className="field"><label>Tarifa GAM ($)</label><input type="number" name="tarifa_gam" value={params.tarifa_gam || 150} onChange={pChange}/></div>
                    <div className="field"><label>Días GAM</label><input type="number" name="diasGAM" value={params.diasGAM} onChange={pChange}/></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
                    <div className="chk-row"><input type="checkbox" name="ckThinSJ" checked={params.ckTinSJ} onChange={pChange}/><label>T. In SJ</label></div>
                    <div className="chk-row"><input type="checkbox" name="ckToutSJ" checked={params.ckToutSJ} onChange={pChange}/><label>T. Out SJ</label></div>
                    <div className="chk-row"><input type="checkbox" name="ckTinCTG" checked={params.ckTinCTG} onChange={pChange}/><label>T. In CTG</label></div>
                    <div className="chk-row"><input type="checkbox" name="ckToutCTG" checked={params.ckToutCTG} onChange={pChange}/><label>T. Out CTG</label></div>
                  </div>
                </div>
              )}

              {subTab === 's3' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16 }}>
                  <div className="field"><label>Hospedaje/noche ($)</label><input type="number" name="hospedaje" value={params.hospedaje || 40} onChange={pChange}/></div>
                  <div className="field"><label>Noches</label><input type="number" name="noches" value={params.noches} onChange={pChange}/></div>
                  <div className="field"><label>Viático diario/pax ($)</label><input type="number" name="viatDiario" value={params.viatDiario} onChange={pChange}/></div>
                  <div className="field"><label>Personas</label><input type="number" name="persViat" value={params.persViat} onChange={pChange}/></div>
                </div>
              )}
            </div>
          )}

          {tab === 'socio' && (
            <div style={{ display:'grid', gap:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="field"><label>Proforma No.</label><input type="text" name="cfNumero" value={socio.cfNumero} onChange={sChange}/></div>
                <div className="field"><label>Válida (días)</label><input type="number" name="cfValidez" value={socio.cfValidez} onChange={sChange}/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="field"><label>Nombre Cliente / Empresa</label><input type="text" name="sNombre" value={socio.sNombre} placeholder="Ej: John Doe" onChange={sChange}/></div>
                <div className="field"><label>Identificación</label><input type="text" name="sCedula" value={socio.sCedula} onChange={sChange}/></div>
              </div>
              <div className="field"><label>Descripción del servicio</label><textarea name="cfDescripcion" rows={3} value={socio.cfDescripcion} placeholder="Ej: Tour a Volcán Poás para 10 personas" onChange={sChange}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div className="field"><label>Fecha</label><input type="date" name="sFecha" value={socio.sFecha} onChange={sChange}/></div>
                <div className="field"><label>Hora recogida</label><input type="time" name="sHora" value={socio.sHora} onChange={sChange}/></div>
                <div className="field"><label>No. Pax</label><input type="number" name="sPax" value={socio.sPax} onChange={sChange}/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="field"><label>Origen</label><input type="text" name="sOrigen" value={socio.sOrigen} onChange={sChange}/></div>
                <div className="field"><label>Destino</label><input type="text" name="sDestino" value={socio.sDestino} onChange={sChange}/></div>
              </div>
            </div>
          )}

          {tab === 'movil' && <VistaMovil params={params} socio={socio} resData={resData} vehiculo={dbVehiculos.find(v=>v.id===vehiculoActivo)} franjasDia={franjasDia} empresaConfig={empresaConfig} logoData={logoData} />}

          {tab === 'hist' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {dbHistorial.map(p => (
                <div key={p.id} style={{ padding:14, background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{fontWeight:700, color:T.txt}}>{p.numero}</div>
                    <div style={{fontSize:12, color:T.mute}}>{p.cliente_nombre || 'S/N'} · {new Date(p.fecha_emision).toLocaleDateString()}</div>
                  </div>
                  <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <div style={{fontWeight:700, color:T.AMB}}>${Number(p.total_usd).toFixed(2)}</div>
                    <button onClick={() => cargarHistorial(p)} style={{padding:'6px 12px', background:T.ambDim, color:T.AMB, border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600}}>Cargar</button>
                    <button onClick={() => borrarProforma(p.id)} style={{color:T.RED, background:'transparent', border:'none', cursor:'pointer'}}><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              {dbHistorial.length === 0 && <div style={{textAlign:'center', color:T.mute, padding:20}}>No hay proformas guardadas.</div>}
            </div>
          )}

          {tab === 'config' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'flex', gap:6, borderBottom:`1px solid ${T.bdr2}`, paddingBottom:10 }}>
                {[['empresa','Empresa'], ['itinerario','Itinerario'], ['textos','Textos PDF']].map(([id, label]) => (
                  <button key={id} onClick={() => setConfigTab(id)}
                    style={{
                      padding:'6px 14px', borderRadius:8, background: configTab === id ? T.ambDim : 'transparent',
                      color: configTab === id ? T.AMB : T.mute, border: 'none', cursor:'pointer', fontSize:13, fontWeight:600
                    }}>{label}</button>
                ))}
              </div>

              {configTab === 'empresa' && (
                <div style={{ display:'grid', gap:20 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                    <div style={{ width:100, height:60, border:`1px dashed ${T.bdr2}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:T.card2 }}>
                      {logoData ? <img src={logoData} style={{ maxWidth:'100%', maxHeight:'100%' }} alt="Logo" /> : <ImageIcon size={24} color={T.mute} />}
                    </div>
                    <div>
                      <input type="file" id="logoInp" style={{display:'none'}} onChange={handleLogoUpload} />
                      <button onClick={()=>document.getElementById('logoInp').click()} style={{ padding:'8px 16px', background:T.ambDim, color:T.AMB, border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>Cambiar Logo</button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <div className="field"><label>Nombre Empresa</label><input type="text" name="nombre" value={empresaConfig.nombre} onChange={cChange}/></div>
                    <div className="field"><label>Teléfono</label><input type="text" name="tel" value={empresaConfig.tel} onChange={cChange}/></div>
                    <div className="field"><label>Email</label><input type="text" name="email" value={empresaConfig.email} onChange={cChange}/></div>
                    <div className="field"><label>Sitio Web</label><input type="text" name="web" value={empresaConfig.web} onChange={cChange}/></div>
                  </div>
                </div>
              )}

              {configTab === 'itinerario' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <p style={{ fontSize:12, color:T.mute }}>Configura el itinerario tipo para las proformas:</p>
                  {franjasDia.map((f, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'150px 1fr 1fr auto', gap:8, alignItems:'end' }}>
                      <div className="field"><label>Horario</label><input type="text" value={f.hora} onChange={(e)=>franjaChange(i, 'hora', e.target.value)}/></div>
                      <div className="field"><label>Actividad</label><input type="text" value={f.actividad} onChange={(e)=>franjaChange(i, 'actividad', e.target.value)}/></div>
                      <div className="field"><label>Detalle</label><input type="text" value={f.detalle} onChange={(e)=>franjaChange(i, 'detalle', e.target.value)}/></div>
                      <button onClick={()=>removeFranja(i)} style={{ color:T.RED, background:'transparent', border:'none', cursor:'pointer', marginBottom:5 }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <button onClick={addFranja} style={{ padding:'10px', background:T.ambDim, color:T.AMB, border:`1px dashed ${T.AMB}44`, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Añadir actividad</button>
                </div>
              )}

              {configTab === 'textos' && (
                <div style={{ display:'grid', gap:16 }}>
                  <div className="field"><label>Título PDF</label><input type="text" name="tituloPDF" value={empresaConfig.tituloPDF} onChange={cChange}/></div>
                  <div className="field"><label>Términos y Condiciones</label><textarea name="terminos" rows={4} value={empresaConfig.terminos} onChange={cChange}/></div>
                  <div className="field"><label>Nota pie de página</label><input type="text" name="nota" value={empresaConfig.nota} onChange={cChange}/></div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Columna Derecha Resultante */}
      <div style={{ width: 340, display:'flex', flexDirection:'column', gap:16, position:'sticky', top: 20 }}>
        <div style={{ background: T.card, border: `1px solid ${T.AMB}44`, borderRadius: 14, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin:'0 0 20px', color:T.txt, fontSize:16, fontWeight:700 }}>Resumen Ejecutivo</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12, fontSize:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}><span>Base Operativa</span><span>${resData.base?.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}><span>Tarifas / Transfers</span><span>${resData.tarFijas?.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}><span>Hospedaje / Viáticos</span><span>${resData.extras?.toFixed(2)}</span></div>
            <div style={{ height:1, background:T.bdr2, margin:'6px 0' }}></div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:600 }}><span>Subtotal</span><span>${resData.subtotal?.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.mute }}><span>IVA ({params.iva}%)</span><span>${resData.ivaAmt?.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', color:T.AMB, fontSize:20, fontWeight:800, marginTop:8 }}>
              <span>TOTAL USD</span><span>${resData.total?.toFixed(2)}</span>
            </div>
            <div style={{ fontSize:12, color:T.mute, textAlign:'right' }}>₡{Math.round(resData.totalCRC || 0).toLocaleString()} (TC {params.tc})</div>
          </div>
          <button onClick={generarPDF} style={{
            width:'100%', padding:'14px', background:T.AMB, color:'#000', border:'none', borderRadius:10, fontWeight:700, marginTop:24, cursor:'pointer', fontSize:14, boxShadow:`0 4px 15px ${T.ambDim}`
          }}>
            GENERAR PROFORMA PDF
          </button>
        </div>
        
        {/* Atajos / Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
           <div style={{ background: T.card2, padding: 12, borderRadius: 10, border: `1px solid ${T.bdr}` }}>
              <div style={{ fontSize:10, color:T.mute, textTransform:'uppercase' }}>Km Ruta</div>
              <div style={{ fontSize:18, fontWeight:700, color:T.txt }}>{params.km} <span style={{fontSize:10, color:T.mute}}>km</span></div>
           </div>
           <div style={{ background: T.card2, padding: 12, borderRadius: 10, border: `1px solid ${T.bdr}` }}>
              <div style={{ fontSize:10, color:T.mute, textTransform:'uppercase' }}>Pasajeros</div>
              <div style={{ fontSize:18, fontWeight:700, color:T.txt }}>{socio.sPax} <span style={{fontSize:10, color:T.mute}}>pax</span></div>
           </div>
        </div>
      </div>
      
    </div>
  );
}
