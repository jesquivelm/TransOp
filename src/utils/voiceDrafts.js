export function repairMojibake(value = '') {
  const input = String(value || '');
  if (!input || !/[ÃÂ]/.test(input)) return input;

  try {
    const bytes = Uint8Array.from(input, char => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return decoded || input;
  } catch {
    return input;
  }
}

export function normalizeTimeInput(value = '') {
  const repaired = repairMojibake(value).trim();
  if (!repaired) return '';

  const directMatch = repaired.match(/^(\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?)?$/);
  if (directMatch) {
    const hours = Number(directMatch[1]);
    const minutes = Number(directMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return '';
  }

  const normalized = repaired
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\ba\.?\s*m\.?\b/g, 'am')
    .replace(/\bp\.?\s*m\.?\b/g, 'pm')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /^(?:a las\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i,
    /^(?:a las\s+)?(\d{1,2})\.(\d{2})\s*(am|pm)$/i,
    /^(?:a las\s+)?(\d{1,2})(?::(\d{2}))?\s*de la\s+(manana|tarde|noche|madrugada)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const period = String(match[3] || '').toLowerCase();

    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    if ((period === 'tarde' || period === 'noche') && hour < 12) hour += 12;
    if ((period === 'manana' || period === 'madrugada') && hour === 12) hour = 0;

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const ampmMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2]);
    const p = ampmMatch[3].toLowerCase();
    if (p === 'pm' && hour < 12) hour += 12;
    if (p === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  return '';
}

export function normalizeDateInput(value = '') {
  if (!value) return '';
  const val = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return ''; 
}

export function normalizeVoiceInterpretation(interpretation, transcript = '') {
  const intent = interpretation?.intent || 'desconocido';
  const route = interpretation?.route || (intent === 'cotizacion' ? 'cotizaciones' : intent === 'socio' ? 'socios' : 'dashboard');
  
  const quoteData = interpretation?.quoteData || {};
  if (quoteData.fechaServicio) quoteData.fechaServicio = normalizeDateInput(quoteData.fechaServicio);
  if (quoteData.horaServicio) quoteData.horaServicio = normalizeTimeInput(quoteData.horaServicio);

  const taskData = interpretation?.taskData || interpretation?.tareaData || {};
  if (taskData.inicio) taskData.inicio = normalizeDateInput(taskData.inicio);
  if (taskData.fin) taskData.fin = normalizeDateInput(taskData.fin);
  if (taskData.hora) taskData.hora = normalizeTimeInput(taskData.hora);

  const socioData = interpretation?.socioData || {};
  if (socioData.revTec) socioData.revTec = normalizeDateInput(socioData.revTec);
  if (socioData.march) socioData.march = normalizeDateInput(socioData.march);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent,
    route,
    confidence: Number(interpretation?.confidence || 0),
    missingFields: Array.isArray(interpretation?.missingFields) ? interpretation.missingFields : [],
    assistantMessage: interpretation?.assistantMessage || '',
    interpretationNotes: Array.isArray(interpretation?.interpretationNotes) ? interpretation.interpretationNotes : [],
    conversationLog: Array.isArray(interpretation?.conversationLog) ? interpretation.conversationLog : [],
    routePreview: interpretation?.routePreview || null,
    transcript,
    quoteData,
    taskData,
    socioData,
  };
}
