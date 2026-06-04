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
  showSeller: true,
  // 'totalizada' (default): suma al final con impuestos y total
  // 'itemizada': cada fila muestra subtotal, impuestos y total; sin resumen al final
  tipoProforma: 'totalizada',
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

const SVG_PIN   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;flex-shrink:0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`;
const SVG_FLAG  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;flex-shrink:0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
const SVG_CLOCK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const SVG_BACK  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;flex-shrink:0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`;

function routeHtml(unit = {}, socio = {}) {
  return routeDaysForUnit(unit, socio).map(day => `
    <div class="route-day">
      ${day.fecha ? `<div class="route-date">${escapeHtml(day.label !== 'Servicio' ? day.label + ' · ' : '')}${escapeHtml(formatDateLong(day.fecha))}</div>` : ''}
      <div class="route-row">${SVG_PIN}<span><strong>Salida:</strong> ${escapeHtml(day.salida)}</span>${day.horaSalida ? `<span class="route-time">${SVG_CLOCK}${escapeHtml(day.horaSalida)}</span>` : ''}</div>
      <div class="route-row">${SVG_FLAG}<span><strong>Destino:</strong> ${escapeHtml(day.destino)}</span>${day.horaDestino ? `<span class="route-time">${SVG_CLOCK}${escapeHtml(day.horaDestino)}</span>` : ''}</div>
      <div class="route-row">${SVG_BACK}<span style="color:var(--muted)"><strong style="color:var(--muted)">Regreso:</strong> ${escapeHtml(day.regreso)}</span>${day.horaRegreso ? `<span class="route-time">${SVG_CLOCK}${escapeHtml(day.horaRegreso)}</span>` : ''}</div>
    </div>
  `).join('');
}

