export function normalizeVoiceInterpretation(interpretation, transcript = '') {
  const intent = interpretation?.intent || 'desconocido';
  const route = interpretation?.route || (intent === 'cotizacion' ? 'cotizaciones' : intent === 'socio' ? 'socios' : 'dashboard');

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent,
    route,
    confidence: Number(interpretation?.confidence || 0),
    missingFields: Array.isArray(interpretation?.missingFields) ? interpretation.missingFields : [],
    assistantMessage: interpretation?.assistantMessage || '',
    interpretationNotes: Array.isArray(interpretation?.interpretationNotes) ? interpretation.interpretationNotes : [],
    transcript,
    quoteData: interpretation?.quoteData || {},
    socioData: interpretation?.socioData || {},
  };
}
