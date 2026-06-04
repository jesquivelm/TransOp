const DEFAULT_PROFORMA_OPTIONS = {
  showRoute: true,
  showPassengers: true,
  showUnits: true,
  showDrivers: true,
  showUnitImages: true,
  showUnitPlate: true,
  showUnitName: true,
  showDriverPhone: true,
  showDriverCedula: true,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeOptions(rawOptions = {}) {
  return {
    ...DEFAULT_PROFORMA_OPTIONS,
    ...(rawOptions && typeof rawOptions === 'object' ? rawOptions : {}),
  };
}

function cleanText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function resolveAssetUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (typeof window !== 'undefined' && raw.startsWith('/')) return `${window.location.origin}${raw}`;
  return raw;
}

function formatDateLong(value) {
  if (!value) return 'Por confirmar';
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function getDisplayAmount(value, currency = 'CRC', params = {}) {
  const amount = Number(value) || 0;
  const crcPerUsd = Number(params.tc) || 512;
  return currency === 'USD' ? amount / crcPerUsd : amount;
}

function formatMoney(value, currency = 'CRC', params = {}) {
  const amount = getDisplayAmount(value, currency, params);
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDurationLabel(seconds) {
  const totalMinutes = Math.round(Number(seconds || 0) / 60);
  if (!totalMinutes) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} h ${minutes} min`;
  if (hours) return `${hours} h`;
  return `${minutes} min`;
}

function vehicleLabel(vehicle = {}, unit = {}) {
  const model = [vehicle.marca, vehicle.modelo].filter(Boolean).join(' ');
  return cleanText(unit.vehiculoLabel || model || vehicle.tipo, 'Unidad por asignar');
}

function getVehicle(unit = {}, vehiculos = []) {
  return vehiculos.find(item => item.id === unit.vehiculoId) || null;
}

function getDriver(unit = {}, vehicle = {}, conductores = []) {
  const ids = [unit.condId, unit.conductorId, vehicle?.condId, vehicle?.conductorId, vehicle?.conductor_asignado_id].filter(Boolean);
  return conductores.find(item => ids.includes(item.id)) || null;
}

function unitSubtotal(unit = {}) {
  const km = Number(unit.km || 0);
  const fuelPrice = Number(unit.precioCombustibleLitro || 0);
  const rendimiento = Number(unit.rendimiento || 0);
  const fuelCost = rendimiento > 0 ? km * (fuelPrice / rendimiento) : Number(unit.combustible || 0);
  return fuelCost
    + Number(unit.colaborador || 0)
    + (unit.cobrarPeajes === false ? 0 : Number(unit.peajes || 0))
    + (unit.cobrarCarga === false ? 0 : Number(unit.carga || 0))
    + (unit.cobrarFerry === false ? 0 : Number(unit.ferry || 0));
}

function routeDaysForUnit(unit = {}, socio = {}) {
  const days = Array.isArray(unit.itineraryDays) ? unit.itineraryDays : [];
  if (days.length) {
    return days.map((day, index) => {
      const rows = Array.isArray(day.rows) ? day.rows : [];
      const salida = rows.find(row => row.tipo === 'salida') || rows[0] || {};
      const destino = rows.find(row => row.tipo === 'destino') || rows[Math.max(0, rows.length - 2)] || {};
      const regreso = [...rows].reverse().find(row => row.tipo === 'regreso') || {};
      return {
        label: days.length > 1 ? `Día ${index + 1}` : 'Servicio',
        fecha: day.fecha || unit.sFecha || socio.sFecha || '',
        salida: cleanText(salida.lugar || unit.sOrigen || socio.sOrigen, 'Por confirmar'),
        destino: cleanText(destino.lugar || unit.sDestino || socio.sDestino, 'Por confirmar'),
        regreso: cleanText(regreso.lugar || unit.sRegreso || socio.sRegreso || socio.sOrigen, 'Por confirmar'),
        horaSalida: salida.hora || unit.sHora || socio.sHora || '',
        horaDestino: destino.hora || '',
        horaRegreso: regreso.hora || unit.sHoraRegreso || '',
      };
    });
  }

  return [{
    label: 'Servicio',
    fecha: unit.sFecha || socio.sFecha || '',
    salida: cleanText(unit.sOrigen || socio.sOrigen, 'Por confirmar'),
    destino: cleanText(unit.sDestino || socio.sDestino, 'Por confirmar'),
    regreso: cleanText(unit.sRegreso || socio.sRegreso || socio.sOrigen, 'Por confirmar'),
    horaSalida: unit.sHora || socio.sHora || '',
    horaDestino: '',
    horaRegreso: unit.sHoraRegreso || '',
  }];
}

function routeHtml(unit = {}, socio = {}) {
  return routeDaysForUnit(unit, socio).map(day => `
    <div class="route-day">
      <div class="route-date">${escapeHtml(day.label)} · ${escapeHtml(formatDateLong(day.fecha))}</div>
      <div><strong>Salida:</strong> ${escapeHtml(day.salida)}${day.horaSalida ? ` · ${escapeHtml(day.horaSalida)}` : ''}</div>
      <div><strong>Destino:</strong> ${escapeHtml(day.destino)}${day.horaDestino ? ` · ${escapeHtml(day.horaDestino)}` : ''}</div>
      <div><strong>Regreso:</strong> ${escapeHtml(day.regreso)}${day.horaRegreso ? ` · ${escapeHtml(day.horaRegreso)}` : ''}</div>
    </div>
  `).join('');
}

function footerItems(config = {}) {
  return [
    config.telefono || config.tel || '',
    config.email || config.correo || '',
    config.direccion || '',
    config.web || config.website || config.sitio || '',
  ].filter(Boolean);
}

function defaultTerms(config = {}) {
  return cleanText(
    config.proforma_terms || config.terminos || config.terminos_condiciones,
    'Precios sujetos a disponibilidad al momento de confirmar. La reserva se formaliza según las condiciones de pago indicadas y la confirmación escrita del cliente.'
  );
}

function serviceDescription(socio = {}) {
  return cleanText(
    socio.cfDescripcion,
    'Servicio de transporte privado según las condiciones comerciales detalladas en esta propuesta.'
  );
}

export function pdfGen({
  params = {},
  socio = {},
  resData = {},
  config = {},
  seller = null,
  units = [],
  vehiculos = [],
  conductores = [],
  proformaComments = '',
  proformaTerms = '',
  proformaOptions = {},
}) {
  const options = normalizeOptions(proformaOptions);
  const displayCurrency = socio.cfMoneda || 'CRC';
  const companyName = cleanText(config.nombre, 'Transportes Miguel');
  const logoUrl = resolveAssetUrl(config.logo);
  const logoScale = Math.max(0.6, Math.min(2.2, Number(config.logo_scale || 1)));
  const proformaNumber = cleanText(socio.cfNumero, 'PF-PENDIENTE');
  const now = new Date();
  const validUntil = addDays(now, Number(socio.cfValidez || 15));
  const serviceDate = units.find(unit => unit.sFecha)?.sFecha || socio.sFecha || '';
  const safeUnits = units.length ? units : [{}];
  const subtotal = Number(resData.subtotal ?? resData.subtotalOperativo ?? 0);
  const discount = Number(resData.descuentoAmt || 0);
  const tax = Number(resData.ivaAmt || 0);
  const total = Number(resData.total ?? (subtotal - discount + tax));
  const footer = footerItems(config);
  const sellerName = cleanText(seller?.nombre || seller?.name || seller?.username || config.contacto_nombre, 'Ejecutivo comercial');
  const sellerPhone = cleanText(seller?.telefono || seller?.tel || config.telefono || config.tel, '');
  const sellerEmail = cleanText(seller?.email || seller?.correo || config.email || config.correo, '');
  const clientLines = [
    cleanText(socio.sEmpresa || socio.sNombre, 'Cliente por confirmar'),
    socio.sContacto ? `Contacto: ${socio.sContacto}${socio.sCargo ? ` · ${socio.sCargo}` : ''}` : '',
    socio.sTel ? `Teléfono: ${socio.sTel}` : '',
    socio.sEmail ? `Correo: ${socio.sEmail}` : '',
    socio.sCedula ? `Identificación: ${socio.sCedula}` : '',
    socio.sDireccion ? `Dirección: ${socio.sDireccion}` : '',
    socio.sNotas ? `Observaciones: ${socio.sNotas}` : '',
  ].filter(Boolean);

  const columns = [
    options.showRoute ? { key: 'route', label: 'Itinerario', width: '36%' } : null,
    options.showPassengers ? { key: 'passengers', label: 'Pasajeros', width: '12%' } : null,
    options.showUnits ? { key: 'unit', label: 'Unidades', width: '21%' } : null,
    options.showDrivers ? { key: 'driver', label: 'Conductores', width: '18%' } : null,
    { key: 'subtotal', label: 'Subtotal', width: '13%' },
  ].filter(Boolean);
  const columnWidthTotal = columns.reduce((sum, column) => sum + Number.parseFloat(column.width), 0) || 100;
  const tableColgroup = columns
    .map(column => `<col style="width:${((Number.parseFloat(column.width) / columnWidthTotal) * 100).toFixed(2)}%">`)
    .join('');

  const tableRows = safeUnits.map((unit, index) => {
    const vehicle = getVehicle(unit, vehiculos);
    const driver = getDriver(unit, vehicle, conductores);
    const driverParts = [
      cleanText(driver?.nombre || unit.conductorNombre, 'Por asignar'),
      options.showDriverPhone && (driver?.tel || driver?.telefono) ? `Tel. ${driver.tel || driver.telefono}` : '',
      options.showDriverCedula && driver?.cedula ? `Céd. ${driver.cedula}` : '',
    ].filter(Boolean);
    const unitParts = [
      options.showUnitName ? vehicleLabel(vehicle || {}, unit) : '',
      options.showUnitPlate && vehicle?.placa ? `Placa ${vehicle.placa}` : '',
      vehicle?.cap ? `${vehicle.cap} pax` : '',
    ].filter(Boolean);
    const cells = {
      route: `<td>${routeHtml(unit, socio)}</td>`,
      passengers: `<td class="center">${escapeHtml(unit.sPax || socio.sPax || 'Por confirmar')}</td>`,
      unit: `<td>${escapeHtml(unitParts.join(' · ') || `Unidad ${index + 1}`)}</td>`,
      driver: `<td>${escapeHtml(driverParts.join(' · '))}</td>`,
      subtotal: `<td class="money">${escapeHtml(formatMoney(unitSubtotal(unit), displayCurrency, params))}</td>`,
    };
    return `<tr>${columns.map(column => cells[column.key]).join('')}</tr>`;
  }).join('');

  const unitCards = options.showUnits ? safeUnits.map((unit, index) => {
    const vehicle = getVehicle(unit, vehiculos);
    const driver = getDriver(unit, vehicle, conductores);
    const imageUrl = resolveAssetUrl(vehicle?.foto_url);
    return `
      <article class="unit-card${options.showUnitImages ? '' : ' no-image'}">
        ${options.showUnitImages ? `
          <div class="unit-image">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(vehicleLabel(vehicle || {}, unit))}">` : '<span>Sin imagen</span>'}
          </div>` : ''}
        <div class="unit-copy">
          <div class="unit-title">${escapeHtml(options.showUnitName ? vehicleLabel(vehicle || {}, unit) : `Unidad ${index + 1}`)}</div>
          <div class="unit-meta">
            ${options.showUnitPlate && vehicle?.placa ? `<span>Placa ${escapeHtml(vehicle.placa)}</span>` : ''}
            ${vehicle?.cap ? `<span>${escapeHtml(vehicle.cap)} pasajeros</span>` : ''}
            ${vehicle?.tipo ? `<span>${escapeHtml(vehicle.tipo)}</span>` : ''}
          </div>
          ${options.showDrivers ? `<div class="unit-driver">Conductor: ${escapeHtml(driver?.nombre || unit.conductorNombre || 'Por asignar')}</div>` : ''}
        </div>
      </article>
    `;
  }).join('') : '';

  const driverCards = options.showDrivers ? safeUnits.map((unit, index) => {
    const vehicle = getVehicle(unit, vehiculos);
    const driver = getDriver(unit, vehicle, conductores);
    return `
      <div class="driver-row">
        <span>Unidad ${index + 1}</span>
        <strong>${escapeHtml(driver?.nombre || unit.conductorNombre || 'Por asignar')}</strong>
        ${options.showDriverPhone && (driver?.tel || driver?.telefono) ? `<span>${escapeHtml(driver.tel || driver.telefono)}</span>` : ''}
        ${options.showDriverCedula && driver?.cedula ? `<span>Céd. ${escapeHtml(driver.cedula)}</span>` : ''}
      </div>
    `;
  }).join('') : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${typeof window !== 'undefined' ? `${window.location.origin}/` : ''}">
  <title>Proforma ${escapeHtml(proformaNumber)}</title>
  <style>
    :root {
      --ink: #1F2937;
      --muted: #6B7280;
      --line: #E5E7EB;
      --green: #14532D;
      --bar: #8BC34A;
      --soft: #F8FAFC;
      --shadow: 0 12px 32px rgba(15, 23, 42, 0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #F3F4F6;
      color: var(--ink);
      font-family: Calibri, "Carlito", "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.42;
    }
    .sheet {
      width: 8.5in;
      min-height: 11in;
      margin: 24px auto;
      padding: 44px 46px 34px;
      background: #fff;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 260px;
      gap: 28px;
      align-items: start;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }
    .brand-logo {
      width: 180px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin-bottom: 8px;
    }
    .brand-logo img {
      max-width: ${Math.round(180 * logoScale)}px;
      max-height: ${Math.round(80 * logoScale)}px;
      object-fit: contain;
    }
    .brand-placeholder {
      font-size: 26px;
      font-weight: 800;
      color: var(--green);
    }
    .company { font-size: 18px; font-weight: 800; margin-top: 4px; }
    .subtitle { font-size: 13px; font-weight: 700; color: var(--green); margin-top: 2px; }
    .doc-word { font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 800; letter-spacing: .7px; }
    .doc-panel { text-align: right; }
    .doc-title { font-size: 28px; font-weight: 800; color: var(--green); line-height: 1; }
    .doc-id { font-size: 15px; font-weight: 800; margin: 6px 0 14px; }
    .meta-line { display: flex; justify-content: flex-end; gap: 8px; color: var(--muted); margin-top: 4px; }
    .meta-line strong { color: var(--ink); font-weight: 700; }
    .grid-two {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 250px;
      gap: 16px;
    }
    .box {
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
      background: #fff;
      overflow: hidden;
      break-inside: avoid;
    }
    .box-head {
      background: var(--bar);
      color: #0F2A16;
      font-size: 12px;
      font-weight: 800;
      padding: 8px 12px;
      text-transform: uppercase;
      letter-spacing: .25px;
    }
    .box-body { padding: 11px 12px; }
    .client-lines div { margin-bottom: 4px; color: var(--muted); }
    .client-lines div:first-child { color: var(--ink); font-weight: 800; font-size: 14px; }
    .description { color: var(--muted); margin-top: 8px; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      break-inside: auto;
    }
    thead { display: table-header-group; }
    th {
      background: var(--bar);
      color: #0F2A16;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .2px;
      padding: 9px 8px;
      text-align: left;
      border-right: 1px solid rgba(20, 83, 45, .16);
    }
    th:last-child { border-right: none; text-align: right; }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      overflow-wrap: anywhere;
      color: var(--ink);
    }
    tbody tr { break-inside: avoid; }
    .center { text-align: center; }
    .money { text-align: right; white-space: nowrap; font-weight: 800; color: var(--green); }
    .route-day + .route-day { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }
    .route-date { color: var(--green); font-weight: 800; margin-bottom: 3px; }
    .unit-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .unit-card {
      display: grid;
      grid-template-columns: 118px minmax(0, 1fr);
      gap: 12px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      break-inside: avoid;
    }
    .unit-card.no-image { grid-template-columns: 1fr; }
    .unit-image {
      height: 86px;
      border-radius: 7px;
      background: var(--soft);
      border: 1px solid var(--line);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 11px;
    }
    .unit-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .unit-title { font-size: 14px; font-weight: 800; color: var(--ink); margin-bottom: 6px; }
    .unit-meta { display: flex; flex-wrap: wrap; gap: 6px 10px; color: var(--muted); font-size: 11px; }
    .unit-driver { margin-top: 8px; color: var(--green); font-weight: 700; }
    .financial {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 260px;
      gap: 16px;
      align-items: start;
    }
    .summary { padding: 12px 14px; }
    .summary-row { display: flex; justify-content: space-between; gap: 20px; padding: 5px 0; color: var(--muted); }
    .summary-row strong { color: var(--ink); }
    .total-row {
      margin-top: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      color: var(--green);
      font-size: 18px;
      font-weight: 900;
    }
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .text-block { white-space: pre-wrap; color: var(--muted); }
    .driver-list { display: flex; flex-direction: column; gap: 6px; }
    .driver-row {
      display: grid;
      grid-template-columns: 70px minmax(0, 1fr) auto auto;
      gap: 10px;
      padding: 7px 0;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
    }
    .driver-row:last-child { border-bottom: none; }
    .driver-row strong { color: var(--ink); }
    .footer {
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      color: var(--muted);
      font-size: 11px;
      justify-content: center;
    }
    @page { size: Letter; margin: 0; }
    @media print {
      body { background: #fff; }
      .sheet {
        width: auto;
        min-height: 11in;
        margin: 0;
        padding: 38px 42px 28px;
        box-shadow: none;
      }
      .box, .unit-card, .financial, .notes-grid { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div>
        <div class="brand-logo">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}">` : `<div class="brand-placeholder">${escapeHtml(companyName)}</div>`}
        </div>
        <div class="company">${escapeHtml(companyName)}</div>
        <div class="subtitle">Propuesta Comercial</div>
        <div class="doc-word">Proforma</div>
      </div>
      <div class="doc-panel">
        <div class="doc-title">Proforma</div>
        <div class="doc-id">${escapeHtml(proformaNumber)}</div>
        <div class="meta-line"><span>Emitida:</span><strong>${escapeHtml(formatDateLong(now))}</strong></div>
        <div class="meta-line"><span>Válida hasta:</span><strong>${escapeHtml(formatDateLong(validUntil))}</strong></div>
        <div class="meta-line"><span>Servicio:</span><strong>${escapeHtml(formatDateLong(serviceDate))}</strong></div>
        <div class="meta-line"><span>Ejecutivo:</span><strong>${escapeHtml(sellerName)}</strong></div>
        ${sellerPhone ? `<div class="meta-line"><span>Teléfono:</span><strong>${escapeHtml(sellerPhone)}</strong></div>` : ''}
        ${sellerEmail ? `<div class="meta-line"><span>Correo:</span><strong>${escapeHtml(sellerEmail)}</strong></div>` : ''}
      </div>
    </header>

    <section class="grid-two">
      <div class="box">
        <div class="box-head">Cliente</div>
        <div class="box-body client-lines">
          ${clientLines.map(line => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      </div>
      <div class="box">
        <div class="box-head">Fechas</div>
        <div class="box-body">
          <div><strong>Emisión:</strong> ${escapeHtml(formatDateLong(now))}</div>
          <div><strong>Validez:</strong> ${escapeHtml(formatDateLong(validUntil))}</div>
          <div><strong>Servicio:</strong> ${escapeHtml(formatDateLong(serviceDate))}</div>
        </div>
      </div>
    </section>

    <section class="box">
      <div class="box-head">Detalle de la cotización</div>
      <div class="box-body">
        <table>
          <colgroup>
            ${tableColgroup}
          </colgroup>
          <thead>
            <tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="description">${escapeHtml(serviceDescription(socio))}</div>
      </div>
    </section>

    ${unitCards ? `<section class="unit-grid">${unitCards}</section>` : ''}

    <section class="financial">
      <div class="box">
        <div class="box-head">Resumen del servicio</div>
        <div class="box-body text-block">
${escapeHtml(`Pasajeros: ${socio.sPax || 'Por confirmar'}
Unidades: ${safeUnits.length}
Distancia estimada: ${Math.round(safeUnits.reduce((sum, unit) => sum + Number(unit.km || 0), 0))} km
Tiempo estimado: ${formatDurationLabel(safeUnits.reduce((sum, unit) => {
  const secondsFromDays = (unit.itineraryDays || []).reduce((daySum, day) => daySum + (day.rows || []).reduce((rowSum, row) => rowSum + Number(row.durationMin || 0) * 60, 0), 0);
  return sum + secondsFromDays;
}, 0))}`)}
        </div>
      </div>
      <div class="box summary">
        <div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(subtotal, displayCurrency, params))}</strong></div>
        ${discount > 0 ? `<div class="summary-row"><span>Descuento</span><strong>-${escapeHtml(formatMoney(discount, displayCurrency, params))}</strong></div>` : ''}
        <div class="summary-row"><span>Impuestos (${escapeHtml(params.iva || 0)}%)</span><strong>${escapeHtml(formatMoney(tax, displayCurrency, params))}</strong></div>
        <div class="total-row"><span>Total</span><span>${escapeHtml(formatMoney(total, displayCurrency, params))}</span></div>
      </div>
    </section>

    <section class="notes-grid">
      <div class="box">
        <div class="box-head">Comentarios</div>
        <div class="box-body text-block">${escapeHtml(cleanText(proformaComments, 'Sin comentarios adicionales.'))}</div>
      </div>
      <div class="box">
        <div class="box-head">Términos y condiciones</div>
        <div class="box-body text-block">${escapeHtml(cleanText(proformaTerms, defaultTerms(config)))}</div>
      </div>
    </section>

    ${driverCards ? `
      <section class="box">
        <div class="box-head">Conductores</div>
        <div class="box-body driver-list">${driverCards}</div>
      </section>` : ''}

    <footer class="footer">
      ${footer.map(item => `<span>${escapeHtml(item)}</span>`).join('<span>·</span>')}
    </footer>
  </main>
  <script>
    window.onload = function() {
      window.requestAnimationFrame(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      });
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=740,scrollbars=yes');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio e intenta de nuevo.');
    return;
  }

  win.document.write(html);
  win.document.close();
}
