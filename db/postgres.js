import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pkg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_CONFIG_PATH = path.resolve(__dirname, '../config/db-connection.json');

let pool = null;
let activeConfigCache = null;

function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value !== 'string') return false;
    return ['true', '1', 'yes', 'si', 'on'].includes(value.trim().toLowerCase());
}

function parseConnectionString(connectionString) {
    if (!connectionString) return null;

    try {
        const url = new URL(connectionString);
        return {
            host: url.hostname || 'localhost',
            port: url.port ? Number(url.port) : 5432,
            database: url.pathname.replace(/^\//, ''),
            user: decodeURIComponent(url.username || ''),
            password: decodeURIComponent(url.password || ''),
            ssl: toBoolean(url.searchParams.get('ssl')) || toBoolean(url.searchParams.get('sslmode')) || connectionString.includes('render.com'),
        };
    } catch {
        return null;
    }
}

function buildConnectionString(config) {
    const user = encodeURIComponent(config.user || '');
    const password = encodeURIComponent(config.password || '');
    const auth = password ? `${user}:${password}` : user;
    return `postgres://${auth}@${config.host}:${config.port}/${config.database}`;
}

function normalizeConfig(rawConfig = {}) {
    const parsedUrl = parseConnectionString(rawConfig.connectionString);
    const merged = {
        host: rawConfig.host || parsedUrl?.host || 'localhost',
        port: Number(rawConfig.port || parsedUrl?.port || 5432),
        database: rawConfig.database || parsedUrl?.database || '',
        user: rawConfig.user || parsedUrl?.user || '',
        password: rawConfig.password ?? parsedUrl?.password ?? '',
        ssl: toBoolean(rawConfig.ssl ?? parsedUrl?.ssl ?? false),
    };

    return {
        ...merged,
        connectionString: buildConnectionString(merged),
    };
}

function readStoredConfig() {
    if (!fs.existsSync(DB_CONFIG_PATH)) return null;

    try {
        const raw = JSON.parse(fs.readFileSync(DB_CONFIG_PATH, 'utf8'));
        return normalizeConfig(raw);
    } catch (error) {
        console.error('No se pudo leer config/db-connection.json:', error.message);
        return null;
    }
}

function getEnvConfig() {
    if (!process.env.DATABASE_URL) return null;
    return normalizeConfig({ connectionString: process.env.DATABASE_URL });
}

function getEffectiveConfig() {
    return readStoredConfig() || getEnvConfig();
}

function createPool(config) {
    if (!config?.connectionString) {
        throw new Error('No hay configuración de base de datos. Configure la conexión desde Ajustes o defina DATABASE_URL.');
    }

    const isProduction = process.env.NODE_ENV === 'production' || config.connectionString.includes('render.com');

    return new Pool({
        connectionString: config.connectionString,
        ssl: config.ssl || isProduction ? { rejectUnauthorized: false } : false,
    });
}

async function ensurePool() {
    if (!pool) {
        activeConfigCache = getEffectiveConfig();
        pool = createPool(activeConfigCache);
    }

    return pool;
}

export function getDatabaseConfig() {
    const stored = readStoredConfig();
    const envConfig = getEnvConfig();
    const effective = stored || envConfig || {
        host: 'localhost',
        port: 5432,
        database: '',
        user: '',
        password: '',
        ssl: false,
        connectionString: '',
    };

    return {
        source: stored ? 'archivo-local' : envConfig ? 'env' : 'sin-configurar',
        config: effective,
    };
}

export async function testConnection(rawConfig) {
    const config = normalizeConfig(rawConfig || getDatabaseConfig().config);
    const tempPool = createPool(config);

    try {
        const result = await tempPool.query(`
            SELECT
                current_database() AS database,
                current_user AS user,
                inet_server_addr()::text AS host,
                inet_server_port() AS port,
                NOW() AS server_time
        `);

        return {
            ok: true,
            config,
            meta: result.rows[0],
        };
    } finally {
        await tempPool.end().catch(() => {});
    }
}

export async function saveDatabaseConfig(rawConfig) {
    const normalized = normalizeConfig(rawConfig);

    fs.writeFileSync(DB_CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

    if (pool) {
        await pool.end().catch(() => {});
    }

    activeConfigCache = normalized;
    pool = createPool(normalized);

    return normalized;
}

export async function query(text, params) {
    try {
        const activePool = await ensurePool();
        return await activePool.query(text, params);
    } catch (error) {
        console.error('Error en ejecución de query:', error.message);
        throw error;
    }
}

export async function withTransaction(work) {
    const activePool = await ensurePool();
    const client = await activePool.connect();

    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transacción fallida, realizando ROLLBACK:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

export async function closePool() {
    if (!pool) return;
    await pool.end().catch(() => {});
    pool = null;
}

export { activeConfigCache };
