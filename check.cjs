const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf-8');

const used = new Set();
const matches = content.matchAll(/<([A-Z][a-zA-Z0-9]*)/g);
for (const m of matches) {
  used.add(m[1]);
}

const defined = new Set([
  'AppContent', 'Dashboard', 'EventosView', 'ConductoresView', 
  'VehiculosView', 'UsuarioMgmtView', 'ConfiguracionesView', 
  'PlaceholderView', 'CotizadorView', 'LoginView', 'AuthProvider', 
  'Sidebar', 'AlertBar'
]);

const funcs = content.matchAll(/function\s+([A-Z][a-zA-Z0-9]*)/g);
for (const f of funcs) defined.add(f[1]);

const imports = content.matchAll(/import\s+{([^}]+)}\s+from\s+['\"].*?['\"]/g);
for (const m of imports) {
  m[1].split(',').forEach(x => defined.add(x.trim()));
}
const defaultImports = content.matchAll(/import\s+([A-Z][a-zA-Z0-9]*)\s+from\s+['\"].*?['\"]/g);
for (const m of defaultImports) defined.add(m[1]);

let missing = [];
for (const comp of used) {
  if (!defined.has(comp)) {
    missing.push(comp);
  }
}
console.log('Missing Components in App.jsx:', missing);
