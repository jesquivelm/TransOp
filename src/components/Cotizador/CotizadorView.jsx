import React, { useState, useEffect } from 'react';
import { Settings, User, Bus, Smartphone, FileText, ChevronRight, Plus, Trash2, Image as ImageIcon, LayoutDashboard, Clock, CheckCircle, X } from 'lucide-react';
import { T } from '../../App'; 
import { useAuth } from '../../context/AuthContext';
import { pdfGen } from '../../utils/pdfGenerator';
import VistaMovil from './VistaMovil';

export default function CotizadorView({ vehiculos, socios, refreshSocios, empresaConfig, logoData }) {
  const { token } = useAuth();
  const [view, setView] = useState('list'); // 'list' or 'editor'
  const [editorMode, setEditorMode] = useState('new'); // 'new', 'edit', 'duplicate'
  const [tab, setTab] = useState('calc');
  const [subTab, setSubTab] = useState('s1');
  const [itinTab, setItinTab] = useState('list');
  const [modalStatus, setModalStatus] = useState(null); // Para finalizar proforma
  const [motivoRechazo, setMotivo] = useState('Presupuesto');

  // 1. ESTADOS DE DATOS
  const [vehiculoActivo, setVehiculoActivo] = useState(null);
  const [dbVehiculos, setDbVehiculos] = useState([]);
  const [dbHistorial, setDbHistorial] = useState([]);

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
  const INITIAL_SOCIO = {
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
    sDestino: '',
    socioId: '',
    saveAsSocio: false
  };

  const [socio, setSocio] = useState(INITIAL_SOCIO);

  // Itinerario (Franjas del día)
  const [franjasDia, setFranjasDia] = useState([
    { hora: '05:00 - 06:00', actividad: 'Preparación', detalle: 'Revisión unidad y documentos' },
    { hora: '06:00 - 07:00', actividad: 'Recogida', detalle: 'Punto de salida acordado' },
    { hora: '07:00 - 12:00', actividad: 'Traslado principal', detalle: 'Recorrido hacia el destino' },
    { hora: '12:00 - 13:00', actividad: 'Almuerzo / descanso', detalle: 'Parada programada' }
  ]);

  const [resData, setResData] = useState({});

  // 2. EFECTOS E INICIALIZACIÓN
  useEffect(() => {
    if (token) fetchInitialData();
  }, [token]);

  const fetchInitialData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [vRes, hRes] = await Promise.all([
        fetch('/api/tms/vehiculos', { headers }),
        fetch('/api/tms/proformas', { headers })
      ]);
      
      const vData = await vRes.json();
      setDbVehiculos(vData);
      if (vData.length > 0) setVehiculoActivo(vData[0].id);

      const hData = await hRes.json();
      setDbHistorial(hData.sort((a,b) => new Date(b.fecha_emision) - new Date(a.fecha_emision)));
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
    const { name, value, type, checked } = e.target;
    setSocio(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const generarPDF = async () => {
    const u = dbVehiculos.find(v => v.id === vehiculoActivo);
    
    try {
        const res = await fetch('/api/tms/proformas', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                numero: socio.cfNumero,
                cliente_nombre: socio.sNombre,
                cliente_empresa: socio.sNombre,
                total_usd: resData.total,
                socio_id: socio.socioId,
                save_as_socio: socio.saveAsSocio,
                data_json: { params, socio, franjasDia, resData, vehiculoId: vehiculoActivo, empresaConfig }
            })
        });
        if (res.ok) {
            if (socio.saveAsSocio && refreshSocios) refreshSocios();
            fetchInitialData();
            alert("Proforma guardada correctamente");
        }
    } catch (err) { console.error("Error saving proforma", err); }

    pdfGen({
      params, socio, resData, vehiculo: u, logoData, franjasDia, empresaConfig
    });
  };

  const cargarHistorial = (p, mode = 'edit') => {
    if (p.data_json) {
      setParams(p.data_json.params);
      setSocio(p.data_json.socio);
      if (p.data_json.franjasDia) setFranjasDia(p.data_json.franjasDia);
      if (p.data_json.vehiculoId) setVehiculoActivo(p.data_json.vehiculoId);
      
      if (mode === 'duplicate') {
        setSocio(prev => ({ ...prev, cfNumero: 'PRO-' + Math.floor(1000 + Math.random() * 9000) }));
        setEditorMode('duplicate');
      } else {
        setEditorMode('edit');
      }
      setView('editor');
    }
  };

  const nuevoClick = () => {
    setParams({ ...params, km: 0, diasGAM: 0, diasSM: 0, noches: 0 });
    setSocio({ ...INITIAL_SOCIO, cfNumero: 'PRO-' + Math.floor(1000 + Math.random() * 9000) });
    setEditorMode('new');
    setView('editor');
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

  const patchStatus = async (id, status, motivo = '') => {
    try {
      const res = await fetch(`/api/tms/proforma/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, motivo_rechazo: motivo })
      });
      if (res.ok) {
        setModalStatus(null);
        fetchInitialData();
      }
    } catch (err) { console.error("Error patching status", err); }
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
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      
      {view === 'list' ? (
        <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <div>
              <h2 style={{ margin:0, fontSize:22, fontWeight:700, color:T.txt }}>Gestión de Proformas</h2>
              <p style={{ margin:'4px 0 0', color:T.mute, fontSize:13 }}>Historial de cotizaciones emitidas (orden descendente)</p>
            </div>
            <button onClick={nuevoClick} style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 20px', background:T.AMB, color:'#000', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:14 }}>
              <Plus size={18} /> Nueva Cotización
            </button>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.bdr2}`, textAlign:'left' }}>
                  {['No. Proforma', 'Cliente', 'Destino', 'Monto (USD)', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={{ padding:'12px 8px', fontSize:11, fontWeight:600, color:T.mute, letterSpacing:1, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbHistorial.map(p => (
                  <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}`, transition:'background .2s' }}>
                    <td style={{ padding:'16px 8px' }}>
                      <div style={{ fontWeight:700, color:T.txt }}>{p.numero}</div>
                      <div style={{ fontSize:10, color:T.mute }}>{new Date(p.fecha_emision).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding:'16px 8px', fontSize:13, color:T.sub }}>{p.cliente_nombre || '---'}</td>
                    <td style={{ padding:'16px 8px', fontSize:13, color:T.sub }}>{p.data_json?.socio?.sDestino || '---'}</td>
                    <td style={{ padding:'16px 8px', fontWeight:700, color:T.AMB }}>${Number(p.total_usd).toFixed(2)}</td>
                    <td style={{ padding:'16px 8px' }}><StatusBadge status={p.estado} /></td>
                    <td style={{ padding:'16px 8px' }}>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => cargarHistorial(p, 'edit')} title="Editar / Ver" style={{ p:6, background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:6, color:T.sub, cursor:'pointer' }}><FileText size={14}/></button>
                        <button onClick={() => cargarHistorial(p, 'duplicate')} title="Duplicar" style={{ p:6, background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:6, color:T.sub, cursor:'pointer' }}><ImageIcon size={14}/></button>
                        {p.estado === 'pendiente' && (
                          <button onClick={() => setModalStatus(p)} title="Finalizar" style={{ p:6, background:T.grnDim, border:`1px solid ${T.GRN}33`, borderRadius:6, color:T.GRN, cursor:'pointer' }}><CheckCircle size={14}/></button>
                        )}
                        <button onClick={() => borrarProforma(p.id)} title="Borrar" style={{ p:6, background:T.redDim, border:`1px solid ${T.RED}33`, borderRadius:6, color:T.RED, cursor:'pointer' }}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {dbHistorial.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.mute, fontSize:14 }}>No se encontraron proformas guardadas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* POP-OVER / EDITOR MODAL MOCKED AS A FULL PAGE VIEW FOR NOW */
        <div style={{ position:'fixed', inset:0, background:T.card, zIndex:100, overflowY:'auto', display:'flex', flexDirection:'column' }}>
           <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 28px', borderBottom:`1px solid ${T.bdr}`, background:T.card2 }}>
              <div>
                <span style={{ fontSize:10, color:T.mute, fontWeight:700 }}>{editorMode.toUpperCase()}</span>
                <h2 style={{ margin:0, fontSize:18, color:T.txt }}>Cotización {socio.cfNumero}</h2>
              </div>
              <button onClick={()=>setView('list')} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${T.bdr}`, background:T.card3, color:T.sub, cursor:'pointer' }}>Cerrar Editor</button>
           </div>
           
           <div style={{ padding:28, display:'flex', gap:28 }}>
              {/* Columna Editor */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
                 <div style={{ display:'flex', borderBottom:`1px solid ${T.bdr}`, overflowX:'auto' }}>
                    <TabBtn id="calc" label="Cálculo" icon={FileText} active={tab==='calc'} onClick={()=>setTab('calc')} />
                    <TabBtn id="socio" label="Cliente" icon={User} active={tab==='socio'} onClick={()=>setTab('socio')} />
                    <TabBtn id="itin" label="Itinerario" icon={Clock} active={tab==='itin'} onClick={()=>setTab('itin')} />
                    <TabBtn id="movil" label="Móvil" icon={Smartphone} active={tab==='movil'} onClick={()=>setTab('movil')} />
                 </div>
                 
                 <div style={{ minHeight:500 }}>
                   {tab === 'calc' && (
                     /* Existing Calc UI Content */
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
                             <div className="field"><label>Tipo de cambio ₡/$</label><input type="number" name="tc" value={params.tc} onChange={pChange}/></div>
                           </div>
                           <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
                             <div className="field"><label>Colaborador ($)</label><input type="number" name="colaborador" value={params.colaborador} onChange={pChange}/></div>
                             <div className="field"><label>Peajes ($)</label><input type="number" name="peajes" value={params.peajes} onChange={pChange}/></div>
                             <div className="field"><label>Utilidad ($)</label><input type="number" name="utilidad" value={params.utilidad} onChange={pChange}/></div>
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
                             <div className="chk-row"><input type="checkbox" name="ckTinSJ" checked={params.ckTinSJ} onChange={pChange}/><label>T. In SJ</label></div>
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
                         <div className="field">
                           <label style={{fontSize:10, color:T.mute}}>Buscar / Seleccionar Socio Guardado</label>
                           <select 
                             style={{width:'100%', padding:'12px', background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:10, color:T.txt, fontSize:14}}
                             value={socio.socioId}
                             onChange={(e) => {
                               const s = socios.find(x => x.id === e.target.value);
                               if (s) setSocio(prev => ({ ...prev, socioId: s.id, sNombre: s.nombre, sCedula: s.cedula || '' }));
                               else setSocio(prev => ({ ...prev, socioId: '', sNombre: '', sCedula: '' }));
                             }}
                           >
                             <option value="">-- Nuevo Cliente (No guardado) --</option>
                             {socios.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.cedula || ''})</option>)}
                           </select>
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
                   
                   {tab === 'itin' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                         <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                           <h3 style={{ margin:0, color:T.txt, fontSize: 16 }}>Cronograma del Servicio</h3>
                           <button onClick={() => setFranjasDia([...franjasDia, { hora:'', actividad:'', detalle:'' }])} style={{ padding:'8px 16px', background:T.ambDim, color:T.AMB, border:`1px dashed ${T.AMB}44`, borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Actividad</button>
                         </div>
                         {franjasDia.map((f, i) => (
                           <div key={i} style={{ display:'grid', gridTemplateColumns:'150px 1fr 1fr auto', gap:12, alignItems:'flex-start', background:T.card2, padding:12, borderRadius:10, border:`1px solid ${T.bdr}` }}>
                             <input type="text" value={f.hora} onChange={(e)=>{ const n=[...franjasDia]; n[i].hora=e.target.value; setFranjasDia(n); }} placeholder="Hora" style={{fontSize:12, padding:6}}/>
                             <input type="text" value={f.actividad} onChange={(e)=>{ const n=[...franjasDia]; n[i].actividad=e.target.value; setFranjasDia(n); }} placeholder="Actividad" style={{fontSize:12, padding:6}}/>
                             <input type="text" value={f.detalle} onChange={(e)=>{ const n=[...franjasDia]; n[i].detalle=e.target.value; setFranjasDia(n); }} placeholder="Detalle" style={{fontSize:12, padding:6}}/>
                             <button onClick={() => setFranjasDia(franjasDia.filter((_, idx)=>idx!==i))} style={{ color:T.RED, background:'transparent', border:'none', cursor:'pointer' }}><Trash2 size={16}/></button>
                           </div>
                         ))}
                      </div>
                   )}
                   
                   {tab === 'movil' && <VistaMovil params={params} socio={socio} resData={resData} vehiculo={dbVehiculos.find(v=>v.id===vehiculoActivo)} franjasDia={franjasDia} empresaConfig={empresaConfig} logoData={logoData} />}
                 </div>
              </div>

              {/* Sidebar de Totales en el Modal */}
              <div style={{ width: 340, display:'flex', flexDirection:'column', gap:16 }}>
                 <div style={{ background: T.card2, border: `1px solid ${T.AMB}44`, borderRadius: 14, padding: 24 }}>
                   <h3 style={{ margin:'0 0 20px', color:T.txt, fontSize:16, fontWeight:700 }}>Resumen Ejecutivo</h3>
                   <div style={{ display:'flex', flexDirection:'column', gap:12, fontSize:14 }}>
                     <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}><span>Base</span><span>${resData.base?.toFixed(2)}</span></div>
                     <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}><span>Tarifas</span><span>${resData.tarFijas?.toFixed(2)}</span></div>
                     <div style={{ display:'flex', justifyContent:'space-between', color:T.sub }}><span>Extras</span><span>${resData.extras?.toFixed(2)}</span></div>
                     <div style={{ height:1, background:T.bdr2, margin:'6px 0' }}></div>
                     <div style={{ display:'flex', justifyContent:'space-between', color:T.AMB, fontSize:20, fontWeight:800 }}>
                       <span>TOTAL USD</span><span>${resData.total?.toFixed(2)}</span>
                     </div>
                     <div style={{ fontSize:12, color:T.mute, textAlign:'right' }}>₡{Math.round(resData.totalCRC || 0).toLocaleString()}</div>
                   </div>
                   <button onClick={generarPDF} style={{ width:'100%', padding:'14px', background:T.AMB, color:'#000', border:'none', borderRadius:10, fontWeight:700, marginTop:24, cursor:'pointer', fontSize:14 }}>
                     GUARDAR Y GENERAR PDF
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal Status (Aprobar/Rechazar) */}
      {modalStatus && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:T.card, borderRadius:16, width:'100%', maxWidth:400, padding:28 }}>
            <h3 style={{ margin:0, color:T.txt, marginBottom:20 }}>Finalizar Proforma {modalStatus.numero}</h3>
            <div style={{ display:'grid', gap:12 }}>
               <button onClick={() => patchStatus(modalStatus.id, 'aprobada')} style={{ padding:14, borderRadius:10, background:T.GRN, color:'#000', border:'none', fontWeight:700, cursor:'pointer' }}>✅ APROBADA</button>
               <div style={{ height:1, background:T.bdr2, margin:'10px 0' }}></div>
               <select value={motivoRechazo} onChange={e => setMotivo(e.target.value)} style={{ padding:10, background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:8, color:T.txt }}>
                  <option>Presupuesto</option>
                  <option>Tiempo / Disponibilidad</option>
                  <option>Competencia</option>
                  <option>Cancelación Cliente</option>
                  <option>Otro</option>
               </select>
               <button onClick={() => patchStatus(modalStatus.id, 'rechazada', motivoRechazo)} style={{ padding:14, borderRadius:10, background:T.RED, color:'#fff', border:'none', fontWeight:700, cursor:'pointer' }}>❌ RECHAZADA</button>
            </div>
            <button onClick={() => setModalStatus(null)} style={{ width:'100%', marginTop:20, padding:10, background:'transparent', border:'none', color:T.mute, cursor:'pointer', fontSize:13 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    pendiente: { color: T.ORG, bg: T.orgDim, icon: Clock },
    aprobada:  { color: T.GRN, bg: T.grnDim, icon: FileText },
    rechazada: { color: T.RED, bg: T.redDim, icon: X }
  }[status] || { color: T.sub, bg: T.card2, icon: Clock };
  const Icon = cfg.icon;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:12, background:cfg.bg, color:cfg.color, fontSize:10, fontWeight:700 }}>
      <Icon size={12} /> {status.toUpperCase()}
    </div>
  );
}

const Calculator = FileText;
const XCircle = X;
const HelpCircle = FileText;
