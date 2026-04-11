import { jsPDF } from "jspdf";

export function pdfGen({ params, socio, resData, vehiculo, logoData = null, franjasDia = [], empresaConfig = {} }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18, cW = W - M * 2;
  const fmt = (v) => v != null ? `$${v.toFixed(2)}` : '$0.00';
  
  const empresa = empresaConfig.nombre || 'TransOP';
  const tel = empresaConfig.tel || '+506 8000-0000';
  const email = empresaConfig.email || 'info@transop.com';
  const web = empresaConfig.web || 'www.transop.com';
  const dir = empresaConfig.pais || 'Costa Rica';
  const cedJur = empresaConfig.cedJur || '3-101-000000';
  const tituloPDF = empresaConfig.tituloPDF || 'PROFORMA DE SERVICIO DE TRANSPORTE';
  const terminos = empresaConfig.terminos || '';
  
  const numero = socio.cfNumero || 'PRO-001';
  const validez = socio.cfValidez || 15;
  const hoy = new Date();
  const fmtDate = d => d.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
  const venc = new Date(hoy); venc.setDate(venc.getDate() + validez);

  let y = 0;

  // Header PDF - Design Premium (Blue/Gold Accent)
  doc.setFillColor(30, 58, 138); // Navy Blue
  doc.rect(0, 0, W, 10, 'F');
  doc.setFillColor(212, 175, 55); // Gold Accent
  doc.rect(0, 10, W, 1.5, 'F');
  
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', M, 18, 45, 20, '', 'FAST'); } catch (e) { }
  } else {
    doc.setTextColor(30, 58, 138); doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.text(empresa, M, 30);
  }
  
  doc.setTextColor(20, 20, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(tituloPDF, W - M, 24, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  doc.text(`Proforma No. ${numero}`, W - M, 30, { align: 'right' });
  doc.text(`Fecha emisión: ${fmtDate(hoy)}`, W - M, 35, { align: 'right' });
  doc.text(`Válida hasta: ${fmtDate(venc)}`, W - M, 40, { align: 'right' });
  y = 48;

  // Info Box (Emisor/Cliente)
  const bH = 34;
  doc.setFillColor(248, 250, 252); doc.rect(M, y, cW, bH, 'F');
  doc.setDrawColor(226, 232, 240); doc.rect(M, y, cW, bH);
  doc.line(M + cW / 2, y, M + cW / 2, y + bH);
  
  doc.setTextColor(30, 58, 138); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL EMISOR', M + 5, y + 7);
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(empresa, M + 5, y + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`C.J.: ${cedJur}`, M + 5, y + 18);
  doc.text(`Tel: ${tel} | ${web}`, M + 5, y + 23);
  doc.text(email, M + 5, y + 28);
  
  const sx = M + cW / 2 + 5;
  doc.setTextColor(30, 58, 138); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('PREPARADO PARA:', sx, y + 7);
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(socio.sNombre || 'Cliente Estimado', sx, y + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  if (socio.sEmpresa) doc.text(socio.sEmpresa, sx, y + 18);
  if (socio.sEmail) doc.text(socio.sEmail, sx, y + 23);
  if (socio.sTel) doc.text(`Tel: ${socio.sTel}`, sx, y + 28);
  
  y += bH + 8;

  // DETALLE DEL SERVICIO
  doc.setFillColor(30, 58, 138); doc.rect(M, y, cW, 8, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPCIÓN DEL REQUERIMIENTO', M + 4, y + 5.5); y += 8;
  
  doc.setDrawColor(226, 232, 240); doc.rect(M, y, cW, 25);
  doc.setTextColor(40, 40, 40); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text(`• UNIDAD: ${vehiculo?.marca || 'Unidad'} ${vehiculo?.modelo || ''} (Placa: ${vehiculo?.placa || 'N/A'})`, M + 4, y + 6);
  doc.text(`• PASAJEROS: ${socio.sPax || '—'} pax`, M + 4, y + 11);
  doc.text(`• ITINERARIO: ${socio.sFecha || '—'} a las ${socio.sHora || '—'}`, M + 4, y + 16);
  doc.text(`• RUTA: ${socio.sOrigen || '—'} ➔ ${socio.sDestino || '—'}`, M + 4, y + 21);
  y += 30;

  // ITINERARIO DETALLADO
  if (franjasDia && franjasDia.length > 0) {
    doc.setFillColor(30, 58, 138); doc.rect(M, y, cW, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('ITINERARIO PROPUESTO (CRONOGRAMA)', M + 4, y + 5.5); y += 8;

    doc.setFontSize(8); doc.setTextColor(40, 40, 40);
    franjasDia.forEach((f, i) => {
        doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
        doc.rect(M, y, cW, 7, 'F');
        doc.setFont('helvetica', 'bold'); doc.text(f.hora, M + 4, y + 4.5);
        doc.setFont('helvetica', 'normal'); doc.text(f.actividad, M + 35, y + 4.5);
        doc.setFontSize(7); doc.setTextColor(100, 100, 100);
        doc.text(f.detalle, M + 90, y + 4.5);
        doc.setFontSize(8); doc.setTextColor(40, 40, 40);
        y += 7;
    });
    y += 8;
  }

  // COSTOS
  doc.setFillColor(30, 58, 138); doc.rect(M, y, cW, 8, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('VALORIZACIÓN DEL SERVICIO', M + 4, y + 5.5);
  doc.text('COSTO USD', M + cW - 4, y + 5.5, { align: 'right' }); y += 8;
  
  const drawRow = (l, v, b = false) => {
    doc.setFont('helvetica', b ? 'bold' : 'normal');
    doc.text(l, M + 4, y + 5);
    doc.text(fmt(v), M + cW - 4, y + 5, { align: 'right' }); y += 7;
    doc.setDrawColor(241, 245, 249); doc.line(M, y, M + cW, y);
  };

  drawRow('Servicio de transporte y costos operativos base', resData.base);
  if (resData.tarFijas > 0) drawRow('Cargos por tarifas fijas / transfers adicionales', resData.tarFijas);
  if (resData.extras > 0) drawRow('Gastos de hospedaje / viáticos diarios', resData.extras);
  
  y += 4;
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text('SUBTOTAL:', M + cW - 45, y + 5, { align: 'right' });
  doc.text(fmt(resData.subtotal), M + cW - 4, y + 5, { align: 'right' }); y += 6;
  
  doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
  doc.text(`Impuesto de Ventas (IVA ${params.iva}%):`, M + cW - 45, y + 5, { align: 'right' });
  doc.text(fmt(resData.ivaAmt), M + cW - 4, y + 5, { align: 'right' }); y += 8;

  doc.setFillColor(30, 58, 138); doc.rect(M + cW - 80, y, 80, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL A PAGAR:', M + cW - 75, y + 6.5);
  doc.text(fmt(resData.total), M + cW - 4, y + 6.5, { align: 'right' });
  y += 18;

  // Términos
  if (terminos) {
    doc.setTextColor(30, 58, 138); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('TÉRMINOS Y CONDICIONES:', M, y); y += 5;
    doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const tl = doc.splitTextToSize(terminos, cW);
    doc.text(tl, M, y);
  }

  // Firma / Footer
  const footerY = 280;
  doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text(empresaConfig.nota || `Esta proforma es un presupuesto y no garantiza reserva hasta su confirmación.`, W/2, footerY, { align: 'center' });

  doc.save(`Proforma_${numero}.pdf`);
}
