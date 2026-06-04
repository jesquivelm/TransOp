/**
 * pdfGenerator.js
 * Genera una proforma premium en HTML y abre el dialogo de impresion/PDF.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanServiceDescription(description, socio = {}) {
  let text = String(description || '').trim();
  if (!text) return 'Servicio de transporte ejecutivo segun las condiciones detalladas en esta proforma.';

  [socio?.sNombre, socio?.sEmpresa]
    .filter(Boolean)
    .map(item => String(item).trim())
    .filter(Boolean)
    .forEach(item => {
      const safe = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(safe, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
    });

  return text
    .replace(/\bcliente\b\s*:?\s*/gi, '')
    .replace(/\bnombre cliente\b\s*:?\s*/gi, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[,.;:\-\s]+/, '')
    .trim() || 'Servicio de transporte ejecutivo segun las condiciones detalladas en esta proforma.';
}

function buildClientSummary(socio = {}) {
  const rows = [
    socio.sNombre || socio.sEmpresa || 'Cliente por confirmar',
    socio.sContacto ? `Contacto: ${socio.sContacto}${socio.sCargo ? `, ${socio.sCargo}` : ''}` : '',
    [socio.sTel, socio.sEmail].filter(Boolean).join(' | '),
    socio.sDireccion || '',
  ].filter(Boolean);
  return rows;
}

function buildDateMeta(socio = {}) {
  const now = new Date();
  const emission = now.toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const validUntil = new Date(now.getTime() + (Number(socio.cfValidez) || 15) * 86400000)
    .toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return [
    ['Emisión', emission],
    ['Validez', validUntil],
  ];
}

function buildFooterCompany(config = {}) {
  return [
    config.telefono || '',
    config.email || '',
    config.direccion || '',
  ].filter(Boolean);
}

function getDisplayAmount(value, currency = 'CRC', params = {}) {
  const amount = Number(value) || 0;
  const crcPerUsd = Number(params.tc) || 512;
  const eurPerUsd = Number(params.eurRate) || 0.92;
  if (currency === 'USD') return amount / crcPerUsd;
  if (currency === 'EUR') return (amount / crcPerUsd) * eurPerUsd;
  return amount;
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

function buildIntro(config = {}) {
  const text = String(config.proforma_intro || '').trim();
  if (!text) {
    return 'Nos complace presentar la siguiente propuesta de transporte, preparada con el detalle necesario para su evaluacion comercial.';
  }
  return text;
}

function buildFooterHtml(config = {}) {
  const items = buildFooterCompany(config);
  if (!items.length) return '';
  const icons = {
    telefono: config.telefono_icon_svg || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.34 2.26a2 2 0 0 1-.57 1.72L7.6 8.99a16 16 0 0 0 7.41 7.41l1.29-1.28a2 2 0 0 1 1.72-.57l2.26.34A2 2 0 0 1 22 16.92z"/></svg>',
    email: config.email_icon_svg || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    direccion: config.direccion_icon_svg || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  };
  const ordered = [
    config.telefono ? { key: 'telefono', value: config.telefono } : null,
    config.email ? { key: 'email', value: config.email } : null,
    config.direccion ? { key: 'direccion', value: config.direccion } : null,
  ].filter(Boolean);
  return ordered.map(item => `
    <span class="footer-item">
      <span class="footer-icon">${icons[item.key]}</span>
      <span>${escapeHtml(item.value)}</span>
    </span>
  `).join('<span class="footer-sep">|</span>');
}

function sanitizeItineraryRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      id: row?.id || `itin-${index + 1}`,
      fecha: String(row?.fecha || '').trim(),
      hora: String(row?.hora || '').trim(),
      origen: String(row?.origen || '').trim(),
      destino: String(row?.destino || '').trim(),
      recorrido: String(row?.recorrido || '').trim(),
      tiempoEstimado: String(row?.tiempoEstimado || '').trim(),
      vehiculoLabel: String(row?.vehiculoLabel || '').trim(),
    }))
    .filter(row => row.fecha || row.hora || row.origen || row.destino);
}

