import fs from 'fs';
import path from 'path';

const serverFile = 'E:/Github/TransOp/server.js';
const raw = fs.readFileSync(serverFile, 'utf8');

// Extraer Cabecera e imports (antes de STUBS)
const importsEnd = raw.indexOf('// STUBS para servicios');
let newSource = raw.substring(0, importsEnd).trim() + '\n\n';

// Extraer configuración básica de Express (path y constantes)
const esmStart = raw.indexOf('const __filename = fileURLToPath(import.meta.url);');
const esmEndStr = "const DATA_ROOT = path.resolve(__dirname, '..');";
const esmEnd = raw.indexOf(esmEndStr) + esmEndStr.length;
newSource += raw.substring(esmStart, esmEnd).trim() + '\n\n';

// Middlewares obligatorios
newSource += "app.use(cors());\napp.use(bodyParser.json({ limit: '20mb' }));\napp.use(bodyParser.urlencoded({ extended: true }));\n\n";

// Extraer lógica de Autenticación, TMS endpoints, rutas estáticas y bootloader.
const authStart = raw.indexOf('// =============================================================\n// AUTHENTICATION & SECURITY');
let backendLogic = raw.substring(authStart);

// Remove the first App.post('/api/auth/login') that exists in the flexo block ? 
// Actually authStart is AFTER the first login route, right?
// Wait, in my previous check there was an app.post login at line 4602 and 7517.
// The authStart index `// AUTHENTICATION & SECURITY` is at line 7613.
// So this includes the correct authenticateToken and endpoints.

newSource += backendLogic.trim() + '\n';

fs.writeFileSync(serverFile, newSource, 'utf8');
console.log('Cleanup completado!');
