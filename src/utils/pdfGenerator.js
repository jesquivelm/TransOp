import { jsPDF } from "jspdf";

export function pdfGen({ params, socio, resData, vehiculo, logoData = null, franjasDia = [] }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18, cW = W - M * 2;
  const fmt = (v) => v != null ? `$${v.toFixed(2)}` : '$0.00';
  
  // Dummy config if not passed - in real app, these come from context/settings
  const empresa = 'TransOP';
  const tel = '+506 8000-0000', email = 'info@transop.com', dir = 'San José', cedJur = '3-101-000000';
  const tituloPDF = 'PROFORMA DE SERVICIO DE TRANSPORTE';
  
  const numero = socio.cfNumero || 'PRO-001';
  const validez = socio.cfValidez || 15;
  const hoy = new Date();
  const fmtDate = d => d.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
  const venc = new Date(hoy); venc.setDate(venc.getDate() + validez);

  let y = 0;

  // Header PDF - Minimalist & Executive (from Cotizador)
  doc.setFillColor(212, 175, 55); // Top Gold Line (can adapt to TransOP AMB later)
  doc.rect(0, 0, W, 4, 'F');
  
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', M, 10, 45, 20, '', 'FAST'); } catch (e) { }
  } else {
    doc.setTextColor(20, 20, 20); doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.text(empresa, M, 22);
  }
  
  doc.setTextColor(20, 20, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(tituloPDF, W - M, 18, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  doc.text(`Proforma No. ${numero}`, W - M, 24, { align: 'right' });
  doc.text(`Fecha emisión: ${fmtDate(hoy)}`, W - M, 29, { align: 'right' });
  doc.text(`Válida hasta: ${fmtDate(venc)}`, W - M, 34, { align: 'right' });
  y = 42;

  const bH = 36;
  doc.setFillColor(253, 253, 253); doc.rect(M, y, cW, bH, 'F');
  doc.setDrawColor(220, 220, 220); doc.rect(M, y, cW, bH);
  doc.line(M + cW / 2, y, M + cW / 2, y + bH);
  
  doc.setTextColor(20, 20, 20); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL EMISOR', M + 5, y + 7);
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(empresa, M + 5, y + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  
  let ey = y + 18;
  if (cedJur) { doc.text(`C.J.: ${cedJur}`, M + 5, ey); ey += 4.5; }
  if (tel) { doc.text(`Tel: ${tel}`, M + 5, ey); ey += 4.5; }
  if (email) { doc.text(email, M + 5, ey); ey += 4.5; }
  if (dir) { const dl = doc.splitTextToSize(dir, cW / 2 - 10); doc.text(dl, M + 5, ey); }
  
  const sx = M + cW / 2 + 5;
  doc.setTextColor(20, 20, 20); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', sx, y + 7);
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(socio.sNombre || '—', sx, y + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  
  let cy2 = y + 18;
  if (socio.sCedula) { doc.text(`ID: ${socio.sCedula}`, sx, cy2); cy2 += 4.5; }
  if (socio.sEmpresa) { doc.text(socio.sCargo ? `${socio.sEmpresa} · ${socio.sCargo}` : socio.sEmpresa, sx, cy2); cy2 += 4.5; }
  if (socio.sEmail) { doc.text(socio.sEmail, sx, cy2); cy2 += 4.5; }
  if (socio.sTel) { doc.text(`Tel: ${socio.sTel}`, sx, cy2); cy2 += 4.5; }
  
  y += bH + 6;

  // DETALLE DEL SERVICIO
  doc.setFillColor(20, 20, 20); doc.rect(M, y, cW, 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DEL SERVICIO', M + 4, y + 5); y += 9;
  
  const descRaw = socio.cfDescripcion || '';
  const dl = descRaw ? doc.splitTextToSize(descRaw, cW - 8) : [];
  const boxH = 20 + (dl.length * 3.8);
  doc.setDrawColor(220, 220, 220); doc.rect(M, y, cW, boxH);
  doc.setTextColor(60, 60, 60); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text(`Unidad asignada: ${vehiculo?.marca} ${vehiculo?.modelo}`, M + 4, y + 6);
  doc.text(`Pasajeros: ${socio.sPax || '—'}     Fecha: ${socio.sFecha || '—'}     Hora: ${socio.sHora || '—'}`, M + 4, y + 11);
  doc.text(`Ruta: ${socio.sOrigen || '—'} - ${socio.sDestino || '—'}`, M + 4, y + 16);
  if (dl.length) { doc.text(dl, M + 4, y + 21); }
  y += boxH + 6;

  // COSTOS
  doc.setFillColor(20, 20, 20); doc.rect(M, y, cW, 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
  doc.text('DESGLOSE DE COSTOS', M + 4, y + 5);
  doc.text('Costo (USD)', M + cW - 4, y + 5, { align: 'right' }); y += 8;
  
  const rows = [];
  if (params.km > 0) {
    const fuelLabel = params.tipoCombustible || 'Combustible';
    rows.push([`Recorrido de ${params.km} km (Costo ${fuelLabel})`, resData.costoKm]);
  }
  if (params.colaborador > 0) rows.push(['Gastos de Colaborador / cargas', params.colaborador]);
  if (params.peajes > 0) rows.push(['Peajes estimados', params.peajes]);
  if (params.viaticos > 0) rows.push(['Viáticos de conductor', params.viaticos]);
  if (params.utilidad > 0) rows.push(['Margen de Utilidad', params.utilidad]);
  
  rows.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250);
    doc.rect(M, y, cW, 6.5, 'F'); doc.setDrawColor(240, 240, 240); doc.line(M, y + 6.5, M + cW, y + 6.5);
    doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(row[0], M + 4, y + 4.5); doc.text(fmt(row[1]), M + cW - 4, y + 4.5, { align: 'right' });
    y += 6.5;
  });
  y += 4;
  
  const pTot = (l, v, bold, big) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(big ? 12 : 9);
    doc.setTextColor(big ? 20 : 51, big ? 20 : 65, big ? 20 : 85);
    doc.text(l, M + cW - 35, y, { align: 'right' });
    doc.text(fmt(v), M + cW - 4, y, { align: 'right' });
    y += big ? 8 : 6;
  };
  
  pTot('Subtotal Base', resData.subtotal);
  pTot(`Impto. IVA (${(params.iva).toFixed(0)}%)`, resData.ivaAmt);
  y += 1;
  pTot('TOTAL A PAGAR', resData.total, true, true);

  doc.save(`Proforma_${numero}.pdf`);
}
