

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ROOT = __dirname;
const DATA_ROOT = path.resolve(__dirname, '..');

app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// =============================================================
// AUTHENTICATION & SECURITY
// =============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

// Middleware for JWT validation
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

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pgQuery('SELECT * FROM usuarios WHERE username = $1 AND activo = TRUE', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol, es_root: user.es_root },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                nombre: user.nombre,
                username: user.username,
                rol: user.rol,
                foto_url: user.foto_url
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================================
// TMS — API ENDPOINTS
// =============================================================

// Gestión de Usuarios (Sólo Admin)
app.get('/api/tms/usuarios', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    try {
        // Ocultar al root del listado normal para seguridad
        const result = await pgQuery('SELECT id, nombre, username, email, rol, activo, foto_url FROM usuarios WHERE es_root = FALSE ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/usuarios', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    const { nombre, username, email, password, rol, foto_url } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 10);
        await pgQuery(
            `INSERT INTO usuarios (nombre, username, email, password_hash, rol, foto_url) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [nombre, username, email, password_hash, rol, foto_url]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tms/usuarios/:id', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    try {
        // No permitir borrar al superadmin (aunque no debería salir en la lista)
        await pgQuery('DELETE FROM usuarios WHERE id = $1 AND es_root = FALSE', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Vehículos y Tarifas
app.get('/api/tms/vehiculos', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery('SELECT * FROM vehiculos WHERE activo = TRUE ORDER BY placa ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tms/vehiculos/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const {
        colaborador, combustible_costo, combustible_tipo, peajes, viaticos, utilidad, adic_col, adic_viat,
        tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
        hospedaje, viatico_diario
    } = req.body;
    
    try {
        await pgQuery(
            `UPDATE vehiculos SET 
                colaborador = $1, combustible_costo = $2, combustible_tipo = $3, peajes = $4, viaticos = $5, utilidad = $6, adic_col = $7, adic_viat = $8,
                tarifa_gam = $9, media_tarifa = $10, t_in_sj = $11, t_out_sj = $12, t_in_ctg = $13, t_out_ctg = $14,
                hospedaje = $15, viatico_diario = $16, updated_at = NOW()
             WHERE id = $17`,
            [colaborador, combustible_costo, combustible_tipo, peajes, viaticos, utilidad, adic_col, adic_viat,
             tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
             hospedaje, viatico_diario, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proformas / Cotizaciones
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

// Configuración Global
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

// Servir el frontend de React generado por Vite (dist)
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    
    // Todas las demás peticiones (que no sean /api) van a index.html (React Router)
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api/')) {
            res.sendFile(path.join(DIST_DIR, 'index.html'));
        } else {
            res.status(404).json({ error: 'Endpoint no encontrado' });
        }
    });
}

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

export default app;
