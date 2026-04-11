import React from 'react';
import { T } from '../../App';
import { Clock, MapPin, Calendar, Users, Info } from 'lucide-react';

export default function VistaMovil({ params, socio, resData, vehiculo, franjasDia, logoData, empresaConfig }) {
  const vIco = vehiculo?.tipo === 'Bus' ? "🚌" : "🚐";

  const fmt = (v) => v != null ? `$${v.toFixed(2)}` : '$0.00';

  return (
    <div style={{
      width: '100%', maxWidth: 380, height: 680, background: '#f1f5f9', 
      borderRadius: 40, border: '12px solid #1e293b', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', color: '#1e293b',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative',
      margin: '0 auto'
    }}>
      {/* Notch / Speaker */}
      <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:120, height:25, background:'#1e293b', borderBottomLeftRadius:15, borderBottomRightRadius:15, zIndex:10 }}></div>

      {/* Top Bar Movil */}
      <div style={{ background: '#fff', padding: '16px 20px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, alignItems:'center' }}>
        <span style={{ color: '#64748b' }}>TransOp</span>
        <span>{new Date().toLocaleTimeString('es-CR', {hour:'2-digit', minute:'2-digit'})}</span>
      </div>

      {/* App Header */}
      <div style={{ background: '#fff', padding: '10px 20px 20px', borderBottom: '1px solid #e2e8f0', display:'flex', alignItems:'center', gap:12 }}>
         <div style={{ width:40, height:40, borderRadius:8, background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #cbd5e1' }}>
            {logoData ? <img src={logoData} style={{ maxWidth:'80%', maxHeight:'80%' }} /> : <Info size={20} color="#94a3b8" />}
         </div>
         <div>
            <h2 style={{ margin:0, fontSize: 16, fontWeight: 800 }}>{empresaConfig?.nombre || 'TransOp'}</h2>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight:600 }}>Proforma {socio.cfNumero}</div>
         </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display:'flex', flexDirection:'column', gap:20 }}>
        
        {/* Card Cliente */}
        <div style={{ background:'#fff', borderRadius:16, padding:16, border:'1px solid #e2e8f0' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom:10 }}>Información de Viaje</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Users size={14} color="#3b82f6" />
                    <span style={{ fontSize:13, fontWeight:700 }}>{socio.sNombre || 'Cliente Estimado'}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Calendar size={14} color="#3b82f6" />
                    <span style={{ fontSize:12, color:'#475569' }}>{socio.sFecha || 'Sin fecha set'} · {socio.sHora || '--:--'}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, background: '#f8fafc', padding:'8px 12px', borderRadius:10 }}>
                    <MapPin size={14} color="#ef4444" />
                    <span style={{ fontSize:12, fontWeight:600 }}>{socio.sOrigen || 'Origen'} ➔ {socio.sDestino || 'Destino'}</span>
                </div>
            </div>
        </div>

        {/* Card Unidad */}
        <div style={{ background:'linear-gradient(135deg, #1e3a8a, #1d4ed8)', borderRadius:16, padding:16, color:'#fff' }}>
           <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                   <div style={{ fontSize:10, fontWeight:700, opacity:0.8, textTransform:'uppercase' }}>Vehículo Seleccionado</div>
                   <div style={{ fontSize:18, fontWeight:800 }}>{vehiculo?.marca || 'Unidad'} {vehiculo?.modelo || ''}</div>
                   <div style={{ fontSize:12, opacity:0.9 }}>{vehiculo?.capacidad_pasajeros || '--'} asientos · {vehiculo?.placa || 'TMS-000'}</div>
                </div>
                <span style={{ fontSize:40 }}>{vIco}</span>
           </div>
        </div>

        {/* Itinerario Timeline */}
        <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={12} /> Itinerario Propuesto
            </div>
            <div style={{ display:'flex', flexDirection:'column', paddingLeft:10 }}>
                {franjasDia?.map((f, i) => (
                    <div key={i} style={{ position:'relative', paddingLeft:20, paddingBottom:20 }}>
                        {/* Linea vertical */}
                        {i < franjasDia.length - 1 && <div style={{ position:'absolute', left:0, top:16, bottom:0, width:2, background:'#cbd5e1' }}></div>}
                        {/* Punto */}
                        <div style={{ position:'absolute', left:-4, top:4, width:10, height:10, borderRadius:'50%', background:'#3b82f6', border:'2px solid #fff' }}></div>
                        
                        <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6' }}>{f.hora}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{f.actividad}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{f.detalle}</div>
                    </div>
                ))}
            </div>
        </div>

        {/* Totales */}
        <div style={{ background:'#fff', borderRadius:16, padding:16, border:'1px solid #e2e8f0', marginTop:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:12 }}>
                <span style={{ color:'#64748b' }}>Subtotal</span>
                <span style={{ fontWeight:700 }}>{fmt(resData.subtotal)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, fontSize:12 }}>
                <span style={{ color:'#64748b' }}>IVA ({params.iva}%)</span>
                <span style={{ fontWeight:700 }}>{fmt(resData.ivaAmt)}</span>
            </div>
            <div style={{ height:1, background:'#f1f5f9', marginBottom:12 }}></div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                   <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', fontWeight:800 }}>Total Proforma</div>
                   <div style={{ fontSize:22, fontWeight:800, color:'#1e3a8a' }}>{fmt(resData.total)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                   <div style={{ fontSize:10, color:'#64748b' }}>TC: {params.tc}</div>
                   <div style={{ fontSize:12, fontWeight:700, color:'#475569' }}>₡{Math.round(resData.totalCRC || 0).toLocaleString()}</div>
                </div>
            </div>
        </div>

      </div>

      {/* Bottom Buttons Mock */}
      <div style={{ padding:'12px 20px 24px', background:'#fff', borderTop:'1px solid #e2e8f0', display:'flex', gap:10 }}>
         <button style={{ flex:1, padding:'14px', borderRadius:14, background:'#3b82f6', color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' }}>Aceptar Servicio</button>
      </div>

    </div>
  );
}
