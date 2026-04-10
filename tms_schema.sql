-- =============================================================
-- TMS — Sistema de Gestión de Transporte Terrestre
-- Base de datos PostgreSQL — Esquema completo v1.0
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- USUARIOS DEL SISTEMA
-- =============================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('admin','operador','supervisor','conductor')),
    conductor_id    UUID,  -- FK agregada luego (referencia circular)
    activo          BOOLEAN DEFAULT TRUE,
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
    tipo            VARCHAR(10) NOT NULL,  -- A, B, C, D, E, F
    numero          VARCHAR(30),
    fecha_emision   DATE,
    fecha_vencimiento DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evaluaciones_conductor (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conductor_id    UUID NOT NULL REFERENCES conductores(id),
    evaluador_id    UUID REFERENCES usuarios(id),
    puntuacion      SMALLINT CHECK (puntuacion BETWEEN 1 AND 5),
    comentario      TEXT,
    fecha           DATE NOT NULL,
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
    estado                  VARCHAR(25) NOT NULL DEFAULT 'disponible'
                            CHECK (estado IN ('disponible','en_servicio','mantenimiento','fuera_de_servicio')),
    foto_url                TEXT,
    notas                   TEXT,
    activo                  BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mantenimientos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehiculo_id     UUID NOT NULL REFERENCES vehiculos(id),
    tipo            VARCHAR(30) NOT NULL
                    CHECK (tipo IN ('preventivo','correctivo','revision_tecnica','otro')),
    descripcion     TEXT,
    fecha           DATE NOT NULL,
    costo           DECIMAL(12,2),
    moneda          VARCHAR(3) DEFAULT 'CRC',
    proveedor       VARCHAR(200),
    km_al_momento   INTEGER,
    proximo_mant    DATE,
    registrado_por  UUID REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- EVENTOS (cada contrato/servicio)
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

-- =============================================================
-- TAREAS (unidad operativa mínima)
-- =============================================================
CREATE TABLE tareas (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id               UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    conductor_id            UUID REFERENCES conductores(id),
    vehiculo_id             UUID REFERENCES vehiculos(id),
    nombre                  VARCHAR(300) NOT NULL,
    descripcion             TEXT,
    tipo_servicio           VARCHAR(50),
    -- Ruta
    punto_salida            VARCHAR(300),
    salida_lat              DECIMAL(10,8),
    salida_lng              DECIMAL(11,8),
    destino                 VARCHAR(300),
    destino_lat             DECIMAL(10,8),
    destino_lng             DECIMAL(11,8),
    -- Tiempos
    fecha_salida            TIMESTAMPTZ NOT NULL,
    llegada_estimada        TIMESTAMPTZ,
    hora_regreso            TIMESTAMPTZ,
    inicio_real             TIMESTAMPTZ,
    fin_real                TIMESTAMPTZ,
    -- Operación
    pasajeros               INTEGER,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','asignada','en_ruta','completada','cancelada','incidencia')),
    -- Contacto en destino
    contacto_nombre         VARCHAR(200),
    contacto_telefono       VARCHAR(30),
    -- Notas y checklist
    notas_operativas        TEXT,
    checklist               JSONB DEFAULT '[]',
    orden                   INTEGER DEFAULT 0,
    -- Auditoría
    asignado_por            UUID REFERENCES usuarios(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- GASTOS (por tarea o evento)
-- =============================================================
CREATE TABLE gastos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id        UUID REFERENCES tareas(id),
    evento_id       UUID REFERENCES eventos(id),
    tipo            VARCHAR(30) NOT NULL
                    CHECK (tipo IN ('gasolina','hospedaje','alimentacion','peaje','mantenimiento','reparacion','imprevisto','otro')),
    monto           DECIMAL(12,2) NOT NULL,
    moneda          VARCHAR(3) DEFAULT 'CRC',
    descripcion     TEXT,
    comprobante_url TEXT,
    fecha           DATE NOT NULL,
    registrado_por  UUID REFERENCES usuarios(id),
    aprobado        BOOLEAN DEFAULT FALSE,
    aprobado_por    UUID REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- INCIDENCIAS
-- =============================================================
CREATE TABLE incidencias (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id        UUID REFERENCES tareas(id),
    conductor_id    UUID REFERENCES conductores(id),
    vehiculo_id     UUID REFERENCES vehiculos(id),
    tipo            VARCHAR(30) NOT NULL
                    CHECK (tipo IN ('accidente','retraso','fallo_mecanico','enfermedad_conductor','cambio_vehiculo','cancelacion','otro')),
    descripcion     TEXT NOT NULL,
    foto_urls       JSONB DEFAULT '[]',
    severidad       VARCHAR(10) DEFAULT 'media'
                    CHECK (severidad IN ('baja','media','alta','critica')),
    estado          VARCHAR(20) DEFAULT 'abierta'
                    CHECK (estado IN ('abierta','en_gestion','resuelta')),
    resolucion      TEXT,
    reportado_por   UUID REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- GPS — UBICACIONES EN TIEMPO REAL
-- =============================================================
CREATE TABLE ubicaciones_gps (
    id              BIGSERIAL PRIMARY KEY,
    conductor_id    UUID NOT NULL REFERENCES conductores(id),
    tarea_id        UUID REFERENCES tareas(id),
    lat             DECIMAL(10,8) NOT NULL,
    lng             DECIMAL(11,8) NOT NULL,
    velocidad_kmh   DECIMAL(6,2),
    precision_m     DECIMAL(8,2),
    bateria_pct     SMALLINT,
    ts              TIMESTAMPTZ DEFAULT NOW()
)
PARTITION BY RANGE (ts);

-- Particiones mensuales (crear mensualmente)
CREATE TABLE ubicaciones_gps_2026_04 PARTITION OF ubicaciones_gps
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE ubicaciones_gps_2026_05 PARTITION OF ubicaciones_gps
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- =============================================================
-- MENSAJERÍA INTERNA
-- =============================================================
CREATE TABLE mensajes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_usuario_id   UUID REFERENCES usuarios(id),
    para_usuario_id UUID REFERENCES usuarios(id),
    tarea_id        UUID REFERENCES tareas(id),
    contenido       TEXT NOT NULL,
    leido           BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- AUDITORÍA DE CAMBIOS
-- =============================================================
CREATE TABLE auditoria (
    id              BIGSERIAL PRIMARY KEY,
    tabla           VARCHAR(50) NOT NULL,
    registro_id     UUID NOT NULL,
    accion          VARCHAR(10) NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
    datos_previos   JSONB,
    datos_nuevos    JSONB,
    usuario_id      UUID,
    ip_address      VARCHAR(45),
    ts              TIMESTAMPTZ DEFAULT NOW()
);

-- FK circular usuarios ↔ conductores
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_conductor
    FOREIGN KEY (conductor_id) REFERENCES conductores(id);

-- =============================================================
-- ÍNDICES CLAVE
-- =============================================================
-- Tareas (la tabla más consultada)
CREATE INDEX idx_tareas_evento      ON tareas(evento_id);
CREATE INDEX idx_tareas_conductor   ON tareas(conductor_id);
CREATE INDEX idx_tareas_vehiculo    ON tareas(vehiculo_id);
CREATE INDEX idx_tareas_fecha       ON tareas(fecha_salida);
CREATE INDEX idx_tareas_estado      ON tareas(estado);

-- Índice específico para detección de conflictos
CREATE INDEX idx_tareas_conflicto_conductor ON tareas(conductor_id, fecha_salida, hora_regreso)
    WHERE estado NOT IN ('cancelada','completada');
CREATE INDEX idx_tareas_conflicto_vehiculo ON tareas(vehiculo_id, fecha_salida, hora_regreso)
    WHERE estado NOT IN ('cancelada','completada');

-- GPS (serie temporal)
CREATE INDEX idx_gps_conductor_ts   ON ubicaciones_gps(conductor_id, ts DESC);
CREATE INDEX idx_gps_tarea          ON ubicaciones_gps(tarea_id, ts DESC);

-- Alertas de vencimiento
CREATE INDEX idx_licencias_vence    ON licencias(fecha_vencimiento);
CREATE INDEX idx_vehiculos_rev_tec  ON vehiculos(fecha_revision_tecnica);
CREATE INDEX idx_vehiculos_marchamo ON vehiculos(fecha_marchamo);

-- Otros
CREATE INDEX idx_eventos_cliente    ON eventos(cliente_id);
CREATE INDEX idx_eventos_fechas     ON eventos(fecha_inicio, fecha_fin);
CREATE INDEX idx_gastos_tarea       ON gastos(tarea_id);
CREATE INDEX idx_incidencias_tarea  ON incidencias(tarea_id);

-- =============================================================
-- FUNCIÓN: Detección de conflictos de conductor
-- Retorna las tareas que se solapan con el rango dado
-- =============================================================
CREATE OR REPLACE FUNCTION detectar_conflicto_conductor(
    p_conductor_id   UUID,
    p_inicio         TIMESTAMPTZ,
    p_fin            TIMESTAMPTZ,
    p_excluir_id     UUID DEFAULT NULL
)
RETURNS TABLE (
    tarea_id    UUID,
    nombre      VARCHAR,
    salida      TIMESTAMPTZ,
    regreso     TIMESTAMPTZ,
    evento      VARCHAR
)
LANGUAGE sql STABLE AS $$
    SELECT
        t.id,
        t.nombre,
        t.fecha_salida,
        COALESCE(t.hora_regreso, t.llegada_estimada, t.fecha_salida + INTERVAL '2 hours'),
        e.nombre
    FROM tareas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.conductor_id = p_conductor_id
      AND t.estado NOT IN ('cancelada', 'completada')
      AND (p_excluir_id IS NULL OR t.id <> p_excluir_id)
      AND t.fecha_salida < p_fin
      AND COALESCE(t.hora_regreso, t.llegada_estimada, t.fecha_salida + INTERVAL '2 hours') > p_inicio;
$$;

-- =============================================================
-- FUNCIÓN: Detección de conflictos de vehículo
-- =============================================================
CREATE OR REPLACE FUNCTION detectar_conflicto_vehiculo(
    p_vehiculo_id   UUID,
    p_inicio        TIMESTAMPTZ,
    p_fin           TIMESTAMPTZ,
    p_excluir_id    UUID DEFAULT NULL
)
RETURNS TABLE (
    tarea_id    UUID,
    nombre      VARCHAR,
    salida      TIMESTAMPTZ,
    regreso     TIMESTAMPTZ,
    evento      VARCHAR
)
LANGUAGE sql STABLE AS $$
    SELECT
        t.id,
        t.nombre,
        t.fecha_salida,
        COALESCE(t.hora_regreso, t.llegada_estimada, t.fecha_salida + INTERVAL '2 hours'),
        e.nombre
    FROM tareas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.vehiculo_id = p_vehiculo_id
      AND t.estado NOT IN ('cancelada', 'completada')
      AND (p_excluir_id IS NULL OR t.id <> p_excluir_id)
      AND t.fecha_salida < p_fin
      AND COALESCE(t.hora_regreso, t.llegada_estimada, t.fecha_salida + INTERVAL '2 hours') > p_inicio;
$$;

-- =============================================================
-- FUNCIÓN: Conductores disponibles en un rango de tiempo
-- =============================================================
CREATE OR REPLACE FUNCTION conductores_disponibles(
    p_inicio TIMESTAMPTZ,
    p_fin    TIMESTAMPTZ
)
RETURNS TABLE (
    conductor_id UUID,
    nombre       VARCHAR,
    estado       VARCHAR
)
LANGUAGE sql STABLE AS $$
    SELECT c.id, c.nombre, c.estado
    FROM conductores c
    WHERE c.activo = TRUE
      AND c.estado IN ('disponible', 'en_servicio')
      AND c.id NOT IN (
          SELECT DISTINCT t.conductor_id
          FROM tareas t
          WHERE t.conductor_id IS NOT NULL
            AND t.estado NOT IN ('cancelada', 'completada')
            AND t.fecha_salida < p_fin
            AND COALESCE(t.hora_regreso, t.llegada_estimada, t.fecha_salida + INTERVAL '2 hours') > p_inicio
      );
$$;

-- =============================================================
-- FUNCIÓN: Vehículos disponibles en un rango de tiempo
-- =============================================================
CREATE OR REPLACE FUNCTION vehiculos_disponibles(
    p_inicio    TIMESTAMPTZ,
    p_fin       TIMESTAMPTZ,
    p_pax_min   INTEGER DEFAULT 1
)
RETURNS TABLE (
    vehiculo_id UUID,
    placa       VARCHAR,
    tipo        VARCHAR,
    capacidad   INTEGER,
    estado      VARCHAR
)
LANGUAGE sql STABLE AS $$
    SELECT v.id, v.placa, v.tipo, v.capacidad_pasajeros, v.estado
    FROM vehiculos v
    WHERE v.activo = TRUE
      AND v.estado IN ('disponible', 'en_servicio')
      AND v.capacidad_pasajeros >= p_pax_min
      AND v.id NOT IN (
          SELECT DISTINCT t.vehiculo_id
          FROM tareas t
          WHERE t.vehiculo_id IS NOT NULL
            AND t.estado NOT IN ('cancelada', 'completada')
            AND t.fecha_salida < p_fin
            AND COALESCE(t.hora_regreso, t.llegada_estimada, t.fecha_salida + INTERVAL '2 hours') > p_inicio
      );
$$;

-- =============================================================
-- TRIGGER: auto-actualizar updated_at
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
CREATE TRIGGER trg_incidencias_upd BEFORE UPDATE ON incidencias FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- =============================================================
-- VISTA: Dashboard operativo — tareas de hoy
-- =============================================================
CREATE VIEW v_tareas_hoy AS
SELECT
    t.id,
    t.nombre,
    t.estado,
    t.fecha_salida,
    t.hora_regreso,
    t.pasajeros,
    t.punto_salida,
    t.destino,
    e.nombre       AS evento,
    e.prioridad,
    c.nombre       AS conductor,
    c.telefono     AS tel_conductor,
    v.placa,
    v.tipo         AS tipo_vehiculo,
    v.capacidad_pasajeros
FROM tareas t
JOIN eventos e ON e.id = t.evento_id
LEFT JOIN conductores c ON c.id = t.conductor_id
LEFT JOIN vehiculos v ON v.id = t.vehiculo_id
WHERE t.fecha_salida::DATE = CURRENT_DATE
ORDER BY t.fecha_salida;

-- =============================================================
-- VISTA: Alertas de vencimiento (próximos 30 días)
-- =============================================================
CREATE VIEW v_alertas_vencimiento AS
SELECT 'licencia' AS tipo,
       c.nombre   AS entidad,
       l.tipo     AS detalle,
       l.fecha_vencimiento AS vence,
       (l.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
FROM licencias l
JOIN conductores c ON c.id = l.conductor_id
WHERE l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
UNION ALL
SELECT 'revision_tecnica',
       v.placa,
       v.marca || ' ' || v.modelo,
       v.fecha_revision_tecnica,
       (v.fecha_revision_tecnica - CURRENT_DATE)
FROM vehiculos v
WHERE v.fecha_revision_tecnica BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  AND v.activo = TRUE
UNION ALL
SELECT 'marchamo',
       v.placa,
       v.marca || ' ' || v.modelo,
       v.fecha_marchamo,
       (v.fecha_marchamo - CURRENT_DATE)
FROM vehiculos v
WHERE v.fecha_marchamo BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  AND v.activo = TRUE
ORDER BY dias_restantes;

-- =============================================================
-- VISTA: KPIs del día
-- =============================================================
CREATE VIEW v_kpis_hoy AS
SELECT
    COUNT(*) FILTER (WHERE fecha_salida::DATE = CURRENT_DATE)                   AS tareas_hoy,
    COUNT(*) FILTER (WHERE fecha_salida::DATE = CURRENT_DATE AND estado = 'completada')   AS completadas,
    COUNT(*) FILTER (WHERE fecha_salida::DATE = CURRENT_DATE AND estado = 'en_ruta')      AS en_ruta,
    COUNT(*) FILTER (WHERE fecha_salida::DATE = CURRENT_DATE AND estado = 'pendiente')    AS pendientes,
    COUNT(*) FILTER (WHERE fecha_salida::DATE = CURRENT_DATE AND conductor_id IS NULL AND estado NOT IN ('cancelada','completada')) AS sin_asignar
FROM tareas;
