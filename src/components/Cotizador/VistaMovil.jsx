import React from 'react';
import { T } from '../../App';

export default function VistaMovil({ params, socio, resData, vehiculo }) {
  const vIco = "🚐"; // Se puede abstraer

  const fmt = (v) => v != null ? `$${v.toFixed(2)}` : '$0.00';

  return (
    <div style={{
      width: '100%', maxWidth: 340, height: 600, background: '#fff', 
      borderRadius: 36, border: '8px solid #111', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', color: '#111827',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
    }}>
      {/* Top Bar Movil */}
      <div style={{ background: '#f8fafc', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
        <span>TransOp</span>
        <span>{new Date().toLocaleTimeString('es-CR', {hour:'2-digit', minute:'2-digit'})}</span>
      </div>

      {/* Header Modal */}
      <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
        <h2 style={{ margin:0, fontSize: 18, color: '#0f172a' }}>Proforma de transporte</h2>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          {socio.cfNumero} · {new Date().toLocaleDateString('es-CR')}
        </div>
      </div>

      {/* Cuerpecito (Scroll) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc' }}>
        
        {/* Unidad */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>Unidad asignada</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#eff6ff', border: '1px solid #bfdbfe', padding: 12, borderRadius: 8 }}>
            <span style={{ fontSize: 24 }}>{vIco}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>{vehiculo?.marca} {vehiculo?.modelo}</div>
              <div style={{ fontSize: 12, color: '#2563eb' }}>Capacidad: {vehiculo?.cap} pax</div>
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>Cliente</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{socio.sNombre || '—'}</div>
          {socio.sEmpresa && <div style={{ fontSize: 12, color: '#64748b' }}>{socio.sEmpresa}</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {socio.sOrigen && socio.sDestino && (
              <span style={{ fontSize: 10, background: '#e2e8f0', padding: '4px 8px', borderRadius: 12, fontWeight: 600 }}>{socio.sOrigen} ➔ {socio.sDestino}</span>
            )}
            {socio.sFecha && (
              <span style={{ fontSize: 10, background: '#f1f5f9', padding: '4px 8px', borderRadius: 12, fontWeight: 600 }}>{socio.sFecha}</span>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>Desglose</div>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span>Subtotal</span><span>{fmt(resData.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span>IVA ({params.iva}%)</span><span>{fmt(resData.ivaAmt)}</span>
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              <span>Total</span><span>{fmt(resData.total)}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
