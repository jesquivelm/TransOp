import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
    getDatabaseConfig,
    query as pgQuery,
    saveDatabaseConfig,
    testConnection,
} from './db/postgres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const VEHICLE_UPLOADS_DIR = path.join(UPLOADS_DIR, 'vehiculos');
const GASTOS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'gastos');
const EMPRESA_UPLOADS_DIR = path.join(UPLOADS_DIR, 'empresa');

fs.mkdirSync(VEHICLE_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(GASTOS_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(EMPRESA_UPLOADS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3020;
const JWT_SECRET = process.env.JWT_SECRET || 'tms_secret_2024_key_99';

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE DE AUTENTICACIÓN
// ─────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user?.rol !== 'admin') return res.sendStatus(403);
    next();
}

function formatDbError(error) {
    if (error?.code === '23505' && `${error.constraint || ''}`.includes('codigo_cliente')) {
        return 'El código de cliente ya existe. Use otro identificador.';
    }

    if (error?.code === '23514' && `${error.constraint || ''}`.includes('tipo')) {
        return 'El tipo de socio no es válido en la base de datos actual.';
    }

    if (error?.code === 'ECONNREFUSED') {
        return 'No se pudo establecer conexión con la base de datos.';
    }

    return error?.message || 'Error interno del servidor';
}

async function getSystemConfigValue(clave) {
    const result = await pgQuery('SELECT valor FROM tms_config WHERE clave = $1', [clave]);
    return result.rows[0]?.valor || {};
}

async function getGroqApiKey() {
    const envKey = process.env.GROQ_API_KEY?.trim();
    if (envKey) return envKey;

    const apiConfig = await getSystemConfigValue('apis');
    return apiConfig?.groqApiKey?.trim?.() || '';
}

function decodeBase64Audio(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('No se recibió audio para interpretar.');
    }

    const [, base64Value = input] = input.split(',');
    return Buffer.from(base64Value, 'base64');
}

function guessAudioExtension(mimeType = '') {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
}

async function transcribeAudioWithGroq({ apiKey, audioBuffer, mimeType }) {
    if (audioBuffer.byteLength > 24 * 1024 * 1024) {
        throw new Error('El audio supera el tamaño permitido para transcripción. Intenta grabarlo en partes más cortas.');
    }

    const formData = new FormData();
    formData.append(
        'file',
        new Blob([audioBuffer], { type: mimeType || 'audio/webm' }),
        mimeType === 'audio/wav' ? 'audio.wav' : `transop-voice.${guessAudioExtension(mimeType)}`
    );
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'es');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Groq no pudo transcribir el audio.');
    }

    return payload?.text || '';
}

function extractJsonObject(raw) {
    const cleaned = String(raw || '').replace(/```json|```/gi, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch { }

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error('La respuesta del modelo no vino en JSON válido.');
}

function stripAccents(value = '') {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeTranscript(text = '') {
    return stripAccents(String(text || '').toLowerCase())
        .replace(/\s+/g, ' ')
        .trim();
}

function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function extractFirstNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const match = String(value || '').match(/(\d+(?:[.,]\d+)?)/);
    return match ? toNumber(match[1]) : null;
}

function wordToNumber(word = '') {
    const key = normalizeTranscript(word);
    const map = {
        un: 1, uno: 1, una: 1,
        dos: 2, tres: 3, cuatro: 4, cinco: 5,
        seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
        once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
        dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
    };
    return map[key] ?? null;
}

function parseHumanCount(value) {
    const numeric = extractFirstNumber(value);
    if (numeric != null) return numeric;
    return wordToNumber(value);
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function toIsoDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function nextWeekday(baseDate, weekday) {
    const date = new Date(baseDate);
    date.setHours(0, 0, 0, 0);
    const current = date.getDay();
    let delta = (weekday - current + 7) % 7;
    if (delta === 0) delta = 7;
    date.setDate(date.getDate() + delta);
    return date;
}

function parseWeekdayReference(transcript) {
    const text = normalizeTranscript(transcript);
    if (!text) return null;

    const weekdays = {
        domingo: 0,
        lunes: 1,
        martes: 2,
        miercoles: 3,
        jueves: 4,
        viernes: 5,
        sabado: 6,
    };

    const weekdayMatch = text.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
    if (!weekdayMatch) return null;

    return toIsoDate(nextWeekday(new Date(), weekdays[weekdayMatch[1]]));
}

function inferServiceYear(monthIndex, day) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const candidate = new Date(currentYear, monthIndex, day);
    candidate.setHours(0, 0, 0, 0);

    const pastThreshold = new Date(today);
    pastThreshold.setHours(0, 0, 0, 0);
    pastThreshold.setDate(pastThreshold.getDate() - 30);

    return candidate < pastThreshold ? currentYear + 1 : currentYear;
}

function parseAbsoluteDate(transcript) {
    const text = normalizeTranscript(transcript);
    if (!text) return null;

    const months = {
        enero: 0,
        febrero: 1,
        marzo: 2,
        abril: 3,
        mayo: 4,
        junio: 5,
        julio: 6,
        agosto: 7,
        septiembre: 8,
        setiembre: 8,
        octubre: 9,
        noviembre: 10,
        diciembre: 11,
    };

    const namedMonthMatch = text.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/);
    if (namedMonthMatch) {
        const day = Number(namedMonthMatch[1]);
        const monthIndex = months[namedMonthMatch[2]];
        const year = Number(namedMonthMatch[3]) || inferServiceYear(monthIndex, day);
        const date = new Date(year, monthIndex, day);
        if (date.getMonth() === monthIndex && date.getDate() === day) {
            return toIsoDate(date);
        }
    }

    const numericMatch = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (numericMatch) {
        const day = Number(numericMatch[1]);
        const month = Number(numericMatch[2]);
        const rawYear = numericMatch[3];
        const year = rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : inferServiceYear(month - 1, day);
        const date = new Date(year, month - 1, day);
        if (date.getMonth() === month - 1 && date.getDate() === day) {
            return toIsoDate(date);
        }
    }

    return null;
}

function extractAddress(transcript) {
    const raw = String(transcript || '').trim();
    if (!raw) return '';

    const patterns = [
        /\bdireccion(?: exacta)?(?: es| seria| sería|:)?\s+(.+?)(?=$|(?:,?\s+(?:contacto|telefono|tel|correo|email|origen|destino|fecha|hora|pasajeros?)\b))/i,
        /\ben la direccion\s+(.+?)(?=$|(?:,?\s+(?:contacto|telefono|tel|correo|email|origen|destino|fecha|hora|pasajeros?)\b))/i,
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match?.[1]) {
            return match[1].trim().replace(/[.,;:]+$/g, '');
        }
    }

    return '';
}

