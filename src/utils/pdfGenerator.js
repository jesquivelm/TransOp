/**
 * pdfGenerator.js
 * Genera una proforma profesional en HTML y lanza el diálogo de impresión/PDF.
 * No requiere librerías externas — funciona en cualquier navegador moderno.
 */

export function pdfGen({ params, socio, resData, vehiculo, config = {} }) {
  const fmt    = (v) => v != null ? `$${Number(v).toFixed(2)}` : '$0.00';
  const fmtCRC = (v) => v != null ? `₡${Math.round(v).toLocaleString('es-CR')}` : '₡0';

  // ── Datos de empresa (de config global) ──────────────────────────────────
  const nombre   = config.nombre    || 'TransOP S.A.';
  const telefono = config.telefono  || '+506 0000-0000';
  const email    = config.email     || 'info@transop.cr';
  const logoUrl  = config.logo_url  || '';
  const color    = config.color     || '#f59e0b';
  const colorDark= config.colorDark || '#0f172a';

  // ── Fechas ────────────────────────────────────────────────────────────────
  const hoy    = new Date();
  const fechaEmision = hoy.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
  const fechaVence   = new Date(hoy.getTime() + (Number(socio.cfValidez) || 15) * 86400000)
    .toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Filas del desglose ────────────────────────────────────────────────────
  const rows = [
    { label: `Combustible (${params.km} km × $${params.combustible}/km)`, val: resData.costoKm },
    { label: 'Colaborador',                   val: params.colaborador },
    { label: 'Peajes',                        val: params.peajes      },
    { label: 'Viáticos',                      val: params.viaticos    },
    params.ferry > 0   ? { label: 'Ferry',    val: params.ferry }     : null,
    params.utilidad > 0? { label: 'Utilidad', val: params.utilidad }  : null,
    params.chkDia      ? { label: 'Adicional colaborador (día)',        val: params.adicCol } : null,
    params.chkDia      ? { label: 'Adicional viáticos (día)',           val: params.adicViat }: null,
    params.diasGAM > 0 ? { label: `Tarifa GAM (${params.diasGAM} días × $${params.tarifaGAM})`, val: params.diasGAM * params.tarifaGAM } : null,
    params.diasSM  > 0 ? { label: `Media tarifa sin mov. (${params.diasSM} días)`, val: params.diasSM * params.mediaTarifa } : null,
    params.ckTinSJ     ? { label: 'Transfer IN Aeropuerto SJO',         val: params.tInSJ  } : null,
    params.ckToutSJ    ? { label: 'Transfer OUT Aeropuerto SJO',        val: params.tOutSJ } : null,
    params.ckTinCTG    ? { label: 'Transfer IN Aeropuerto Cartago',     val: params.tInCTG } : null,
    params.ckToutCTG   ? { label: 'Transfer OUT Aeropuerto Cartago',    val: params.tOutCTG} : null,
    params.noches > 0  ? { label: `Hospedaje (${params.noches} noches × $${params.hospedaje})`, val: params.noches * params.hospedaje } : null,
    params.persViat > 0 && params.viatDiario > 0 ? { label: `Viáticos diarios (${params.persViat} persona/s)`, val: params.viatDiario * params.persViat } : null,
  ].filter(Boolean);

  const vehiculoTipo = vehiculo?.tipo === 'Bus' ? '🚌' : '🚐';

  // ── HTML del documento ────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Proforma ${socio.cfNumero}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 36px 44px;
      max-width: 820px;
      margin: 0 auto;
      font-size: 13px;
      line-height: 1.5;
    }

    /* ── Header ─────────────────────────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      margin-bottom: 28px;
      border-bottom: 3px solid ${color};
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo {
      width: 54px; height: 54px; background: ${color};
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      font-size: 26px; flex-shrink: 0;
    }
    .brand-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 12px; }
    .brand-name { font-size: 22px; font-weight: 800; color: ${colorDark}; line-height: 1; }
    .brand-contact { font-size: 11px; color: #64748b; margin-top: 4px; }

    .proforma-id { text-align: right; }
    .proforma-num { font-size: 24px; font-weight: 800; color: ${color}; letter-spacing: -.5px; }
    .meta-row { margin-top: 8px; }
    .meta-lbl { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; }
    .meta-val { font-size: 12px; color: #334155; font-weight: 600; }

    /* ── Section ─────────────────────────────────────── */
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 10px; font-weight: 700; color: ${color};
      text-transform: uppercase; letter-spacing: .8px;
      padding-bottom: 7px; margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .field-lbl { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 2px; }
    .field-val { font-size: 12px; color: #1e293b; font-weight: 500; }

    /* ── Vehicle ─────────────────────────────────────── */
    .vehicle-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .vehicle-ico { font-size: 32px; flex-shrink: 0; }
    .vehicle-img { width: 80px; height: 56px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
    .vehicle-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .vehicle-sub { font-size: 11px; color: #64748b; margin-top: 2px; }

    /* ── Table ───────────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: ${colorDark}; color: #fff;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; padding: 9px 14px; text-align: left;
    }
    th.right, td.right { text-align: right; }
    td { padding: 8px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }
    td.amount { font-weight: 600; color: #1e293b; }

    .sub-row td { border-top: 2px solid #e2e8f0; font-weight: 700; color: #0f172a; background: #f1f5f9; }
    .iva-row td { color: #64748b; }
    .total-row td {
      background: ${colorDark}; color: #fff;
      font-size: 14px; font-weight: 800;
      padding: 12px 14px; border: none;
    }
    .total-amt { color: ${color}; }

    /* ── Terms ───────────────────────────────────────── */
    .terms {
      background: #f8fafc; border-radius: 10px;
      padding: 14px 18px; font-size: 11px; color: #64748b; line-height: 1.7;
    }
    .terms strong { color: #334155; }

    /* ── Signature area ──────────────────────────────── */
    .sig-area {
      display: flex; justify-content: space-between; gap: 40px;
      margin-top: 40px; padding-top: 20px;
    }
    .sig-box { flex: 1; text-align: center; }
    .sig-line { border-top: 1px solid #94a3b8; margin-bottom: 8px; padding-top: 8px; }
    .sig-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }

    /* ── Footer ──────────────────────────────────────── */
    .footer {
      margin-top: 28px; padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between;
      font-size: 10px; color: #94a3b8;
    }

    /* ── Print ───────────────────────────────────────── */
    @media print {
      body { padding: 0; max-width: 100%; }
      @page { margin: 1.2cm 1.5cm; size: A4 portrait; }
    }
  </style>
</head>
<body>

  <!-- ═══ HEADER ═══════════════════════════════════════════════════ -->
  <div class="header">
    <div class="brand">
      <div class="brand-logo">
        ${logoUrl
          ? `<img src="${logoUrl}" alt="${nombre}">`
          : vehiculoTipo
        }
      </div>
      <div>
        <div class="brand-name">${nombre}</div>
        <div class="brand-contact">${telefono} &nbsp;·&nbsp; ${email}</div>
      </div>
    </div>
    <div class="proforma-id">
      <div class="proforma-num">${socio.cfNumero}</div>
      <div class="meta-row">
        <div class="meta-lbl">Fecha de emisión</div>
        <div class="meta-val">${fechaEmision}</div>
      </div>
      <div class="meta-row" style="margin-top:6px">
        <div class="meta-lbl">Válida hasta</div>
        <div class="meta-val">${fechaVence}</div>
      </div>
    </div>
  </div>

  <!-- ═══ VEHÍCULO ══════════════════════════════════════════════════ -->
  ${vehiculo ? `
  <div class="section">
    <div class="section-title">Unidad de Transporte</div>
    <div class="vehicle-box">
      ${vehiculo.img_url
        ? `<img class="vehicle-img" src="${vehiculo.img_url}" alt="${vehiculo.marca} ${vehiculo.modelo}">`
        : `<div class="vehicle-ico">${vehiculoTipo}</div>`
      }
      <div>
        <div class="vehicle-name">${vehiculo.marca} ${vehiculo.modelo}</div>
        <div class="vehicle-sub">
          Capacidad: ${vehiculo.cap || vehiculo.capacidad_pasajeros || '—'} pasajeros
          &nbsp;·&nbsp; Placa: ${vehiculo.placa}
          &nbsp;·&nbsp; Combustible: ${vehiculo.combustible_tipo || 'Diésel'}
        </div>
      </div>
    </div>
  </div>` : ''}

  <!-- ═══ CLIENTE ═══════════════════════════════════════════════════ -->
  <div class="section">
    <div class="section-title">Datos del Cliente</div>
    <div class="grid2">
      <div>
        <div class="field-lbl">Nombre completo</div>
        <div class="field-val">${socio.sNombre || '—'}</div>
      </div>
      <div>
        <div class="field-lbl">Empresa</div>
        <div class="field-val">${socio.sEmpresa || '—'}</div>
      </div>
      <div>
        <div class="field-lbl">Email</div>
        <div class="field-val">${socio.sEmail || '—'}</div>
      </div>
      <div>
        <div class="field-lbl">Teléfono</div>
        <div class="field-val">${socio.sTel || '—'}</div>
      </div>
    </div>
  </div>

  <!-- ═══ SERVICIO ══════════════════════════════════════════════════ -->
  <div class="section">
    <div class="section-title">Detalle del Servicio</div>
    <div class="grid3">
      <div>
        <div class="field-lbl">Pasajeros</div>
        <div class="field-val">${socio.sPax || '1'}</div>
      </div>
      <div>
        <div class="field-lbl">Fecha del servicio</div>
        <div class="field-val">${socio.sFecha ? new Date(socio.sFecha + 'T12:00:00').toLocaleDateString('es-CR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</div>
      </div>
      <div>
        <div class="field-lbl">Hora</div>
        <div class="field-val">${socio.sHora || '—'}</div>
      </div>
      <div>
        <div class="field-lbl">Origen</div>
        <div class="field-val">${socio.sOrigen || '—'}</div>
      </div>
      <div>
        <div class="field-lbl">Destino</div>
        <div class="field-val">${socio.sDestino || '—'}</div>
      </div>
    </div>
    ${socio.cfDescripcion ? `
    <div style="margin-top:14px">
      <div class="field-lbl">Descripción del servicio</div>
      <div class="field-val" style="margin-top:4px;line-height:1.6">${socio.cfDescripcion}</div>
    </div>` : ''}
  </div>

  <!-- ═══ DESGLOSE ══════════════════════════════════════════════════ -->
  <div class="section">
    <div class="section-title">Desglose de Costos</div>
    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th class="right">Monto (USD)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
        <tr>
          <td>${r.label}</td>
          <td class="right amount">${fmt(r.val)}</td>
        </tr>`).join('')}
        <tr class="sub-row">
          <td>Subtotal</td>
          <td class="right">${fmt(resData.subtotal)}</td>
        </tr>
        <tr class="iva-row">
          <td>IVA (${params.iva}%)</td>
          <td class="right">${fmt(resData.ivaAmt)}</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="right total-amt">
            ${fmt(resData.total)}<br>
            <span style="font-size:10px;opacity:.75;font-weight:400">${fmtCRC(resData.totalCRC)}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══ CONDICIONES ═══════════════════════════════════════════════ -->
  <div class="section">
    <div class="section-title">Condiciones</div>
    <div class="terms">
      <strong>Forma de pago:</strong> ${socio.cfPago || '50% adelanto, 50% al cierre'}<br>
      <strong>Validez:</strong> ${socio.cfValidez || 15} días calendario a partir de la fecha de emisión (hasta ${fechaVence}).<br>
      <strong>Tipo de cambio referencial:</strong> ₡${params.tc || 520} por dólar americano (USD).<br>
      Esta proforma no constituye un contrato vinculante hasta ser formalmente aceptada por el cliente mediante firma o confirmación escrita.
      Los precios pueden variar si las condiciones del servicio cambian.
    </div>
  </div>

  <!-- ═══ FIRMAS ════════════════════════════════════════════════════ -->
  <div class="sig-area">
    <div class="sig-box">
      <div style="height:50px"></div>
      <div class="sig-line"></div>
      <div class="sig-lbl">Firma del cliente</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">${socio.sNombre || '____________________'}</div>
    </div>
    <div class="sig-box">
      <div style="height:50px"></div>
      <div class="sig-line"></div>
      <div class="sig-lbl">Representante ${nombre}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">____________________</div>
    </div>
  </div>

  <!-- ═══ FOOTER ════════════════════════════════════════════════════ -->
  <div class="footer">
    <span>${nombre} &nbsp;·&nbsp; ${email} &nbsp;·&nbsp; ${telefono}</span>
    <span>${socio.cfNumero} &nbsp;·&nbsp; ${fechaEmision}</span>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

  // Abrir en ventana nueva y disparar impresión
  const win = window.open('', '_blank', 'width=960,height=740,scrollbars=yes');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Por favor, permite pop-ups para este sitio y vuelve a intentarlo.');
    return;
  }
  win.document.write(html);
  win.document.close();
}