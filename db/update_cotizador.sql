-- TMS — ACTUALIZACIÓN PARA COTIZADOR
-- Ejecutar en la base de datos db_transop

-- 1. Agregar columnas de tarifas a la tabla de vehículos
DO $$ 
BEGIN 
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS colaborador DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS peajes DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS viaticos DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS utilidad DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS adic_col DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS adic_viat DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tarifa_gam DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS media_tarifa DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS t_in_sj DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS t_out_sj DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS t_in_ctg DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS t_out_ctg DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS hospedaje DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS viatico_diario DECIMAL(12,2) DEFAULT 0;
END $$;

-- 2. Crear tabla de proformas si no existe
CREATE TABLE IF NOT EXISTS tms_cotizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero VARCHAR(50) UNIQUE NOT NULL,
    cliente_nombre VARCHAR(200),
    cliente_empresa VARCHAR(200),
    fecha_emision TIMESTAMPTZ DEFAULT NOW(),
    total_usd DECIMAL(12,2),
    data_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear tabla de configuración si no existe
CREATE TABLE IF NOT EXISTS tms_config (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Triggers para updated_at (asumiendo que fn_updated_at existe como en tms_schema.sql)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cotizaciones_upd') THEN
        CREATE TRIGGER trg_cotizaciones_upd BEFORE UPDATE ON tms_cotizaciones FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tms_config_upd') THEN
        CREATE TRIGGER trg_tms_config_upd BEFORE UPDATE ON tms_config FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
    END IF;
END $$;