function cleanupLocationText(value = '') {
    return String(value || '')
        .replace(/\b(?:y\s+ademas|ademas|y mas|mas vamos|vamos a pagar|hasta y)\b.*$/i, '')
        .replace(/\b(?:para|de|somos|seremos|van|viajan)\s+\d+\s+(?:pasajeros|personas|pax)\b.*$/i, '')
        .replace(/\b(?:el|este|esta)?\s*(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*$/i, '')
        .replace(/\b(?:hoy|manana|pasado manana)\b.*$/i, '')
        .replace(/\ba las\s+\d{1,2}(?::|\.)?\d{0,2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\b.*$/i, '')
        .replace(/[.,;:]+$/g, '')
        .trim();
}

function extractRouteFields(transcript) {
    const raw = String(transcript || '').trim();
    if (!raw) return {};

    const patterns = [
        /\bdesde\s+(.+?)\s+hasta\s+(.+)/i,
        /\bde\s+(.+?)\s+hasta\s+(.+)/i,
        /\bdesde\s+(.+?)\s+a\s+(.+)/i,
        /\bde\s+(.+?)\s+a\s+(.+)/i,
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (!match) continue;

        const origen = cleanupLocationText(match[1]);
        const destino = cleanupLocationText(match[2]);

        if (origen && destino) {
            return { origen, destino };
        }
    }

    return {};
}

function parseRelativeDate(transcript) {
    const text = normalizeTranscript(transcript);
    if (!text) return {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (/\bpasado manana\b/.test(text)) {
        const date = new Date(today);
        date.setDate(date.getDate() + 2);
        return { fechaServicio: toIsoDate(date) };
    }

    if (/\bmanana\b/.test(text)) {
        const date = new Date(today);
        date.setDate(date.getDate() + 1);
        return { fechaServicio: toIsoDate(date) };
    }

    if (/\bhoy\b/.test(text)) {
        return { fechaServicio: toIsoDate(today) };
    }

    const absoluteDate = parseAbsoluteDate(text);
    if (absoluteDate) {
        return { fechaServicio: absoluteDate };
    }

    const weekdayDate = parseWeekdayReference(text);
    if (weekdayDate) {
        return { fechaServicio: weekdayDate };
    }

    if (/\b(proximo|siguiente) fin de semana\b/.test(text)) {
        const saturday = nextWeekday(today, 6);
        const sunday = nextWeekday(today, 0);
        return {
            fechaServicio: toIsoDate(saturday),
            interpretationNotes: [
                `Se interpreto "proximo fin de semana" como ${toIsoDate(saturday)} de forma tentativa.`,
            ],
            suggestedFollowUp: `Interprete "proximo fin de semana" como sabado ${toIsoDate(saturday)}. Te funciona mejor sabado ${toIsoDate(saturday)} o domingo ${toIsoDate(sunday)}?`,
        };
    }

    return {};
}

function parseTimeExpression(transcript) {
    const raw = String(transcript || '');
    const text = normalizeTranscript(raw);
    if (!text) return null;

    const rawNormalized = raw
        .replace(/\ba\.?\s*m\.?\b/gi, 'am')
        .replace(/\bp\.?\s*m\.?\b/gi, 'pm');

    const patterns = [
        /\ba las (\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
        /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
        /\ba las (\d{1,2})\.(\d{2})\s*(am|pm)\b/i,
        /\b(\d{1,2})\.(\d{2})\s*(am|pm)\b/i,
        /\ba las (\d{1,2})(?::(\d{2}))?\b/i,
        /\b(\d{1,2})(?::(\d{2}))? de la (manana|tarde|noche)\b/i,
    ];

    for (const pattern of patterns) {
        const match = rawNormalized.match(pattern) || text.match(pattern);
        if (!match) continue;

        let hour = Number(match[1]);
        const minute = Number(match[2] || 0);
        const period = normalizeTranscript((match[3] || '').replace(/\./g, '').replace(/\s+/g, ''));

        if (period === 'pm' && hour < 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
        if ((period === 'tarde' || period === 'noche') && hour < 12) hour += 12;
        if (period === 'manana' && hour === 12) hour = 0;

        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            return `${pad2(hour)}:${pad2(minute)}`;
        }
    }

    return null;
}

function extractPhoneNumber(transcript) {
    const raw = String(transcript || '');
    const match = raw.match(/(\+?\d[\d\s-]{6,}\d)/);
    return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function getCaptureGroupValue(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const value = parseHumanCount(match[1]);
        if (value != null) return value;
    }
    return null;
}

function extractOperationalFields(transcript, parsedQuoteData = {}) {
    const raw = String(transcript || '');
    const text = normalizeTranscript(raw);
    const nextData = {};
    const notes = [];
    let suggestedFollowUp = '';

    const fechaInfo = parseRelativeDate(raw);
    if (fechaInfo.fechaServicio && !parsedQuoteData?.fechaServicio && !parsedQuoteData?.sFecha) {
        nextData.fechaServicio = fechaInfo.fechaServicio;
    }
    if (fechaInfo.interpretationNotes?.length) notes.push(...fechaInfo.interpretationNotes);
    if (fechaInfo.suggestedFollowUp) suggestedFollowUp = fechaInfo.suggestedFollowUp;

    const parsedTime = parseTimeExpression(raw);
    if (parsedTime && !parsedQuoteData?.horaServicio && !parsedQuoteData?.sHora) {
        nextData.horaServicio = parsedTime;
    }

    if (!parsedQuoteData?.telefono) {
        const phone = extractPhoneNumber(raw);
        if (phone) nextData.telefono = phone;
    }

    if (!parsedQuoteData?.direccion && !parsedQuoteData?.sDireccion) {
        const address = extractAddress(raw);
        if (address) nextData.direccion = address;
    }

    const routeFields = extractRouteFields(raw);
    if (routeFields.origen && !parsedQuoteData?.origen && !parsedQuoteData?.sOrigen) {
        nextData.origen = routeFields.origen;
    }
    if (routeFields.destino && !parsedQuoteData?.destino && !parsedQuoteData?.sDestino) {
        nextData.destino = routeFields.destino;
    }

    const pasajeros = getCaptureGroupValue(text, [
        /\b(?:para|de|somos|seremos|van|viajan)\s+([a-z0-9]+)\s+(?:pasajeros|personas|pax)\b/,
        /\b([a-z0-9]+)\s+(?:pasajeros|personas|pax)\b/,
    ]);
    if (pasajeros != null && !parsedQuoteData?.pasajeros && !parsedQuoteData?.sPax) {
        nextData.pasajeros = pasajeros;
    }

    const persViat = getCaptureGroupValue(text, [
        /\bviaticos? (?:para|de)\s+([a-z0-9]+)\s+personas?\b/,
        /\b([a-z0-9]+)\s+con viaticos?\b/,
    ]);
    if (persViat != null) nextData.persViat = persViat;

    const persHosp = getCaptureGroupValue(text, [
        /\bhospedaje (?:para|de)\s+([a-z0-9]+)\s+personas?\b/,
        /\b([a-z0-9]+)\s+hospedajes?\b/,
    ]);
    if (persHosp != null) nextData.persHosp = persHosp;

    const noches = getCaptureGroupValue(text, [/\b([a-z0-9]+)\s+noches?\b/]);
    if (noches != null) nextData.noches = noches;

    const kmMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:km|kilometros?)/);
    if (kmMatch) {
        const km = toNumber(kmMatch[1]);
        if (km != null) nextData.km = km;
    }

    const hospedajeMonto = text.match(/(\d+(?:[.,]\d+)?)\s*(?:dolares|usd|\$)\s+de\s+hospedaje\b/);
    if (hospedajeMonto) {
        const amount = toNumber(hospedajeMonto[1]);
        if (amount != null) nextData.hospedajeTotalManual = amount;
    }

    const ferryMonto = text.match(/(?:ferry|barco)[^\d]{0,20}(\d+(?:[.,]\d+)?)/);
    if (ferryMonto) {
        const amount = toNumber(ferryMonto[1]);
        if (amount != null) nextData.ferry = amount;
    }

    if (/\btransfer in\b/.test(text)) {
        if (/\b(cartago|ctg)\b/.test(text)) nextData.ckTinCTG = true;
        else nextData.ckTinSJ = true;
    }
    if (/\btransfer out\b/.test(text)) {
        if (/\b(cartago|ctg)\b/.test(text)) nextData.ckToutCTG = true;
        else nextData.ckToutSJ = true;
    }

    return {
        data: nextData,
        interpretationNotes: notes,
        suggestedFollowUp,
    };
}

function mergeQuoteData(modelQuoteData = {}, transcript = '') {
    const extras = extractOperationalFields(transcript, modelQuoteData);
    const merged = { ...modelQuoteData, ...extras.data };

    if (!merged.contacto && merged.nombreCliente) {
        merged.contacto = merged.nombreCliente;
    }

    return {
        quoteData: merged,
        interpretationNotes: extras.interpretationNotes,
        suggestedFollowUp: extras.suggestedFollowUp,
    };
}

function ensureCountryContext(place = '') {
    const value = String(place || '').trim();
    if (!value) return '';
    if (/\bcosta rica\b/i.test(value)) return value;
    return `${value}, Costa Rica`;
}

async function geocodePlace(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cr&q=${encodeURIComponent(ensureCountryContext(query))}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'TransOP/1.0 (route-estimation)',
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`No se pudo geocodificar "${query}".`);
    }

    const results = await response.json().catch(() => []);
    const hit = Array.isArray(results) ? results[0] : null;
    if (!hit?.lat || !hit?.lon) {
        return null;
    }

    return {
        lat: Number(hit.lat),
        lon: Number(hit.lon),
        label: hit.display_name || query,
    };
}