function footerItems(config = {}) {
  const items = [];
  const tel = config.telefono || config.tel || '';
  const email = config.email || config.correo || '';
  const dir = config.direccion || '';
  const web = config.web || config.website || config.sitio || '';
  if (tel) items.push({ type: 'tel', value: tel });
  if (email) items.push({ type: 'email', value: email });
  if (dir) items.push({ type: 'dir', value: dir });
  if (web) items.push({ type: 'web', value: web });
  return items;
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

  const tipoProforma = options.tipoProforma || 'totalizada';
  const isItemizada = tipoProforma === 'itemizada';
  const taxRate = Number(params.iva || 0) / 100;

  // Widths adapt based on mode: itemizada needs 3 extra numeric columns
  const columns = isItemizada
    ? [
        options.showRoute      ? { key: 'route',      label: 'Itinerario',   width: '30%' } : null,
        options.showPassengers ? { key: 'passengers',  label: 'Pax',          width: '7%'  } : null,
        options.showUnits      ? { key: 'unit',        label: 'Unidades',     width: '16%' } : null,
        options.showDrivers    ? { key: 'driver',      label: 'Cond.',        width: '13%' } : null,
        { key: 'subtotal',  label: 'Subtotal',   width: '11%' },
        { key: 'impuestos', label: 'Impuestos',  width: '11%' },
        { key: 'total',     label: 'Total',      width: '12%' },
      ].filter(Boolean)
    : [
        options.showRoute      ? { key: 'route',      label: 'Itinerario',   width: '38%' } : null,
        options.showPassengers ? { key: 'passengers',  label: 'Pax',          width: '9%'  } : null,
        options.showUnits      ? { key: 'unit',        label: 'Unidades',     width: '20%' } : null,
        options.showDrivers    ? { key: 'driver',      label: 'Conductores',  width: '16%' } : null,
        { key: 'subtotal',  label: 'Subtotal',   width: '11%' },
      ].filter(Boolean);
  const columnWidthTotal = columns.reduce((sum, column) => sum + Number.parseFloat(column.width), 0) || 100;
  const tableColgroup = columns
    .map(column => `<col style="width:${((Number.parseFloat(column.width) / columnWidthTotal) * 100).toFixed(2)}%">`)
    .join('');

  const SVG_PHONE_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;flex-shrink:0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6.08 6.08l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const SVG_ID_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;flex-shrink:0"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 8h.01M7 12h.01M11 8h6M11 12h6"/></svg>`;

  const tableRows = safeUnits.map((unit, index) => {
    const vehicle = getVehicle(unit, vehiculos);
    const driver = getDriver(unit, vehicle, conductores);
    const imageUrl = resolveAssetUrl(vehicle?.foto_url);
    const unitLabel = options.showUnitName ? vehicleLabel(vehicle || {}, unit) : `Unidad ${index + 1}`;
    const plateLine = options.showUnitPlate && vehicle?.placa ? `<div style="color:var(--muted);font-size:10px;margin-top:2px;">${escapeHtml(vehicle.placa)}</div>` : '';

    const unitCell = `<td>
      <div style="display:flex;align-items:center;gap:8px;">
        ${options.showUnitImages && imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(unitLabel)}" style="width:64px;height:44px;object-fit:cover;border-radius:4px;flex-shrink:0;">` : ''}
        <div>
          <div style="font-weight:800;font-size:12px;">${escapeHtml(unitLabel)}</div>
          ${plateLine}
        </div>
      </div>
    </td>`;

    const driverName = cleanText(driver?.nombre || unit.conductorNombre, 'Por asignar');
    const driverTel = options.showDriverPhone ? (driver?.tel || driver?.telefono || '') : '';
    const driverCedula = options.showDriverCedula ? (driver?.cedula || '') : '';
    const driverCell = `<td>
      <div style="font-weight:700;font-size:12px;margin-bottom:3px;">${escapeHtml(driverName)}</div>
      ${driverTel ? `<div style="color:var(--muted);font-size:11px;display:flex;align-items:center;">${SVG_PHONE_ICON}${escapeHtml(driverTel)}</div>` : ''}
      ${driverCedula ? `<div style="color:var(--muted);font-size:11px;display:flex;align-items:center;margin-top:2px;">${SVG_ID_ICON}${escapeHtml(driverCedula)}</div>` : ''}
    </td>`;

    const rowSubtotal = unitSubtotal(unit);
    const rowTax = rowSubtotal * taxRate;
    const rowTotal = rowSubtotal + rowTax;

    const cells = {
      route:      `<td>${routeHtml(unit, socio)}</td>`,
      passengers: `<td class="center">${escapeHtml(unit.sPax || socio.sPax || 'Por confirmar')}</td>`,
      unit:       unitCell,
      driver:     driverCell,
      subtotal:   `<td class="money">${escapeHtml(formatMoney(rowSubtotal, displayCurrency, params))}</td>`,
      impuestos:  `<td class="money muted-money">${escapeHtml(formatMoney(rowTax, displayCurrency, params))}</td>`,
      total:      `<td class="money total-cell">${escapeHtml(formatMoney(rowTotal, displayCurrency, params))}</td>`,
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
      --green: #5a9e1a;
      --bar: #7dc21e;
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
      display: flex;
      align-items: center;
      gap: 20px;
      padding-bottom: 0;
    }
    .brand-logo {
      width: 120px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-shrink: 0;
    }
    .brand-logo img {
      max-width: ${Math.round(120 * logoScale)}px;
      max-height: ${Math.round(80 * logoScale)}px;
      object-fit: contain;
    }
    .brand-placeholder {
      font-size: 26px;
      font-weight: 800;
      color: var(--ink);
    }
    .header-text { display: flex; flex-direction: column; justify-content: center; }
    .company { font-size: 26px; font-weight: 800; color: var(--ink); line-height: 1.1; margin: 0; }
    .subtitle { font-size: 15px; font-weight: 700; color: var(--green); margin-top: 3px; }
    .doc-panel-right { margin-left: auto; text-align: right; }
    .doc-label { font-size: 17px; font-weight: 900; color: var(--ink); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 4px; }
    .doc-id { font-size: 20px; font-weight: 900; color: var(--ink); letter-spacing: -.3px; }
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
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      padding: 5px 12px;
      letter-spacing: .1px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
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
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: .1px;
      padding: 5px 8px;
      text-align: left;
      border-right: 1px solid rgba(255,255,255,.25);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
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
    .muted-money { color: var(--muted); font-weight: 700; }
    .total-cell { color: var(--ink); font-weight: 900; }
    .route-day + .route-day { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }
    .route-date { color: var(--green); font-weight: 800; margin-bottom: 4px; font-size: 11px; }
    .route-row { display: flex; align-items: flex-start; gap: 2px; margin-bottom: 3px; font-size: 11.5px; line-height: 1.35; }
    .route-row span { flex: 1; }
    .route-time { display: flex; align-items: center; margin-left: 6px; color: var(--muted); font-size: 10.5px; white-space: nowrap; flex-shrink: 0; }
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
    /* ── Bottom row: totals above notes when totalizada ── */
    .bottom-row {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    /* Totalizada: financial sits directly under the table, full width right-aligned */
    .financial { display: flex; justify-content: flex-end; }
    .summary { padding: 0; min-width: 260px; border: none; box-shadow: none; background: transparent; }
    /* notes-grid: always 50/50 two columns, placed after financial */
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 12px;
      margin-bottom: 6px;
    }
    .summary-label {
      background: var(--bar);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 7px 14px;
      border-radius: 4px;
      min-width: 110px;
      text-align: right;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .summary-amount { font-size: 13px; font-weight: 800; color: var(--ink); white-space: nowrap; display: flex; align-items: center; }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 12px;
      margin-top: 4px;
    }
    .total-label {
      background: var(--bar);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 7px 14px;
      border-radius: 4px;
      min-width: 110px;
      text-align: right;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .total-amount { font-size: 16px; font-weight: 900; color: var(--ink); white-space: nowrap; display: flex; align-items: center; }
    .signature-block {
      margin-top: 8px;
      padding-top: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .signature-line {
      width: 220px;
      border-top: 1px solid #9CA3AF;
      margin-bottom: 6px;
    }
    .signature-name { font-size: 13px; font-weight: 800; color: var(--ink); margin-bottom: 2px; }
    .signature-info { font-size: 11px; color: var(--muted); line-height: 1.6; }
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
      gap: 8px 20px;
      color: var(--muted);
      font-size: 11px;
      justify-content: center;
      align-items: center;
    }
    .footer-item { display: flex; align-items: center; gap: 5px; }
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
      .box, .unit-card, .financial, .notes-grid, .bottom-row { break-inside: avoid; }
      .box-head, th, .summary-label, .total-label {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div class="brand-logo">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}">` : `<div class="brand-placeholder">${escapeHtml(companyName)}</div>`}
      </div>
      <div class="header-text">
        <div class="company">${escapeHtml(companyName)}</div>
        <div class="subtitle">Propuesta Comercial</div>
      </div>
      <div class="doc-panel-right">
        <div class="doc-label">Proforma</div>
        <div class="doc-id">${escapeHtml(proformaNumber)}</div>
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
      <div class="box-body" style="padding:0;">
        <table>
          <colgroup>
            ${tableColgroup}
          </colgroup>
          <thead>
            <tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>

    <section class="bottom-row">
      ${!isItemizada ? `
      <div class="financial">
        <div class="summary">
          ${discount > 0 ? `<div class="summary-row"><span class="summary-label">Descuento</span><span class="summary-amount">-${escapeHtml(formatMoney(discount, displayCurrency, params))}</span></div>` : ''}
          <div class="summary-row"><span class="summary-label">Impuestos</span><span class="summary-amount">${escapeHtml(formatMoney(tax, displayCurrency, params))}</span></div>
          <div class="total-row"><span class="total-label">Total</span><span class="total-amount">${escapeHtml(formatMoney(total, displayCurrency, params))}</span></div>
        </div>
      </div>` : ''}

      <div class="notes-grid">
        <div class="box">
          <div class="box-head">Comentarios</div>
          <div class="box-body text-block">${escapeHtml(cleanText(proformaComments, ''))}</div>
        </div>
        <div class="box">
          <div class="box-head">Términos y Condiciones</div>
          <div class="box-body text-block">${escapeHtml(cleanText(proformaTerms, defaultTerms(config)))}</div>
        </div>
      </div>
    </section>

    ${options.showSeller !== false && (sellerName || sellerPhone || sellerEmail) ? `
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(sellerName)}</div>
      <div class="signature-info">
        ${sellerEmail ? `<div>${escapeHtml(sellerEmail)}</div>` : ''}
        ${sellerPhone ? `<div>${escapeHtml(sellerPhone)}</div>` : ''}
      </div>
    </div>` : ''}


    <footer class="footer">
      ${footer.map(item => {
        const icons = {
          tel:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6.08 6.08l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
          email: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
          dir:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
          web:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        };
        return `<span class="footer-item">${icons[item.type] || ''}${escapeHtml(item.value)}</span>`;
      }).join('<span style="color:var(--line)">|</span>')}
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