function itineraryRowComplete(row) {
  return Boolean(row?.fecha && row?.hora && row?.origen && row?.destino);
}

function formatDateLong(value) {
  if (!value) return 'Fecha por confirmar';
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatDistanceLabel(rawValue) {
  const normalized = String(rawValue || '').trim();
  if (!normalized) return '—';
  const numeric = Number.parseFloat(normalized.replace(',', '.'));
  if (!Number.isFinite(numeric)) return normalized;
  return `${new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(numeric)} km`;
}

function formatDurationLabel(rawValue) {
  const text = String(rawValue || '').trim();
  if (!text) return '—';
  return text.replace(/\s+/g, ' ');
}

function buildItinerarySummary(rows = []) {
  const safeRows = sanitizeItineraryRows(rows).filter(itineraryRowComplete);
  if (!safeRows.length) return null;
  const days = new Set(safeRows.map(row => row.fecha).filter(Boolean)).size || 1;
  return {
    segments: safeRows.length,
    days,
    start: safeRows[0],
    end: safeRows[safeRows.length - 1],
  };
}

function buildItineraryHtml(rows = []) {
  const safeRows = sanitizeItineraryRows(rows).filter(itineraryRowComplete);
  if (!safeRows.length) return '';
  return safeRows.map((row, index) => `
    <div class="itinerary-row">
      <div class="itinerary-step">
        <div class="itinerary-badge">Tramo ${index + 1}</div>
        <div class="itinerary-date">${escapeHtml(formatDateLong(row.fecha))}</div>
        <div class="itinerary-time">${escapeHtml(row.hora || 'Hora por confirmar')}</div>
      </div>
      <div class="itinerary-route">
        <div class="route-point">
          <span class="route-label">Origen</span>
          <span class="route-value">${escapeHtml(row.origen || 'Por confirmar')}</span>
        </div>
        <div class="route-divider"></div>
        <div class="route-point">
          <span class="route-label">Destino</span>
          <span class="route-value">${escapeHtml(row.destino || 'Por confirmar')}</span>
        </div>
      </div>
      <div class="itinerary-meta">
        <div class="itinerary-chip">${escapeHtml(formatDistanceLabel(row.recorrido))}</div>
        <div class="itinerary-chip">${escapeHtml(formatDurationLabel(row.tiempoEstimado))}</div>
        ${row.vehiculoLabel ? `<div class="itinerary-chip muted">${escapeHtml(row.vehiculoLabel)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

export function pdfGen({ params, socio, resData, config = {}, seller = null, itineraryRows = [] }) {
  const displayCurrency = socio?.cfMoneda || 'CRC';
  const companyName = escapeHtml(config.nombre || 'TransOP S.A.');
  const logoUrl = String(config.logo || '').trim();
  const logoScale = Math.max(0.5, Math.min(3, Number(config.logo_scale || 1)));
  const companyFont = String(config.fuente_empresa || 'Georgia, Times New Roman, serif');
  const documentFont = String(config.fuente_documento || 'Segoe UI, Arial, sans-serif');
  const companyColor = String(config.nombre_color || '#0f172a');
  const lineColor = '#d7e0ea';
  const softCard = '#f9fbfd';
  const softInk = '#5d6d80';
  const deepInk = '#1f2f46';

  const proformaNumber = escapeHtml(socio.cfNumero || 'PROFORMA');
  const detail = escapeHtml(cleanServiceDescription(socio.cfDescripcion, socio)).replace(/\n/g, '<br>');
  const introText = escapeHtml(buildIntro(config)).replace(/\n/g, '<br>');
  const clientLines = buildClientSummary(socio).map((line, index) => `
    <div class="client-line${index === 0 ? ' primary' : ''}">${escapeHtml(line)}</div>
  `).join('');
  const dateLines = buildDateMeta(socio).map(([label, value]) => `
    <div class="meta-row">
      <div class="meta-label">${escapeHtml(label)}</div>
      <div class="meta-value">${escapeHtml(value)}</div>
    </div>
  `).join('');
  const footerHtml = buildFooterHtml(config);
  const sellerName = escapeHtml(
    seller?.nombre
    || seller?.name
    || config.contacto_nombre
    || 'Representante comercial'
  );
  const sellerContact = [seller?.email || seller?.correo || config.email, seller?.telefono || seller?.tel || config.telefono]
    .filter(Boolean)
    .join(' | ');
  const sellerContactLine = sellerContact ? `<div class="signature-sub">${escapeHtml(sellerContact)}</div>` : '';

  const paymentText = escapeHtml(socio.cfPago || '50% adelanto y saldo contra servicio.');
  const disclaimer = 'Esta proforma no constituye un contrato vinculante hasta ser formalmente aceptada por el cliente mediante firma o confirmacion escrita.';
  const itinerarySummary = buildItinerarySummary(itineraryRows);
  const itineraryHtml = buildItineraryHtml(itineraryRows);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${proformaNumber}</title>
  <style>
    :root {
      --brand: ${companyColor};
      --ink: ${deepInk};
      --muted: ${softInk};
      --line: ${lineColor};
      --soft: ${softCard};
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #edf2f7;
    }

    body {
      font-family: ${documentFont};
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      position: relative;
      width: 8.5in;
      min-height: 11in;
      margin: 0 auto;
      background: #fff;
      padding: 0.42in 0.5in 0.95in;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      padding: 6px 0 18px;
      border-bottom: 1px solid var(--line);
    }

    .brand {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      flex: 1;
      min-width: 0;
    }

    .logo-box {
      width: fit-content;
      height: fit-content;
      max-width: ${Math.round(132 * logoScale)}px;
      max-height: ${Math.round(72 * logoScale)}px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      flex-shrink: 0;
    }

    .logo-box img {
      width: auto;
      height: auto;
      max-width: ${Math.round(132 * logoScale)}px;
      max-height: ${Math.round(72 * logoScale)}px;
      object-fit: contain;
      object-position: top left;
      display: block;
    }

    .brand-copy {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding-top: 1px;
    }

    .brand-name {
      font-family: ${companyFont};
      color: var(--brand);
      font-size: 27px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0.01em;
    }

    .brand-sub {
      margin-top: 7px;
      color: var(--muted);
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .doc-box {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      text-align: right;
      min-width: 200px;
      padding-top: 2px;
    }

    .doc-title {
      font-family: ${companyFont};
      font-size: 23px;
      line-height: 1;
      color: var(--ink);
      margin-bottom: 8px;
      font-style: italic;
    }

    .doc-number {
      font-size: 12px;
      color: var(--muted);
      font-weight: 700;
    }

    .top-grid {
      display: grid;
      grid-template-columns: 3fr 1fr;
      gap: 14px;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--soft);
      padding: 14px 16px;
    }

    .panel-label {
      font-size: 9px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #be8a2f;
      font-weight: 800;
      margin-bottom: 10px;
    }

    .dates-panel {
      text-align: right;
    }

    .dates-panel .panel-label {
      text-align: left;
    }

    .client-line {
      font-size: 12px;
      line-height: 1.55;
      color: var(--muted);
      margin-bottom: 4px;
    }

    .client-line.primary {
      font-size: 14px;
      color: var(--ink);
      font-weight: 800;
      margin-bottom: 8px;
    }

    .meta-row + .meta-row {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }

    .meta-label {
      font-size: 9px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 4px;
      font-weight: 500;
      text-align: right;
    }

    .meta-value {
      font-size: 12px;
      color: var(--ink);
      font-weight: 400;
      text-align: right;
    }

    .intro {
      border-left: 2px solid #cf9f4a;
      background: #fcf8f2;
      border-radius: 0 14px 14px 0;
      padding: 14px 16px;
      font-size: 12px;
      color: #4c5c70;
      line-height: 1.78;
      font-style: italic;
      white-space: normal;
    }

    .table-card {
      border: 1px solid transparent;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: #233750;
      color: #fff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      text-align: left;
      padding: 11px 14px;
      font-weight: 800;
    }

    thead th:first-child { border-radius: 12px 0 0 12px; }
    thead th:last-child { border-radius: 0 12px 12px 0; text-align: right; }

    tbody td {
      padding: 13px 14px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }

    .service-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink);
    }

    .service-desc {
      font-size: 11.4px;
      color: var(--muted);
      line-height: 1.82;
      white-space: normal;
    }

    .amount {
      text-align: right;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
      white-space: nowrap;
    }

    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .totals {
      width: 250px;
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: #fff;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 11px 14px;
      font-size: 12px;
      border-bottom: 1px solid var(--line);
    }

    .totals-row span:first-child { color: var(--muted); }
    .totals-row span:last-child { color: var(--ink); font-weight: 600; }

    .totals-row.total {
      background: #233750;
      border-bottom: none;
    }

    .totals-row.total span {
      color: #fff;
      font-weight: 800;
      font-size: 13px;
    }

    .terms-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 6px;
    }

    .term-box {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--soft);
      padding: 14px 16px;
      min-height: 92px;
    }

    .term-title {
      font-size: 9px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #be8a2f;
      font-weight: 800;
      margin-bottom: 10px;
    }

    .term-body {
      font-size: 11px;
      line-height: 1.75;
      color: #4c5c70;
    }

    .itinerary-section {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, #fffdf8 0%, #fff 100%);
      padding: 18px;
      margin-top: 6px;
    }

    .itinerary-section.second-page {
      margin-top: 0;
      border-radius: 22px;
      padding: 22px;
    }

    .itinerary-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }

    .itinerary-kicker {
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #be8a2f;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .itinerary-title {
      font-family: ${companyFont};
      font-size: 22px;
      color: var(--ink);
      line-height: 1.05;
    }

    .itinerary-subtitle {
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
    }

    .itinerary-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .summary-pill {
      min-width: 98px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: #fff;
      text-align: left;
    }

    .summary-pill-label {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--muted);
      margin-bottom: 4px;
      font-weight: 700;
    }

    .summary-pill-value {
      display: block;
      font-size: 15px;
      color: var(--ink);
      font-weight: 800;
    }

    .itinerary-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .itinerary-row {
      display: grid;
      grid-template-columns: 148px minmax(0, 1fr) 180px;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fff;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .itinerary-step {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .itinerary-badge {
      width: fit-content;
      padding: 5px 10px;
      border-radius: 999px;
      background: #fcf3df;
      color: #a26a17;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .itinerary-date {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink);
    }

    .itinerary-time {
      font-size: 20px;
      font-weight: 800;
      color: var(--brand);
      line-height: 1;
    }

    .itinerary-route {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    .route-point {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .route-label {
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }

    .route-value {
      font-size: 12px;
      color: var(--ink);
      font-weight: 700;
      line-height: 1.5;
      word-break: break-word;
    }

    .route-divider {
      position: relative;
      width: 20px;
      height: 2px;
      border-radius: 999px;
      background: linear-gradient(90deg, #d4a146 0%, #233750 100%);
    }

    .route-divider::after {
      content: '';
      position: absolute;
      right: -1px;
      top: 50%;
      transform: translateY(-50%);
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 6px solid #233750;
    }

    .itinerary-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .itinerary-chip {
      padding: 7px 10px;
      border-radius: 999px;
      background: #eef4fa;
      border: 1px solid #dde7f0;
      color: #28405d;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    .itinerary-chip.muted {
      background: #f8fafc;
      color: var(--muted);
    }

    .footer-separator {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 18px 0 58px;
    }

    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      align-items: end;
      margin: auto 0;
    }

    .signature {
      text-align: center;
      padding-top: 4px;
    }

    .signature-line {
      width: 160px;
      margin: 0 auto;
      border-top: 1px solid #dbe3ec;
      padding-top: 8px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
    }

    .signature-sub {
      margin-top: 4px;
      font-size: 10px;
      color: var(--muted);
    }

    .footer {
      position: absolute;
      left: 0.5in;
      right: 0.5in;
      bottom: 0.34in;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.65;
    }

    .footer-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .footer-icon {
      display: inline-flex;
      width: 12px;
      height: 12px;
      color: ${String(config.footer_icon_color || '#9aa8b8')};
      flex: 0 0 auto;
    }

    .footer-icon svg {
      width: 12px;
      height: 12px;
      display: block;
    }

    .footer-sep {
      color: #b4c0cd;
    }

    @page {
      size: Letter portrait;
      margin: 0;
    }

    @media print {
      body { background: #fff; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header" id="main-header">
      <div class="brand">
        <div class="logo-box">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${companyName}">` : ''}
        </div>
        <div class="brand-copy">
          <div class="brand-name">${companyName}</div>
          <div class="brand-sub">Propuesta comercial</div>
        </div>
      </div>
      <div class="doc-box">
        <div class="doc-title">Proforma</div>
        <div class="doc-number">${proformaNumber}</div>
      </div>
    </div>

    <div class="top-grid">
      <div class="panel">
        <div class="panel-label">Cliente</div>
        ${clientLines}
      </div>
      <div class="panel dates-panel">
        <div class="panel-label">Fechas</div>
        ${dateLines}
      </div>
    </div>

    <div class="intro">
      ${introText}
    </div>

    <div class="table-card" id="service-card">
      <table>
        <thead>
          <tr>
            <th>Detalle del servicio</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="service-desc">${detail}</div>
            </td>
            <td class="amount">${formatMoney(resData.subtotal, displayCurrency, params)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-wrap">
        <div class="totals">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatMoney(resData.subtotal, displayCurrency, params)}</span>
          </div>
          ${Number(resData.utilidadAmt || 0) > 0 ? `
          <div class="totals-row">
            <span>Utilidad (${Number(params.utilidadPct || 0).toFixed(2)}%)</span>
            <span>${formatMoney(resData.utilidadAmt, displayCurrency, params)}</span>
          </div>` : ''}
          ${Number(resData.descuentoAmt || 0) > 0 ? `
          <div class="totals-row">
            <span>Descuento (${Number(params.descuentoPct || 0).toFixed(2)}%)</span>
            <span>-${formatMoney(resData.descuentoAmt, displayCurrency, params)}</span>
          </div>` : ''}
          <div class="totals-row">
            <span>Impuesto de ventas</span>
            <span>${formatMoney(resData.ivaAmt, displayCurrency, params)}</span>
          </div>
          <div class="totals-row total">
            <span>Total (${displayCurrency})</span>
            <span>${formatMoney(resData.total, displayCurrency, params)}</span>
          </div>
          ${displayCurrency !== 'CRC' ? `
          <div class="totals-row">
            <span>Total base</span>
            <span>${formatMoney(resData.total, 'CRC', params)}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <div class="terms-grid" id="terms-grid">
      <div class="term-box">
        <div class="term-title">Terminos de pago</div>
        <div class="term-body">${paymentText}</div>
      </div>
      <div class="term-box">
        <div class="term-title">Condiciones</div>
        <div class="term-body">${escapeHtml(disclaimer)}</div>
      </div>
    </div>

    ${itineraryHtml ? `
    <section class="itinerary-section" id="itinerary-section">
      <div class="itinerary-header">
        <div>
          <div class="itinerary-kicker">Ruta Operativa</div>
          <div class="itinerary-title">Itinerario del Servicio</div>
          <div class="itinerary-subtitle">
            Hoja de ruta sugerida para ejecutar esta operación. Si el bloque completo no cabe en esta primera página,
            se moverá automáticamente a una segunda hoja dedicada.
          </div>
        </div>
        ${itinerarySummary ? `
        <div class="itinerary-summary">
          <div class="summary-pill">
            <span class="summary-pill-label">Tramos</span>
            <span class="summary-pill-value">${itinerarySummary.segments}</span>
          </div>
          <div class="summary-pill">
            <span class="summary-pill-label">Días</span>
            <span class="summary-pill-value">${itinerarySummary.days}</span>
          </div>
        </div>` : ''}
      </div>
      <div class="itinerary-list">
        ${itineraryHtml}
      </div>
    </section>` : ''}

    <div class="footer-separator">
      <div class="signatures">
        <div class="signature">
          <div class="signature-line">Firma del cliente</div>
          <div class="signature-sub">${escapeHtml(socio.sNombre || 'Cliente')}</div>
        </div>
        <div class="signature">
          <div class="signature-line">${sellerName}</div>
          ${sellerContactLine}
        </div>
      </div>

      <div class="footer">
        ${footerHtml}
      </div>
    </div>
  </div>

  ${itineraryHtml ? `
  <div class="page" id="itinerary-page" style="display:none;">
    <div class="header">
      <div class="brand">
        <div class="logo-box">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${companyName}">` : ''}
        </div>
        <div class="brand-copy">
          <div class="brand-name">${companyName}</div>
          <div class="brand-sub">Continuación operativa</div>
        </div>
      </div>
      <div class="doc-box">
        <div class="doc-title">Itinerario</div>
        <div class="doc-number">${proformaNumber}</div>
      </div>
    </div>
    <section class="itinerary-section second-page" id="itinerary-section-clone">
      <div class="itinerary-header">
        <div>
          <div class="itinerary-kicker">Ruta Operativa</div>
          <div class="itinerary-title">Itinerario del Servicio</div>
          <div class="itinerary-subtitle">
            Distribución detallada por tramo, fecha, hora y ruta prevista.
          </div>
        </div>
        ${itinerarySummary ? `
        <div class="itinerary-summary">
          <div class="summary-pill">
            <span class="summary-pill-label">Tramos</span>
            <span class="summary-pill-value">${itinerarySummary.segments}</span>
          </div>
          <div class="summary-pill">
            <span class="summary-pill-label">Días</span>
            <span class="summary-pill-value">${itinerarySummary.days}</span>
          </div>
        </div>` : ''}
      </div>
      <div class="itinerary-list">
        ${itineraryHtml}
      </div>
    </section>
  </div>` : ''}

  <script>
    window.onload = function() {
      window.requestAnimationFrame(function() {
        const itinerarySection = document.getElementById('itinerary-section');
        const itineraryPage = document.getElementById('itinerary-page');
        if (itinerarySection && itineraryPage) {
          const page = itinerarySection.closest('.page');
          const footerSeparator = page ? page.querySelector('.footer-separator') : null;
          const pageHeight = page ? page.clientHeight : 0;
          const itineraryBottom = itinerarySection.offsetTop + itinerarySection.offsetHeight;
          const footerTop = footerSeparator ? footerSeparator.offsetTop : pageHeight;
          const available = footerTop - itinerarySection.offsetTop;
          const needsSecondPage = itinerarySection.offsetHeight > available || itineraryBottom > footerTop;
          if (needsSecondPage) {
            itinerarySection.remove();
            itineraryPage.style.display = 'flex';
          } else {
            itineraryPage.remove();
          }
        }
        window.print();
        window.onafterprint = function() { window.close(); };
      });
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=740,scrollbars=yes');
  if (!win) {
    alert('El navegador bloqueo la ventana emergente. Permite pop-ups para este sitio e intenta de nuevo.');
    return;
  }

  win.document.write(html);
  win.document.close();
}