function normalizePoint(point) {
    if (!point || typeof point !== 'object') return null;
    const lat = Number(point.lat);
    const lon = Number(point.lon ?? point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

async function resolveRoutePoint(place, coords) {
    const directPoint = normalizePoint(coords);
    if (directPoint) {
        return {
            ...directPoint,
            label: typeof place === 'string' && place.trim() ? place.trim() : `${directPoint.lat}, ${directPoint.lon}`,
        };
    }

    return geocodePlace(place);
}

async function estimateRouteDistanceKm(origin, destination, options = {}) {
    const [from, to] = await Promise.all([
        resolveRoutePoint(origin, options.originCoords),
        resolveRoutePoint(destination, options.destinationCoords),
    ]);

    if (!from || !to) return null;

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const response = await fetch(routeUrl, {
        headers: {
            'User-Agent': 'TransOP/1.0 (route-estimation)',
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('No se pudo calcular la ruta entre origen y destino.');
    }

    const payload = await response.json().catch(() => ({}));
    const meters = payload?.routes?.[0]?.distance;
    if (!Number.isFinite(meters)) return null;

    return Math.max(1, Math.round(meters / 1000));
}

const REQUIRED_QUOTE_FIELDS = ['contacto', 'telefono', 'origen', 'destino', 'fechaServicio', 'pasajeros'];

const QUOTE_FIELD_LABELS = {
    contacto: 'contacto',
    telefono: 'telefono',
    origen: 'origen',
    destino: 'destino',
    fechaServicio: 'fecha del servicio',
    horaServicio: 'hora del servicio',
    pasajeros: 'cantidad de pasajeros',
};

function computeMissingQuoteFields(quoteData = {}) {
    return REQUIRED_QUOTE_FIELDS.filter(field => {
        const value = quoteData?.[field];
        if (typeof value === 'number') return value <= 0;
        return !String(value || '').trim();
    });
}

function formatMissingFields(fields = []) {
    return fields.map(field => QUOTE_FIELD_LABELS[field] || field);
}

function normalizeVoiceResult(parsed, transcript) {
    const intent = ['cotizacion', 'socio', 'desconocido'].includes(parsed?.intent)
        ? parsed.intent
        : inferIntentFromPayload(parsed, transcript);

    const route = intent === 'cotizacion'
        ? 'cotizaciones'
        : intent === 'socio'
            ? 'socios'
            : 'dashboard';

    const mergedQuote = intent === 'cotizacion'
        ? mergeQuoteData(parsed?.quoteData && typeof parsed.quoteData === 'object' ? parsed.quoteData : {}, transcript)
        : { quoteData: parsed?.quoteData && typeof parsed.quoteData === 'object' ? parsed.quoteData : {}, interpretationNotes: [], suggestedFollowUp: '' };

    const finalMissingFields = intent === 'cotizacion'
        ? computeMissingQuoteFields(mergedQuote.quoteData)
        : Array.isArray(parsed?.missingFields) ? parsed.missingFields : [];

    return {
        intent,
        route,
        confidence: Number(parsed?.confidence || (intent === 'desconocido' ? 0.35 : 0.82)),
        assistantMessage: buildAssistantMessage(intent, {
            ...parsed,
            missingFields: finalMissingFields,
            quoteData: mergedQuote.quoteData,
            suggestedFollowUp: mergedQuote.suggestedFollowUp,
        }),
        missingFields: finalMissingFields,
        quoteData: mergedQuote.quoteData,
        socioData: parsed?.socioData && typeof parsed.socioData === 'object' ? parsed.socioData : {},
        interpretationNotes: mergedQuote.interpretationNotes,
    };
}

function inferIntentFromPayload(parsed, transcript) {
    const text = `${transcript || ''} ${JSON.stringify(parsed || {})}`.toLowerCase();
    if (/(cotiz|proforma|servicio|traslado|transporte|origen|destino|pasaj)/.test(text)) return 'cotizacion';
    if (/(socio|cliente|proveedor|contacto|empresa|identificaci)/.test(text)) return 'socio';
    return 'desconocido';
}

function defaultAssistantMessage(intent, parsed) {
    if (intent === 'cotizacion') {
        const missing = Array.isArray(parsed?.missingFields) ? parsed.missingFields : [];
        return missing.length
            ? `Llené lo que encontré. Aún faltan: ${missing.join(', ')}.`
            : 'Ya preparé la proforma con los datos detectados.';
    }
    if (intent === 'socio') {
        return 'Ya preparé el formulario del socio con la información detectada.';
    }
    return 'No logré identificar con claridad si deseas una proforma o crear un socio.';
}

function buildAssistantMessage(intent, parsed) {
    if (intent !== 'cotizacion') return defaultAssistantMessage(intent, parsed);

    const missing = Array.isArray(parsed?.missingFields) ? parsed.missingFields : [];
    const labels = formatMissingFields(missing);
    if (parsed?.suggestedFollowUp) {
        return labels.length
            ? `${parsed.suggestedFollowUp} Ademas aun me faltan: ${labels.join(', ')}.`
            : parsed.suggestedFollowUp;
    }

    return labels.length
        ? `Llene lo que encontre. Aun faltan: ${labels.join(', ')}.`
        : 'Ya prepare la proforma con los datos detectados.';
}

async function interpretTranscriptWithGroq({ apiKey, transcript, conversationHistory }) {
    const normalizedHistory = Array.isArray(conversationHistory)
        ? conversationHistory
            .filter(item => item?.role && item?.text)
            .slice(-10)
            .map(item => ({ role: item.role, content: item.text }))
        : [];

    const systemPrompt = [
        'Eres un asistente de TransOP.',
        'Debes devolver únicamente JSON válido, sin texto adicional, sin backticks y sin explicaciones.',
        'Si el usuario está pidiendo una cotización, proforma o servicio de transporte, devuelve:',
        '{"intent":"cotizacion","quoteData":{"nombreCliente":"","empresa":"","contacto":"","cargo":"","telefono":"","email":"","direccion":"","origen":"","destino":"","fechaServicio":"","horaServicio":"","pasajeros":"","descripcion":"","codigoCliente":"","km":0,"noches":0,"persViat":0,"persHosp":0,"hospedajeTotalManual":0,"ferry":0,"ckTinSJ":false,"ckToutSJ":false,"ckTinCTG":false,"ckToutCTG":false},"socioData":{},"missingFields":[],"assistantMessage":"","confidence":0.0}',
        'Si el usuario está creando un socio, cliente, proveedor o contacto, devuelve:',
        '{"intent":"socio","quoteData":{},"socioData":{"nombre":"","empresa":"","identificacion":"","email":"","telefono":"","tipo":"","direccion":"","notas":"","contactoNombre":"","contactoCargo":"","contactoTelefono":"","contactoEmail":"","codigoCliente":""},"missingFields":[],"assistantMessage":"","confidence":0.0}',
        'Si no está claro, devuelve intent="desconocido" con quoteData y socioData vacíos.',
        'Si el usuario corrige o completa algo, combina todo lo de la conversación en un solo JSON actualizado.',
        'Para cotizaciones, detecta también viáticos por cantidad de personas, hospedaje por cantidad de personas o monto total, ferry, transfer in/out, fechas relativas y horas expresadas en lenguaje natural.',
        'Para interpretar horas en lenguaje natural, aplica estas reglas:',
        '- "2 de la mañana", "2 de la madrugada", "2 am", "las 2 de la mañana" = 02:00',
        '- "3 de la mañana", "3 de la madrugada", "3 am", "las 3 de la mañana" = 03:00',
        '- "4 de la mañana", "4 de la madrugada", "4 am" = 04:00',
        '- "5 de la mañana", "5 de la madrugada", "5 am" = 05:00',
        '- "6 de la mañana", "6 am" = 06:00',
        '- Expresiones como "a las 2", "a las 3" sin especificar periodo se interpretan como mañana si es temprano, sino preguntar',
        '- "mediodia", "12 del medio dia", "12 pm" = 12:00',
        '- "1 de la tarde", "1 pm", "13:00" = 13:00',
        '- "6 de la tarde", "6 pm", "18:00" = 18:00',
        '- "7 de la noche", "7 pm", "19:00" = 19:00',
        '- "8 de la noche", "8 pm", "20:00" = 20:00',
        '- "9 de la noche", "9 pm", "21:00" = 21:00',
        '- "10 de la noche", "10 pm", "22:00" = 22:00',
        '- "11 de la noche", "11 pm", "23:00" = 23:00',
        '- "12 de la noche", "12 am", "medianoche" = 00:00',
        '- "1 de la noche", "1 am" = 01:00',
        'Si "proximo fin de semana" es ambiguo, puedes proponer un valor tentativo y reflejarlo en assistantMessage para confirmar si es sabado o domingo.',
        'Si faltan datos importantes para cerrar la cotizacion, llena missingFields con claves como contacto, telefono, origen, destino, fechaServicio, horaServicio o pasajeros.',
    ].join(' ');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            temperature: 0.1,
            messages: [
                { role: 'system', content: systemPrompt },
                ...normalizedHistory,
                { role: 'user', content: transcript },
            ],
            max_tokens: 700,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Groq no pudo interpretar la solicitud.');
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Groq devolvio una respuesta vacia al interpretar la solicitud.');
    }

    return normalizeVoiceResult(extractJsonObject(content), transcript);
}

async function ensureDatabaseCompatibility() {
    try {
        await pgQuery(`
            DO $$
            BEGIN
                ALTER TABLE clientes ADD COLUMN IF NOT EXISTS empresa VARCHAR(200);
                ALTER TABLE clientes ADD COLUMN IF NOT EXISTS identificacion VARCHAR(50);
                ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_cliente VARCHAR(30);
                ALTER TABLE clientes ADD COLUMN IF NOT EXISTS clasificacion VARCHAR(20);

                UPDATE clientes
                SET clasificacion = 'cliente'
                WHERE clasificacion IS NULL OR TRIM(clasificacion) = '';

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'clientes' AND column_name = 'tipo'
                ) THEN
                    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_check;
                    ALTER TABLE clientes
                    ADD CONSTRAINT clientes_tipo_check
                    CHECK (tipo IN ('cliente', 'proveedor', 'operador', 'agencia', 'corporativo', 'empresa', 'persona'));
                END IF;

                ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_clasificacion_check;
                ALTER TABLE clientes
                ADD CONSTRAINT clientes_clasificacion_check
                CHECK (clasificacion IN ('prospecto', 'cliente'));
            END $$;
        `);

        await pgQuery(`
            WITH max_codigo AS (
                SELECT COALESCE(
                    MAX(CAST(SUBSTRING(codigo_cliente FROM '^CL([0-9]+)$') AS INTEGER)),
                    0
                ) AS ultimo
                FROM clientes
                WHERE codigo_cliente ~ '^CL[0-9]+$'
            ),
            pendientes AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY created_at ASC, nombre ASC, id ASC) AS seq
                FROM clientes
                WHERE codigo_cliente IS NULL
                   OR TRIM(codigo_cliente) = ''
                   OR codigo_cliente !~ '^CL[0-9]+$'
            )
            UPDATE clientes AS c
            SET codigo_cliente = 'CL' || LPAD((max_codigo.ultimo + pendientes.seq)::text, 3, '0')
            FROM max_codigo, pendientes
            WHERE c.id = pendientes.id
        `);

        await pgQuery(`
                CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_codigo_cliente
                ON clientes (codigo_cliente)
        `);

        await pgQuery(`
            ALTER TABLE conductores
            ADD COLUMN IF NOT EXISTS lic JSONB DEFAULT '[]'::jsonb
        `);

        await pgQuery(`
            ALTER TABLE vehiculos
            ADD COLUMN IF NOT EXISTS licencia_requerida VARCHAR(10);
            ALTER TABLE vehiculos
            ADD COLUMN IF NOT EXISTS rendimiento DECIMAL(10,2) DEFAULT 0;
        `);

        await pgQuery(`
            CREATE TABLE IF NOT EXISTS tms_gastos (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
                tipo VARCHAR(20) NOT NULL DEFAULT 'otro',
                detalle TEXT NOT NULL,
                monto DECIMAL(12,2) NOT NULL DEFAULT 0,
                fecha DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await pgQuery(`
            CREATE TABLE IF NOT EXISTS tms_gasto_adjuntos (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                gasto_id UUID NOT NULL REFERENCES tms_gastos(id) ON DELETE CASCADE,
                nombre_original VARCHAR(255),
                archivo_path TEXT NOT NULL,
                mime_type VARCHAR(120),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    } catch (error) {
        console.warn('No se pudo validar la compatibilidad del esquema de clientes:', error.message);
    }
}

function sanitizeUploadName(filename = '') {
    const ext = path.extname(String(filename || '')).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
}

function parseDataUrlImage(dataUrl = '') {
    const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('La imagen no tiene un formato valido.');
    }
    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], 'base64'),
    };
}

function parseDataUrlFile(dataUrl = '') {
    const match = String(dataUrl || '').match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('El archivo no tiene un formato valido.');
    }
    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], 'base64'),
    };
}

