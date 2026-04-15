-- =============================================================
-- TMS — Sistema de Gestión de Transporte Terrestre
-- Base de datos PostgreSQL — Esquema completo v1.1 (Restored)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- USUARIOS DEL SISTEMA
-- =============================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    username        VARCHAR(100) UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('admin','operador','supervisor','conductor')),
    conductor_id    UUID,  -- FK agregada luego
    es_root         BOOLEAN DEFAULT FALSE,
    activo          BOOLEAN DEFAULT TRUE,
    foto_url        TEXT,
    ultimo_acceso   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- CLIENTES / SOCIOS
-- =============================================================
CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    empresa         VARCHAR(200),
    identificacion  VARCHAR(50),
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('empresa','persona')),
    telefono        VARCHAR(30),
    email           VARCHAR(150),
    direccion       TEXT,
    notas           TEXT,
    activo          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contactos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre          VARCHAR(200) NOT NULL,
    cargo           VARCHAR(100),
    telefono        VARCHAR(30),
    email           VARCHAR(150),
    es_principal    BOOLEAN DEFAULT FALSE,
    notas           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- CONDUCTORES
-- =============================================================
CREATE TABLE conductores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    cedula          VARCHAR(20) UNIQUE NOT NULL,
    telefono        VARCHAR(30),
    telefono_alt    VARCHAR(30),
    direccion       TEXT,
    alias           VARCHAR(50),
    foto_url        TEXT,
    estado          VARCHAR(20) NOT NULL DEFAULT 'disponible'
                    CHECK (estado IN ('disponible','en_servicio','enfermo','vacaciones','suspendido','inactivo')),
    notas           TEXT,
    activo          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE licencias (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conductor_id    UUID NOT NULL REFERENCES conductores(id) ON DELETE CASCADE,
    tipo            VARCHAR(10) NOT NULL,
    numero          VARCHAR(30),
    fecha_emision   DATE,
    fecha_vencimiento DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- VEHÍCULOS
-- =============================================================
CREATE TABLE vehiculos (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    placa                   VARCHAR(20) UNIQUE NOT NULL,
    marca                   VARCHAR(100),
    modelo                  VARCHAR(100),
    anio                    INTEGER,
    tipo                    VARCHAR(30) NOT NULL
                            CHECK (tipo IN ('bus','buseta','microbus','van','sedan','otro')),
    capacidad_pasajeros     INTEGER NOT NULL,
    color                   VARCHAR(50),
    conductor_asignado_id   UUID REFERENCES conductores(id),
    km_actual               INTEGER DEFAULT 0,
    fecha_revision_tecnica  DATE,
    fecha_marchamo          DATE,
    fecha_seguro            DATE,
    licencia_requerida      VARCHAR(10),
    estado                  VARCHAR(25) NOT NULL DEFAULT 'disponible'
                            CHECK (estado IN ('disponible','en_servicio','mantenimiento','fuera_de_servicio')),
    foto_url                TEXT,
    notas                   TEXT,
    -- Campos especiales para el Cotizador
    colaborador             DECIMAL(12,2) DEFAULT 0,
    combustible_costo       DECIMAL(12,2) DEFAULT 0,
    combustible_tipo        VARCHAR(20) DEFAULT 'Diésel',
    peajes                  DECIMAL(12,2) DEFAULT 0,
    viaticos                DECIMAL(12,2) DEFAULT 0,
    utilidad                DECIMAL(12,2) DEFAULT 0,
    adic_col                DECIMAL(12,2) DEFAULT 0,
    adic_viat               DECIMAL(12,2) DEFAULT 0,
    tarifa_gam              DECIMAL(12,2) DEFAULT 0,
    media_tarifa            DECIMAL(12,2) DEFAULT 0,
    t_in_sj                 DECIMAL(12,2) DEFAULT 0,
    t_out_sj                DECIMAL(12,2) DEFAULT 0,
    t_in_ctg                DECIMAL(12,2) DEFAULT 0,
    t_out_ctg               DECIMAL(12,2) DEFAULT 0,
    hospedaje               DECIMAL(12,2) DEFAULT 0,
    viatico_diario          DECIMAL(12,2) DEFAULT 0,
    activo                  BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- EVENTOS Y TAREAS
-- =============================================================
CREATE TABLE eventos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id),
    nombre          VARCHAR(300) NOT NULL,
    descripcion     TEXT,
    estado          VARCHAR(20) NOT NULL DEFAULT 'planificado'
                    CHECK (estado IN ('planificado','confirmado','en_curso','finalizado','cancelado')),
    prioridad       VARCHAR(10) DEFAULT 'normal'
                    CHECK (prioridad IN ('baja','normal','alta','urgente')),
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    pax_estimados   INTEGER,
    notas           TEXT,
    creado_por      UUID REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tareas (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id               UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    conductor_id            UUID REFERENCES conductores(id),
    vehiculo_id             UUID REFERENCES vehiculos(id),
    nombre                  VARCHAR(300) NOT NULL,
    descripcion             TEXT,
    fecha_salida            TIMESTAMPTZ NOT NULL,
    llegada_estimada        TIMESTAMPTZ,
    hora_regreso            TIMESTAMPTZ,
    punto_salida            VARCHAR(300),
    destino                 VARCHAR(300),
    estado                  VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','asignada','en_ruta','completada','cancelada','incidencia')),
    pasajeros               INTEGER,
    notas_operativas        TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- TMS — COTIZACIONES / PROFORMAS (Módulo Adicional)
-- =============================================================
CREATE TABLE tms_cotizaciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero          VARCHAR(50) UNIQUE NOT NULL,
    cliente_nombre  VARCHAR(200),
    cliente_empresa VARCHAR(200),
    fecha_emision   TIMESTAMPTZ DEFAULT NOW(),
    total_usd       DECIMAL(12,2),
    data_json       JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tms_config (
    id              SERIAL PRIMARY KEY,
    clave           VARCHAR(50) UNIQUE NOT NULL,
    valor           JSONB,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tms_gastos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehiculo_id     UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'otro',
    detalle         TEXT NOT NULL,
    monto           DECIMAL(12,2) NOT NULL DEFAULT 0,
    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tms_gasto_adjuntos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gasto_id        UUID NOT NULL REFERENCES tms_gastos(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255),
    archivo_path    TEXT NOT NULL,
    mime_type       VARCHAR(120),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- FUNCIONES Y TRIGGERS
-- =============================================================
CREATE OR REPLACE FUNCTION fn_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_upd    BEFORE UPDATE ON usuarios    FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_clientes_upd    BEFORE UPDATE ON clientes    FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_conductores_upd BEFORE UPDATE ON conductores FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_vehiculos_upd   BEFORE UPDATE ON vehiculos   FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_eventos_upd     BEFORE UPDATE ON eventos     FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_tareas_upd      BEFORE UPDATE ON tareas      FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_cotizaciones_upd BEFORE UPDATE ON tms_cotizaciones FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_tms_config_upd    BEFORE UPDATE ON tms_config       FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- FK circular usuarios ↔ conductores (Opcional)
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_conductor FOREIGN KEY (conductor_id) REFERENCES conductores(id) ON DELETE SET NULL;

-- =============================================================
-- DATOS INICIALES (SEED DATA)
-- =============================================================

-- 1. Insertar Vehículos con Tarifas Base para el Cotizador
INSERT INTO vehiculos (placa, marca, modelo, tipo, capacidad_pasajeros, colaborador, combustible_costo, combustible_tipo, peajes, viaticos, utilidad, adic_col, adic_viat, tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg, hospedaje, viatico_diario)
VALUES 
('TPS-001', 'Toyota', 'Hiace', 'van', 14, 25.00, 0.18, 'Diésel', 15.00, 10.00, 50.00, 15.00, 15.00, 150.00, 75.00, 50.00, 45.00, 65.00, 60.00, 40.00, 25.00),
('TPS-002', 'Toyota', 'Coaster', 'buseta', 22, 35.00, 0.25, 'Diésel', 20.00, 15.00, 70.00, 20.00, 20.00, 190.00, 100.00, 70.00, 65.00, 85.00, 80.00, 50.00, 30.00),
('TPS-003', 'Fuso', 'Rosa', 'buseta', 28, 40.00, 0.30, 'Gasolina', 25.00, 15.00, 80.00, 25.00, 25.00, 220.00, 110.00, 80.00, 75.00, 95.00, 90.00, 50.00, 35.00);

-- 2. Insertar Usuario Administrador Root (Password: admin1234)
-- Hash para: admin1234
INSERT INTO usuarios (nombre, username, email, password_hash, rol, es_root)
VALUES 
('Super Administrador', 'superadmin', 'admin@transop.cr', '$2b$10$WjKjT3WgFf2PrGjS1xzmxufsDbheRALSPW8ZvA04hDDewWnKPDZf2', 'admin', true);

-- 3. Insertar Historial de Proformas de Ejemplo
INSERT INTO tms_cotizaciones (numero, cliente_nombre, cliente_empresa, total_usd, data_json)
VALUES 
('PRO-2026-001', 'Juan Pérez', 'Tour Manager CR', 450.00, '{"params":{"km":250,"combustible":0.18,"tipoCombustible":"Diésel","tc":520,"colaborador":25,"peajes":15,"viaticos":10,"ferry":0,"utilidad":50,"iva":13,"chkDia":false},"socio":{"cfNumero":"PRO-2026-001","cfValidez":15,"cfPago":"Contado","cfDescripcion":"Transporte San José a Fortuna","sNombre":"Juan Pérez","sEmpresa":"Tour Manager CR","sPax":10,"sFecha":"2026-04-15","sOrigen":"San José","sDestino":"La Fortuna"}}'),
('PRO-2026-002', 'María Rodríguez', 'EcoTours Lib', 320.00, '{"params":{"km":120,"combustible":0.20,"tipoCombustible":"Diésel","tc":520,"colaborador":30,"peajes":10,"viaticos":15,"ferry":20,"utilidad":60,"iva":13,"chkDia":true,"adicCol":15,"adicViat":15},"socio":{"cfNumero":"PRO-2026-002","cfValidez":10,"cfPago":"50/50","cfDescripcion":"Transfer Aeropuerto Liberia","sNombre":"María Rodríguez","sEmpresa":"EcoTours Lib","sPax":4,"sFecha":"2026-04-18","sOrigen":"Aeropuerto LIR","sDestino":"Hotel Riu"}}');

-- 4. Insertar Configuración Global (Branding)
INSERT INTO tms_config (clave, valor)
VALUES 
('global', '{"params":{"km":0,"combustible":0.18,"tipoCombustible":"Diésel","tc":520,"colaborador":25,"peajes":15,"viaticos":10,"ferry":0,"utilidad":50,"iva":13,"chkDia":false},"empresa":{"nombre":"Transportes Miguel","tel":"+506 8888-0000","email":"info@transportesmiguel.cr","web":"www.transportesmiguel.cr","cedJur":"3-101-XXXXXX","pais":"San José, Costa Rica","dir":"San José Centro, 100m Este del Teatro Nacional"}}');
