import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// En Render, DATABASE_URL se configura en la pestaña Environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL no está definido. Configura la variable de entorno en el panel de Render o en tu archivo .env local.');
}

// Configuración de SSL optimizada para Render
const isProduction = process.env.NODE_ENV === 'production' || connectionString.includes('render.com');

export const pool = new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

/**
 * Ejecuta una consulta simple
 */
export async function query(text, params) {
    try {
        return await pool.query(text, params);
    } catch (error) {
        console.error('Error en ejecución de query:', error.message);
        throw error;
    }
}

/**
 * Ejecuta un conjunto de operaciones dentro de una transacción SQL
 */
export async function withTransaction(work) {
    const client = await pool.connect();
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