function normalizeLookupValue(value = '') {
    return String(value || '').trim().toLowerCase();
}

async function findClientMatch({ nombre = '', empresa = '', telefono = '', email = '' }) {
    const normalizedEmail = normalizeLookupValue(email);
    const normalizedPhone = normalizeLookupValue(telefono);
    const normalizedName = normalizeLookupValue(nombre);
    const normalizedCompany = normalizeLookupValue(empresa);

    if (normalizedEmail) {
        const result = await pgQuery(
            `SELECT id, clasificacion FROM clientes
             WHERE LOWER(TRIM(COALESCE(email, ''))) = $1
             ORDER BY created_at ASC
             LIMIT 1`,
            [normalizedEmail]
        );
        if (result.rows[0]) return result.rows[0];
    }

    if (normalizedPhone) {
        const result = await pgQuery(
            `SELECT id, clasificacion FROM clientes
             WHERE LOWER(TRIM(COALESCE(telefono, ''))) = $1
             ORDER BY created_at ASC
             LIMIT 1`,
            [normalizedPhone]
        );
        if (result.rows[0]) return result.rows[0];
    }

    if (!normalizedName) return null;

    const result = await pgQuery(
        `SELECT id, clasificacion FROM clientes
         WHERE LOWER(TRIM(nombre)) = $1
           AND LOWER(TRIM(COALESCE(empresa, ''))) = $2
         ORDER BY created_at ASC
         LIMIT 1`,
        [normalizedName, normalizedCompany]
    );
    return result.rows[0] || null;
}

async function findClientByNameOrCompany(search = '') {
    const normalized = normalizeLookupValue(search);
    if (!normalized) return null;

    const result = await pgQuery(
        `SELECT id, nombre, empresa, clasificacion
         FROM clientes
         WHERE LOWER(TRIM(nombre)) = $1
            OR LOWER(TRIM(COALESCE(empresa, ''))) = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [normalized]
    );

    return result.rows[0] || null;
}

async function ensureClientForEvent({ clienteId, cliente }) {
    if (clienteId) return String(clienteId);

    const clienteNombre = String(cliente || '').trim();
    if (!clienteNombre) return null;

    const existing = await findClientByNameOrCompany(clienteNombre);
    if (existing?.id) return existing.id;

    const codigoCliente = await generateClientCode();
    const inserted = await pgQuery(
        `INSERT INTO clientes (
            codigo_cliente, nombre, empresa, identificacion, tipo, clasificacion, telefono, email, direccion, notas
         ) VALUES ($1, $2, NULL, NULL, 'cliente', 'prospecto', NULL, NULL, NULL, $3)
         RETURNING id`,
        [
            codigoCliente,
            clienteNombre,
            'Creado automaticamente desde un evento.',
        ]
    );

    const nextClientId = inserted.rows[0]?.id || null;
    if (nextClientId) {
        try {
            await ensurePrimaryContactForClient(nextClientId, { sContacto: clienteNombre });
        } catch (contactError) {
            console.warn('No se pudo crear el contacto principal del cliente del evento:', contactError.message);
        }
    }
    return nextClientId;
}

async function ensurePrimaryContactForClient(clienteId, socio = {}) {
    const nombre = String(socio?.sContacto || '').trim();
    if (!nombre) return;

    const existing = await pgQuery(
        `SELECT id
         FROM contactos
         WHERE cliente_id = $1 AND LOWER(TRIM(nombre)) = $2
         LIMIT 1`,
        [clienteId, normalizeLookupValue(nombre)]
    );
    if (existing.rows[0]) return;

    await pgQuery(
        `INSERT INTO contactos (cliente_id, nombre, cargo, telefono, email, es_principal, notas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            clienteId,
            nombre,
            String(socio?.sCargo || '').trim() || null,
            String(socio?.sTel || '').trim() || null,
            String(socio?.sEmail || '').trim() || null,
            true,
            'Contacto creado automáticamente desde una cotización.',
        ]
    );
}

async function upsertClientFromQuote(dataJson = {}, fallback = {}) {
    const socio = dataJson?.socio || {};
    const nombre = String(socio?.sNombre || fallback?.cliente_nombre || '').trim();
    if (!nombre) return null;

    const empresa = String(socio?.sEmpresa || fallback?.cliente_empresa || '').trim();
    const telefono = String(socio?.sTel || '').trim();
    const email = String(socio?.sEmail || '').trim();
    const direccion = String(socio?.sDireccion || '').trim();
    const notas = String(socio?.cfDescripcion || '').trim();
    const identificacion = String(socio?.sCedula || '').trim();
    const tipo = 'cliente';

    const existing = await findClientMatch({ nombre, empresa, telefono, email });

    if (existing?.id) {
        await pgQuery(
            `UPDATE clientes
             SET nombre = COALESCE(NULLIF(TRIM($1), ''), nombre),
                 empresa = COALESCE(NULLIF(TRIM($2), ''), empresa),
                 telefono = COALESCE(NULLIF(TRIM($3), ''), telefono),
                 email = COALESCE(NULLIF(TRIM($4), ''), email),
                 direccion = COALESCE(NULLIF(TRIM($5), ''), direccion),
                 notas = COALESCE(NULLIF(TRIM($6), ''), notas),
                 identificacion = COALESCE(NULLIF(TRIM($7), ''), identificacion),
                 tipo = COALESCE(NULLIF(TRIM($8), ''), tipo),
                 clasificacion = CASE WHEN clasificacion = 'cliente' THEN 'cliente' ELSE 'prospecto' END,
                 updated_at = NOW()
             WHERE id = $9`,
            [nombre, empresa, telefono, email, direccion, notas, identificacion, tipo, existing.id]
        );
        await ensurePrimaryContactForClient(existing.id, socio);
        return existing.id;
    }

    const codigoCliente = await generateClientCode();
    const inserted = await pgQuery(
        `INSERT INTO clientes (
            codigo_cliente, nombre, empresa, identificacion, tipo, clasificacion, telefono, email, direccion, notas
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
            codigoCliente,
            nombre,
            empresa || null,
            identificacion || null,
            tipo,
            'prospecto',
            telefono || null,
            email || null,
            direccion || null,
            notas || 'Creado automáticamente desde una cotización.',
        ]
    );

    const clienteId = inserted.rows[0]?.id || null;
    if (clienteId) {
        await ensurePrimaryContactForClient(clienteId, socio);
    }
    return clienteId;
}

async function seedClientsFromQuotes() {
    const result = await pgQuery(`
        SELECT numero, cliente_nombre, cliente_empresa, data_json
        FROM tms_cotizaciones
        ORDER BY fecha_emision ASC, created_at ASC
    `);

    for (const row of result.rows) {
        try {
            await upsertClientFromQuote(row.data_json || {}, {
                cliente_nombre: row.cliente_nombre,
                cliente_empresa: row.cliente_empresa,
            });
        } catch (error) {
            console.warn(`No se pudo sembrar socio desde proforma ${row.numero}:`, error.message);
        }
    }
}

async function generateClientCode() {
    const result = await pgQuery(`
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(codigo_cliente FROM '^CL([0-9]+)$') AS INTEGER)),
            0
        ) AS ultimo
        FROM clientes
        WHERE codigo_cliente ~ '^CL[0-9]+$'
    `);

    const nextNumber = Number(result.rows[0]?.ultimo || 0) + 1;
    return `CL${String(nextNumber).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pgQuery(
            'SELECT * FROM usuarios WHERE (username = $1 OR email = $1) AND activo = TRUE',
            [username]
        );
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });

        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                username: user.username,
                email: user.email,
                rol: user.rol,
                foto_url: user.foto_url
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/api/system/db-config', authenticateToken, requireAdmin, async (req, res) => {
    res.json(getDatabaseConfig());
});

app.get('/api/system/db-config/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ ok: false, error: formatDbError(error) });
    }
});

app.post('/api/system/db-config/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await testConnection(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ ok: false, error: formatDbError(error) });
    }
});

app.post('/api/system/db-config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await testConnection(req.body);
        const config = await saveDatabaseConfig(req.body);
        await ensureDatabaseCompatibility();
        res.json({ success: true, config, test: result });
    } catch (error) {
        res.status(500).json({ success: false, error: formatDbError(error) });
    }
});

// ─────────────────────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/usuarios', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    try {
        const result = await pgQuery(
            'SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY nombre ASC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// CONDUCTORES  ← NUEVO
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/conductores', authenticateToken, async (req, res) => {
    try {
        await ensureDatabaseCompatibility();
        const result = await pgQuery(
            `SELECT
                c.id,
                c.nombre,
                c.cedula,
                c.telefono AS tel,
                c.alias,
                c.estado,
                COALESCE(c.lic, '[]'::jsonb) AS lic,
                v.id AS "vehId"
             FROM conductores c
             LEFT JOIN vehiculos v ON v.conductor_asignado_id = c.id AND v.activo = TRUE
             WHERE c.activo = TRUE
             ORDER BY nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/conductores', authenticateToken, async (req, res) => {
    const { nombre, cedula, tel, alias, lic } = req.body;
    try {
        await ensureDatabaseCompatibility();
        const result = await pgQuery(
            `INSERT INTO conductores (nombre, cedula, telefono, alias, lic, estado)
             VALUES ($1, $2, $3, $4, $5, 'disponible')
              RETURNING id`,
            [nombre, cedula, tel, alias || nombre.split(' ')[0], JSON.stringify(lic || [])]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tms/conductores/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, cedula, tel, alias, lic, estado, vehId } = req.body;
    try {
        await ensureDatabaseCompatibility();
        await pgQuery(
            `UPDATE conductores SET
                nombre = COALESCE($1, nombre),
                cedula = COALESCE($2, cedula),
                telefono = COALESCE($3, telefono),
                alias    = COALESCE($4, alias),
                lic      = COALESCE($5, lic),
                estado = COALESCE($6, estado),
                updated_at = NOW()
             WHERE id = $7`,
            [nombre, cedula, tel, alias,
                lic ? JSON.stringify(lic) : null,
                estado, id]
        );

        if (vehId !== undefined) {
            await pgQuery(
                `UPDATE vehiculos
                 SET conductor_asignado_id = NULL
                 WHERE conductor_asignado_id = $1`,
                [id]
            );

            if (vehId) {
                await pgQuery(
                    `UPDATE vehiculos
                     SET conductor_asignado_id = $1
                     WHERE id = $2`,
                    [id, vehId]
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Baja lógica
app.patch('/api/tms/conductores/:id/baja', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pgQuery(
            `UPDATE conductores SET estado = 'inactivo', updated_at = NOW() WHERE id = $1`,
            [id]
        );
        await pgQuery(
            `UPDATE vehiculos
             SET conductor_asignado_id = NULL
             WHERE conductor_asignado_id = $1`,
            [id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/uploads/vehiculos', authenticateToken, async (req, res) => {
    const { filename, dataUrl } = req.body || {};
    try {
        const { buffer } = parseDataUrlImage(dataUrl);
        const finalName = sanitizeUploadName(filename);
        const finalPath = path.join(VEHICLE_UPLOADS_DIR, finalName);
        fs.writeFileSync(finalPath, buffer);
        res.json({ success: true, path: `/uploads/vehiculos/${finalName}` });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No se pudo guardar la imagen del vehiculo.' });
    }
});

app.post('/api/tms/uploads/gastos', authenticateToken, async (req, res) => {
    const { filename, dataUrl } = req.body || {};
    try {
        const { mimeType, buffer } = parseDataUrlFile(dataUrl);
        const finalName = sanitizeUploadName(filename);
        const finalPath = path.join(GASTOS_UPLOADS_DIR, finalName);
        fs.writeFileSync(finalPath, buffer);
        res.json({ success: true, path: `/uploads/gastos/${finalName}`, mimeType });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No se pudo guardar el adjunto del gasto.' });
    }
});

app.post('/api/tms/uploads/logo', authenticateToken, async (req, res) => {
    const { filename, dataUrl } = req.body || {};
    try {
        const { buffer } = parseDataUrlImage(dataUrl);
        const finalName = sanitizeUploadName(filename);
        const finalPath = path.join(EMPRESA_UPLOADS_DIR, finalName);
        fs.writeFileSync(finalPath, buffer);
        res.json({ success: true, path: `/uploads/empresa/${finalName}` });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No se pudo guardar el logo.' });
    }
});

app.get('/api/tms/config/empresa', authenticateToken, async (req, res) => {
    try {
        const value = await getSystemConfigValue('datos_empresa');
        res.json({ success: true, data: value });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tms/config/empresa', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const data = req.body;
        await pgQuery(`
            INSERT INTO tms_config (clave, valor)
            VALUES ('datos_empresa', $1)
            ON CONFLICT (clave) DO UPDATE SET valor = $1
        `, [JSON.stringify(data)]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// VEHÍCULOS
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/vehiculos', authenticateToken, async (req, res) => {
    try {
        await ensureDatabaseCompatibility();
        const result = await pgQuery(
            `SELECT id, placa, marca, modelo, tipo, capacidad_pasajeros AS cap, estado,
                    conductor_asignado_id AS "condId", fecha_revision_tecnica AS "revTec", fecha_marchamo AS march, km_actual AS km,
                    foto_url, licencia_requerida AS "licenciaRequerida",
                    colaborador, combustible_costo, combustible_tipo, peajes, viaticos, utilidad,
                    adic_col, adic_viat, tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
                    hospedaje, viatico_diario, activo
             FROM vehiculos
             WHERE activo = TRUE
             ORDER BY placa ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/vehiculos', authenticateToken, async (req, res) => {
    const { placa, marca, modelo, tipo, cap, revTec, march, km, foto_url, licenciaRequerida } = req.body;
    try {
        await ensureDatabaseCompatibility();
        const result = await pgQuery(
            `INSERT INTO vehiculos (placa, marca, modelo, tipo, capacidad_pasajeros, fecha_revision_tecnica, fecha_marchamo, km_actual, foto_url, licencia_requerida, combustible_tipo, rendimiento, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'disponible')
             RETURNING id`,
            [placa, marca, modelo, tipo, cap, revTec || null, march || null, km || 0, foto_url || null, licenciaRequerida || null, combustibleTipo || 'Diésel', rendimiento || 0]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tms/vehiculos/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const {
        placa, marca, modelo, tipo, cap, revTec, march,
        colaborador, combustible_costo, combustibleTipo, rendimiento, peajes, viaticos, utilidad, adic_col, adic_viat,
        tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
        hospedaje, viatico_diario, foto_url, licenciaRequerida,
        // campos operativos
        estado, condId, km
    } = req.body;
    try {
        await ensureDatabaseCompatibility();
        await pgQuery(
            `UPDATE vehiculos SET
                placa = COALESCE($1, placa),
                marca = COALESCE($2, marca),
                modelo = COALESCE($3, modelo),
                tipo = COALESCE($4, tipo),
                capacidad_pasajeros = COALESCE($5, capacidad_pasajeros),
                fecha_revision_tecnica = COALESCE($6, fecha_revision_tecnica),
                fecha_marchamo = COALESCE($7, fecha_marchamo),
                km_actual = COALESCE($8, km_actual),
                estado = COALESCE($9, estado),
                conductor_asignado_id = COALESCE($10, conductor_asignado_id),
                colaborador = COALESCE($11, colaborador),
                combustible_costo = COALESCE($12, combustible_costo),
                combustible_tipo = COALESCE($13, combustible_tipo),
                peajes = COALESCE($14, peajes),
                viaticos = COALESCE($15, viaticos),
                utilidad = COALESCE($16, utilidad),
                adic_col = COALESCE($17, adic_col),
                adic_viat = COALESCE($18, adic_viat),
                tarifa_gam = COALESCE($19, tarifa_gam),
                media_tarifa = COALESCE($20, media_tarifa),
                t_in_sj = COALESCE($21, t_in_sj),
                t_out_sj = COALESCE($22, t_out_sj),
                t_in_ctg = COALESCE($23, t_in_ctg),
                t_out_ctg = COALESCE($24, t_out_ctg),
                hospedaje = COALESCE($25, hospedaje),
                viatico_diario = COALESCE($26, viatico_diario),
                foto_url = COALESCE($27, foto_url),
                licencia_requerida = COALESCE($28, licencia_requerida),
                rendimiento = COALESCE($29, rendimiento),
                updated_at = NOW()
             WHERE id = $30`,
            [placa, marca, modelo, tipo, cap, revTec || null, march || null, km,
                estado, condId, colaborador, combustible_costo, combustibleTipo, peajes, viaticos, utilidad, adic_col, adic_viat,
                tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
                hospedaje, viatico_diario, foto_url || null, licenciaRequerida || null, rendimiento, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Baja lógica
app.patch('/api/tms/vehiculos/:id/baja', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pgQuery(
            `UPDATE vehiculos SET estado = 'fuera_de_servicio', cond_id = NULL, updated_at = NOW() WHERE id = $1`,
            [id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tms/gastos', authenticateToken, async (req, res) => {
    try {
        await ensureDatabaseCompatibility();
        const result = await pgQuery(
            `SELECT
                g.id,
                g.vehiculo_id AS "vehiculoId",
                g.tipo,
                g.detalle,
                g.monto,
                TO_CHAR(g.fecha, 'YYYY-MM-DD') AS fecha,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', ga.id,
                            'nombreOriginal', ga.nombre_original,
                            'archivoPath', ga.archivo_path,
                            'mimeType', ga.mime_type
                        )
                    ) FILTER (WHERE ga.id IS NOT NULL),
                    '[]'::json
                ) AS adjuntos
             FROM tms_gastos g
             LEFT JOIN tms_gasto_adjuntos ga ON ga.gasto_id = g.id
             GROUP BY g.id
             ORDER BY g.fecha DESC, g.created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/gastos', authenticateToken, async (req, res) => {
    const { vehiculoId, tipo, detalle, monto, fecha, adjuntos } = req.body || {};
    try {
        await ensureDatabaseCompatibility();
        const result = await pgQuery(
            `INSERT INTO tms_gastos (vehiculo_id, tipo, detalle, monto, fecha)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [vehiculoId || null, tipo || 'otro', detalle, monto || 0, fecha || new Date().toISOString().slice(0, 10)]
        );

        const gastoId = result.rows[0]?.id;
        if (gastoId && Array.isArray(adjuntos)) {
            for (const adjunto of adjuntos) {
                await pgQuery(
                    `INSERT INTO tms_gasto_adjuntos (gasto_id, nombre_original, archivo_path, mime_type)
                     VALUES ($1, $2, $3, $4)`,
                    [gastoId, adjunto?.nombreOriginal || null, adjunto?.archivoPath, adjunto?.mimeType || null]
                );
            }
        }

        res.json({ success: true, id: gastoId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// EVENTOS  ← NUEVO
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/eventos', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT
                e.id, e.nombre, c.nombre AS cliente, e.estado, e.prioridad AS prio,
                TO_CHAR(e.fecha_inicio, 'DD/MM') AS inicio,
                TO_CHAR(e.fecha_fin,   'DD/MM') AS fin,
                e.pax_estimados AS pax,
                COUNT(t.id)                          AS tareas,
                COUNT(t.id) FILTER (WHERE t.estado = 'completada') AS ok
             FROM eventos e
             JOIN clientes c ON c.id = e.cliente_id
             LEFT JOIN tareas t ON t.evento_id = e.id
             WHERE e.estado != 'cancelado'
             GROUP BY e.id, c.nombre
             ORDER BY e.fecha_inicio ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/eventos', authenticateToken, async (req, res) => {
    const { nombre, clienteId, cliente, inicio, fin, pax, prio, estado } = req.body;
    const parseDate = (str) => {
        const [d, m] = str.split('/');
        return `${new Date().getFullYear()}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };
    try {
        const resolvedClientId = await ensureClientForEvent({ clienteId, cliente });
        if (!nombre || !resolvedClientId || !inicio || !fin) {
            return res.status(400).json({ error: 'Nombre, cliente y fechas son requeridos para crear el evento.' });
        }

        const result = await pgQuery(
            `INSERT INTO eventos (nombre, cliente_id, fecha_inicio, fecha_fin, pax_estimados, prioridad, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id`,
            [nombre, resolvedClientId, parseDate(inicio), parseDate(fin), pax, prio || 'normal', estado || 'planificado']
        );
        res.json({ success: true, id: result.rows[0].id, clienteId: resolvedClientId, cliente: String(cliente || '').trim() || null });
    } catch (error) {
        const details = {
            message: error?.message,
            code: error?.code,
            constraint: error?.constraint,
            detail: error?.detail,
        };
        console.error('Error creando evento:', details);
        res.status(500).json({ error: formatDbError(error), details });
    }
});

app.put('/api/tms/eventos/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, clienteId, pax, prio, estado } = req.body;
    try {
        await pgQuery(
            `UPDATE eventos SET
                nombre = COALESCE($1, nombre),
                cliente_id = COALESCE($2, cliente_id),
                pax_estimados = COALESCE($3, pax_estimados),
                prioridad = COALESCE($4, prioridad),
                estado = COALESCE($5, estado),
                updated_at = NOW()
             WHERE id = $6`,
            [nombre, clienteId, pax, prio, estado, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// TAREAS  ← NUEVO
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/tareas', authenticateToken, async (req, res) => {
    // Acepta ?fecha=YYYY-MM-DD para filtrar por día (si no, devuelve las de hoy)
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    try {
        const result = await pgQuery(
            `SELECT
                id,
                TO_CHAR(fecha_salida, 'HH24:MI') AS hora,
                TO_CHAR(COALESCE(llegada_estimada, hora_regreso), 'HH24:MI') AS fin,
                nombre, estado,
                evento_id AS "eventoId",
                conductor_id AS "condId",
                vehiculo_id AS "vehId",
                pasajeros AS pax, punto_salida AS origen, destino,
                TO_CHAR(fecha_salida, 'YYYY-MM-DD') AS fecha
             FROM tareas
             WHERE fecha_salida::date = $1::date
               AND estado != 'cancelada'
             ORDER BY fecha_salida ASC`,
            [fecha]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/tareas', authenticateToken, async (req, res) => {
    const { nombre, hora, fin, eventoId, condId, vehId, pax, origen, destino, fecha } = req.body;
    const diaBase = fecha || new Date().toISOString().slice(0, 10);
    try {
        const result = await pgQuery(
            `INSERT INTO tareas (nombre, fecha_salida, llegada_estimada, hora_regreso, evento_id, conductor_id, vehiculo_id, pasajeros, punto_salida, destino, estado)
             VALUES ($1, $2::timestamp, $3::timestamp, $4::timestamp, $5, $6, $7, $8, $9, $10, 'pendiente')
              RETURNING id`,
            [nombre, `${diaBase}T${hora || '00:00'}:00`, `${diaBase}T${fin || '00:00'}:00`, `${diaBase}T${fin || '00:00'}:00`, eventoId ?? null, condId ?? null, vehId ?? null,
                pax, origen ?? null, destino ?? null]
        );
        if (eventoId) {
            await pgQuery(
                `UPDATE eventos SET updated_at = NOW() WHERE id = $1`,
                [eventoId]
            );
        }
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Asignar conductor y vehículo a una tarea
app.patch('/api/tms/tareas/:id/asignar', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { condId, vehId } = req.body;
    const nextEstado = condId && vehId ? 'asignada' : 'pendiente';
    try {
        await pgQuery(
            `UPDATE tareas
             SET conductor_id = $1,
                 vehiculo_id = $2,
                 estado = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [condId || null, vehId || null, nextEstado, id]
        );
        res.json({ success: true, estado: nextEstado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar estado de una tarea
app.patch('/api/tms/tareas/:id/estado', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        await pgQuery(
            `UPDATE tareas SET estado = $1, updated_at = NOW() WHERE id = $2`,
            [estado, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// PROFORMAS / COTIZACIONES
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/proformas', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery('SELECT * FROM tms_cotizaciones ORDER BY fecha_emision DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/proformas', authenticateToken, async (req, res) => {
    const { numero, cliente_nombre, cliente_empresa, total_usd, data_json } = req.body;
    try {
        await ensureDatabaseCompatibility();

        const result = await pgQuery(
            `INSERT INTO tms_cotizaciones (numero, cliente_nombre, cliente_empresa, total_usd, data_json)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (numero) DO UPDATE SET
                cliente_nombre = EXCLUDED.cliente_nombre,
                cliente_empresa = EXCLUDED.cliente_empresa,
                total_usd = EXCLUDED.total_usd,
                data_json = EXCLUDED.data_json,
                updated_at = NOW()
             RETURNING id`,
            [numero, cliente_nombre, cliente_empresa, total_usd, JSON.stringify(data_json)]
        );

        await upsertClientFromQuote(data_json || {}, { cliente_nombre, cliente_empresa });
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tms/proformas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pgQuery('DELETE FROM tms_cotizaciones WHERE id = $1 OR numero = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// SOCIOS / CLIENTES
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/socios', authenticateToken, async (req, res) => {
    try {
        await ensureDatabaseCompatibility();
        await seedClientsFromQuotes();
        const result = await pgQuery(
            `WITH socios_ordenados AS (
                SELECT
                    id,
                    codigo_cliente,
                    nombre,
                    empresa,
                    identificacion,
                    tipo,
                    clasificacion,
                    telefono,
                    email,
                    direccion,
                    notas,
                    activo,
                    created_at,
                    ROW_NUMBER() OVER (ORDER BY created_at ASC, nombre ASC, id ASC) AS orden_codigo
                FROM clientes
            )
            SELECT id,
                    CASE
                        WHEN codigo_cliente ~ '^CL[0-9]+$' THEN codigo_cliente
                        ELSE 'CL' || LPAD(orden_codigo::text, 3, '0')
                    END AS "codigoCliente",
                    nombre,
                    empresa,
                    identificacion,
                    CASE
                        WHEN tipo IN ('empresa', 'persona') THEN 'cliente'
                        ELSE tipo
                    END AS tipo,
                    COALESCE(clasificacion, 'cliente') AS clasificacion,
                    telefono, email, direccion, notas,
                    activo, created_at
             FROM socios_ordenados
             WHERE activo = TRUE
             ORDER BY created_at DESC, nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

app.post('/api/tms/socios', authenticateToken, async (req, res) => {
    const { codigoCliente, nombre, empresa, identificacion, tipo, clasificacion, telefono, email, direccion, notas } = req.body;
    try {
        const finalCodigoCliente = codigoCliente?.trim() || await generateClientCode();
        const result = await pgQuery(
            `INSERT INTO clientes (codigo_cliente, nombre, empresa, identificacion, tipo, clasificacion, telefono, email, direccion, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, codigo_cliente`,
            [
                finalCodigoCliente,
                nombre,
                empresa || null,
                identificacion || null,
                tipo || 'cliente',
                clasificacion || 'cliente',
                telefono || null,
                email || null,
                direccion || null,
                notas || null,
            ]
        );
        res.json({ success: true, id: result.rows[0].id, codigoCliente: result.rows[0].codigo_cliente });
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

app.put('/api/tms/socios/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, empresa, identificacion, tipo, clasificacion, telefono, email, direccion, notas } = req.body;
    try {
        await pgQuery(
            `UPDATE clientes SET
                nombre = $1,
                empresa = $2,
                identificacion = $3,
                tipo = $4,
                clasificacion = $5,
                telefono = $6,
                email = $7,
                direccion = $8,
                notas = $9,
                updated_at = NOW()
             WHERE id = $10`,
            [
                nombre,
                empresa || null,
                identificacion || null,
                tipo || 'cliente',
                clasificacion || 'cliente',
                telefono || null,
                email || null,
                direccion || null,
                notas || null,
                id,
            ]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

app.delete('/api/tms/socios/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pgQuery('UPDATE clientes SET activo = FALSE WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

// Contactos para Socios
app.get('/api/tms/socios/:clienteId/contactos', authenticateToken, async (req, res) => {
    const { clienteId } = req.params;
    try {
        const result = await pgQuery(
            `SELECT id, nombre, cargo, telefono, email, es_principal, notas
             FROM contactos WHERE cliente_id = $1 ORDER BY es_principal DESC, nombre ASC`,
            [clienteId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

app.post('/api/tms/socios/:clienteId/contactos', authenticateToken, async (req, res) => {
    const { clienteId } = req.params;
    const { nombre, cargo, telefono, email, es_principal, notas } = req.body;
    try {
        const result = await pgQuery(
            `INSERT INTO contactos (cliente_id, nombre, cargo, telefono, email, es_principal, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [clienteId, nombre, cargo || null, telefono || null,
                email || null, es_principal || false, notas || null]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

app.put('/api/tms/socios/:clienteId/contactos/:contactoId', authenticateToken, async (req, res) => {
    const { contactoId } = req.params;
    const { nombre, cargo, telefono, email, es_principal, notas } = req.body;
    try {
        await pgQuery(
            `UPDATE contactos SET nombre = $1, cargo = $2, telefono = $3,
                email = $4, es_principal = $5, notas = $6
             WHERE id = $7`,
            [nombre, cargo || null, telefono || null,
                email || null, es_principal || false, notas || null, contactoId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

app.delete('/api/tms/socios/:clienteId/contactos/:contactoId', authenticateToken, async (req, res) => {
    const { contactoId } = req.params;
    try {
        await pgQuery('DELETE FROM contactos WHERE id = $1', [contactoId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: formatDbError(error) });
    }
});

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN GLOBAL
// ─────────────────────────────────────────────────────────────
app.get('/api/tms/config/:clave', authenticateToken, async (req, res) => {
    const { clave } = req.params;
    try {
        const result = await pgQuery('SELECT valor FROM tms_config WHERE clave = $1', [clave]);
        res.json(result.rows[0]?.valor || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/config/:clave', authenticateToken, async (req, res) => {
    const { clave } = req.params;
    const { valor } = req.body;
    try {
        await pgQuery(
            `INSERT INTO tms_config (clave, valor) VALUES ($1, $2)
             ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
            [clave, JSON.stringify(valor)]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// FRONTEND
// ─────────────────────────────────────────────────────────────
app.post('/api/tms/routes/estimate-distance', authenticateToken, async (req, res) => {
    const { origin, destination, originCoords, destinationCoords } = req.body || {};

    try {
        if (!String(origin || '').trim() || !String(destination || '').trim()) {
            return res.status(400).json({ success: false, error: 'Debes indicar origen y destino para calcular la distancia.' });
        }

        const km = await estimateRouteDistanceKm(origin, destination, { originCoords, destinationCoords });
        if (!km) {
            return res.status(404).json({ success: false, error: 'No se pudo estimar la distancia con las ubicaciones indicadas.' });
        }

        res.json({ success: true, km });
    } catch (error) {
        console.error('Error estimando distancia:', error);
        res.status(500).json({ success: false, error: error.message || 'No se pudo estimar la distancia.' });
    }
});

app.post('/api/tms/voice/interpret', authenticateToken, async (req, res) => {
    const { audioBase64, mimeType, conversationHistory } = req.body || {};

    try {
        const apiKey = await getGroqApiKey();
        if (!apiKey) {
            return res.status(400).json({ success: false, error: 'No hay una llave de Groq configurada en Ajustes > APIs.' });
        }

        const audioBuffer = decodeBase64Audio(audioBase64);
        const transcript = await transcribeAudioWithGroq({ apiKey, audioBuffer, mimeType });
        if (!transcript.trim()) {
            throw new Error('No se pudo obtener texto desde el audio grabado.');
        }

        const interpretation = await interpretTranscriptWithGroq({
            apiKey,
            transcript,
            conversationHistory,
        });

        if (
            interpretation?.intent === 'cotizacion' &&
            (!Number(interpretation?.quoteData?.km) || Number(interpretation?.quoteData?.km) <= 0) &&
            interpretation?.quoteData?.origen &&
            interpretation?.quoteData?.destino
        ) {
            try {
                const km = await estimateRouteDistanceKm(interpretation.quoteData.origen, interpretation.quoteData.destino);
                if (km) {
                    interpretation.quoteData.km = km;
                }
            } catch (distanceError) {
                console.error('No se pudo estimar km desde la interpretación de voz:', distanceError);
            }
        }

        res.json({
            success: true,
            transcript,
            interpretation,
        });
    } catch (error) {
        console.error('Error interpretando voz:', error);
        res.status(500).json({ success: false, error: error.message || 'No se pudo procesar la solicitud de voz.' });
    }
});

// ─────────────────────────────────────────────────────────────
// TIPO DE CAMBIO - TABLA Y APIs (debe estar ANTES del SPA fallback)
// ─────────────────────────────────────────────────────────────
async function ensureTipoCambioTable() {
    try {
        await pgQuery(`
            CREATE TABLE IF NOT EXISTS tipos_cambio (
                id SERIAL PRIMARY KEY,
                fecha DATE NOT NULL,
                base VARCHAR(10) NOT NULL,
                rates JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(fecha, base)
            );
            CREATE INDEX IF NOT EXISTS idx_tipos_cambio_fecha ON tipos_cambio(fecha);

            CREATE TABLE IF NOT EXISTS tms_combustibles (
                id SERIAL PRIMARY KEY,
                fecha DATE UNIQUE NOT NULL,
                super DECIMAL(10,2) NOT NULL,
                regular DECIMAL(10,2) NOT NULL,
                diesel DECIMAL(10,2) NOT NULL,
                kerosene DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (error) {
        console.warn('No se pudo crear tablas de configuración:', error.message);
    }
}

const CURRENCIES = [
    { code: "usd", name: "Dólar estadounidense", flag: "🇺🇸", symbol: "$" },
    { code: "crc", name: "Colón (Costa Rica)", flag: "🇨🇷", symbol: "₡" },
    { code: "eur", name: "Euro", flag: "🇪🇺", symbol: "€" },
];

async function fetchTipoCambioFromAPI(base = 'usd') {
    try {
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rates = data[base];
        return { 
            success: true, 
            date: data.date, 
            rates: {
                crc: rates.crc,
                eur: rates.eur
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// API: Obtener tipo de cambio actual (CRC y EUR)
app.get('/api/tms/tipos-cambio/actual', authenticateToken, async (req, res) => {
    try {
        const result = await fetchTipoCambioFromAPI('usd');
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        res.json({ success: true, date: result.date, base: 'usd', rates: result.rates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Guardar tipo de cambio (CRC y EUR)
app.post('/api/tms/tipos-cambio', authenticateToken, async (req, res) => {
    try {
        const { fecha, rates } = req.body;
        if (!fecha || !rates) {
            return res.status(400).json({ error: 'Faltan datos requeridos (fecha o rates)' });
        }
        
        await pgQuery(`
            INSERT INTO tipos_cambio (fecha, base, rates)
            VALUES ($1, 'usd', $2)
            ON CONFLICT (fecha, base) DO UPDATE SET rates = $2
        `, [fecha, JSON.stringify({ crc: rates.crc, eur: rates.eur })]);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Obtener historial
app.get('/api/tms/tipos-cambio/historial', authenticateToken, async (req, res) => {
    try {
        const { limit = 30 } = req.query;
        const result = await pgQuery(`
            SELECT id, fecha, base, rates, created_at
            FROM tipos_cambio
            WHERE base = 'usd'
            ORDER BY fecha DESC
            LIMIT $1
        `, [parseInt(limit)]);
        
        res.json({ success: true, historial: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Auto-actualización manual
app.post('/api/tms/tipos-cambio/auto-actualizar', authenticateToken, async (req, res) => {
    try {
        const result = await fetchTipoCambioFromAPI('usd');
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        await pgQuery(`
            INSERT INTO tipos_cambio (fecha, base, rates)
            VALUES ($1, 'usd', $2)
            ON CONFLICT (fecha, base) DO UPDATE SET rates = $2
        `, [today, JSON.stringify(result.rates)]);
        
        res.json({ success: true, date: result.date, rates: result.rates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- COMBUSTIBLES ---
app.get('/api/tms/combustibles/actual', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery(`SELECT * FROM tms_combustibles ORDER BY fecha DESC, created_at DESC LIMIT 1`);
        if (result.rows.length > 0) {
            const row = result.rows[0];
            res.json({ success: true, date: row.fecha, prices: { super: row.super, regular: row.regular, diesel: row.diesel, kerosene: row.kerosene } });
        } else {
            // Valores por defecto del archivo subido
            res.json({ success: true, date: '2026-03-14', prices: { super: 633, regular: 607, diesel: 530, kerosene: 478 } });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tms/combustibles/historial', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery(`SELECT * FROM tms_combustibles ORDER BY fecha DESC, created_at DESC LIMIT 50`);
        res.json({ success: true, history: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/combustibles', authenticateToken, async (req, res) => {
    try {
        const { fecha, prices } = req.body;
        await pgQuery(`
            INSERT INTO tms_combustibles (fecha, super, regular, diesel, kerosene)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (fecha) DO UPDATE SET super = $2, regular = $3, diesel = $4, kerosene = $5, created_at = NOW()
        `, [fecha, prices.super, prices.regular, prices.diesel, prices.kerosene]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function fetchCombustiblesFromAPI() {
    try {
        // En una implementación real, aquí se usaría un scraper para recope.go.cr
        // Por ahora devolvemos los valores actuales conocidos
        return {
            success: true,
            date: new Date().toISOString().split('T')[0],
            prices: { super: 633, regular: 607, diesel: 530, kerosene: 478 }
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

app.post('/api/tms/combustibles/auto-actualizar', authenticateToken, async (req, res) => {
    try {
        const result = await fetchCombustiblesFromAPI();
        if (result.success) {
            await pgQuery(`
                INSERT INTO tms_combustibles (fecha, super, regular, diesel, kerosene)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (fecha) DO UPDATE SET super = $2, regular = $3, diesel = $4, kerosene = $5, created_at = NOW()
            `, [result.date, result.prices.super, result.prices.regular, result.prices.diesel, result.prices.kerosene]);
            res.json(result);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tms/combustibles/programacion', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery(`SELECT valor FROM tms_config WHERE clave = 'combustibles_programacion'`);
        const raw = result.rows.length > 0 ? result.rows[0].valor : null;
        const programacion = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { hora: '08:00', activo: false };
        res.json({ success: true, programacion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/combustibles/programacion', authenticateToken, async (req, res) => {
    try {
        const programacion = req.body;
        await pgQuery(`
            INSERT INTO tms_config (clave, valor)
            VALUES ('combustibles_programacion', $1)
            ON CONFLICT (clave) DO UPDATE SET valor = $1
        `, [JSON.stringify(programacion)]);
        
        await cargarProgramacionCombustibles();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Obtener/configurar programación automática
app.get('/api/tms/tipos-cambio/programacion', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT clave, valor FROM tms_config WHERE clave = 'tipo_cambio_programacion'
        `);
        
        const raw = result.rows.length > 0 ? result.rows[0].valor : null;
        const programacion = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { hora: '08:00', activo: false };
        
        res.json({ success: true, programacion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/tipos-cambio/programacion', authenticateToken, async (req, res) => {
    try {
        const { hora, activo } = req.body;
        
        await pgQuery(`
            INSERT INTO tms_config (clave, valor)
            VALUES ('tipo_cambio_programacion', $1)
            ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = NOW()
        `, [JSON.stringify({ hora: hora || '08:00', activo: activo || false })]);
        
        // Actualizar en memoria y reiniciar el intervalo si es necesario
        await cargarProgramacion();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Obtener el último tipo de cambio guardado (para usar en proformas)
app.get('/api/tms/tipos-cambio/ultimo', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT fecha, rates FROM tipos_cambio
            WHERE base = 'usd'
            ORDER BY fecha DESC
            LIMIT 1
        `);
        
        if (result.rows.length === 0) {
            return res.json({ success: true, rates: null, fecha: null });
        }
        
        const rates = typeof result.rows[0].rates === 'string' ? JSON.parse(result.rows[0].rates) : result.rows[0].rates;
        res.json({ success: true, rates, fecha: result.rows[0].fecha });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Programación automática - revisar cada minuto
let tipoCambioProgramacion = { hora: '08:00', activo: false };
let tipoCambioInterval = null;

async function cargarProgramacion() {
    try {
        const result = await pgQuery(`SELECT valor FROM tms_config WHERE clave = 'tipo_cambio_programacion'`);
        if (result.rows.length > 0) {
            const raw = result.rows[0].valor;
            tipoCambioProgramacion = typeof raw === 'string' ? JSON.parse(raw) : raw;
            iniciarProgramacionAuto();
        }
    } catch (e) {
        console.warn('No se pudo cargar programación de tipo de cambio:', e.message);
    }
}

function iniciarProgramacionAuto() {
    if (tipoCambioInterval) clearInterval(tipoCambioInterval);
    
    if (!tipoCambioProgramacion.activo) return;
    
    tipoCambioInterval = setInterval(async () => {
        const now = new Date();
        const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (horaActual === tipoCambioProgramacion.hora) {
            try {
                const result = await fetchTipoCambioFromAPI('usd');
                if (result.success) {
                    const today = new Date().toISOString().split('T')[0];
                    await pgQuery(`
                        INSERT INTO tipos_cambio (fecha, base, rates)
                        VALUES ($1, 'usd', $2)
                        ON CONFLICT (fecha, base) DO UPDATE SET rates = $2
                    `, [today, JSON.stringify(result.rates)]);
                    console.log('✔ Tipo de cambio (CRC/EUR) actualizado automáticamente a las', horaActual);
                }
            } catch (e) {
                console.warn('Error en auto-actualización de tipo de cambio:', e.message);
            }
        }
    }, 60000); // Revisar cada minuto
}

let combustiblesProgramacion = { hora: '08:00', activo: false };
let combustiblesInterval = null;

async function cargarProgramacionCombustibles() {
    try {
        const result = await pgQuery(`SELECT valor FROM tms_config WHERE clave = 'combustibles_programacion'`);
        if (result.rows.length > 0) {
            const raw = result.rows[0].valor;
            combustiblesProgramacion = typeof raw === 'string' ? JSON.parse(raw) : raw;
            iniciarProgramacionCombustiblesAuto();
        }
    } catch (e) {
        console.warn('No se pudo cargar programación de combustibles:', e.message);
    }
}

function iniciarProgramacionCombustiblesAuto() {
    if (combustiblesInterval) clearInterval(combustiblesInterval);
    if (!combustiblesProgramacion.activo) return;
    
    combustiblesInterval = setInterval(async () => {
        const now = new Date();
        const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (horaActual === combustiblesProgramacion.hora) {
            try {
                const result = await fetchCombustiblesFromAPI();
                if (result.success) {
                    await pgQuery(`
                        INSERT INTO tms_combustibles (fecha, super, regular, diesel, kerosene)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (fecha) DO UPDATE SET super = $2, regular = $3, diesel = $4, kerosene = $5, created_at = NOW()
                    `, [result.date, result.prices.super, result.prices.regular, result.prices.diesel, result.prices.kerosene]);
                    console.log('✔ Precios de combustibles actualizados automáticamente a las', horaActual);
                }
            } catch (e) {
                console.warn('Error en auto-actualización de combustibles:', e.message);
            }
        }
    }, 60000);
}

// Iniciar al cargar el servidor
ensureTipoCambioTable().then(async () => {
    await cargarProgramacion();
    await cargarProgramacionCombustibles();
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await pgQuery(`
            SELECT fecha FROM tipos_cambio WHERE base = 'usd' ORDER BY fecha DESC LIMIT 1
        `);
        
        if (result.rows.length === 0 || result.rows[0].fecha !== today) {
            const apiResult = await fetchTipoCambioFromAPI('usd');
            if (apiResult.success) {
                await pgQuery(`
                    INSERT INTO tipos_cambio (fecha, base, rates)
                    VALUES ($1, 'usd', $2)
                    ON CONFLICT (fecha, base) DO UPDATE SET rates = $2
                `, [today, JSON.stringify(apiResult.rates)]);
                console.log('✔ Tipo de cambio CRC/EUR actualizado automáticamente');
            }
        }
    } catch (e) {
        console.warn('No se pudo inicializar tipo de cambio:', e.message);
    }
});

// ─────────────────────────────────────────────────────────────
// SPA FALLBACK - debe estar al final de todas las rutas API
// ─────────────────────────────────────────────────────────────
const __distDir = path.join(__dirname, 'dist');
if (fs.existsSync(__distDir)) {
    app.use(express.static(__distDir));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__distDir, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Servidor TransOP Activo. Backend operativo. (Frontend no encontrado en /dist)');
    });
}

app.listen(PORT, () => {
    console.log(`\x1b[32m✔ Servidor TransOP cargado correctamente\x1b[0m`);
    console.log(`\x1b[36m➜ API escuchando en http://localhost:${PORT}\x1b[0m`);
});

export default app;
