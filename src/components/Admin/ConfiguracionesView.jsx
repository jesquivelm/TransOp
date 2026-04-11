import { useState } from 'react';
import { 
  Palette, 
  Settings, 
  Image as ImageIcon, 
  Smile, 
  Layout, 
  FolderTree, 
  Star, 
  ChevronRight,
  Info,
  CheckCircle,
  Save
} from 'lucide-react';
import { T } from '../../App';

const TABS_CONFIG = [
  {
    id: 'diseño',
    label: 'Diseño',
    icon: Palette,
    subtabs: [
      { id: 'pres_general', label: 'Presentación General', icon: Info },
      { id: 'repositorio',  label: 'Repositorio',          icon: FolderTree },
      { id: 'iconos',       label: 'Iconos',               icon: Smile },
      { id: 'colors_tabs',  label: 'Colores de tabs',      icon: Palette },
      { id: 'presentaciones',label: 'Presentaciones',      icon: Layout },
      { id: 'favoritos',    label: 'Favoritos',            icon: Star },
    ]
  },
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    subtabs: [
      { id: 'empresa', label: 'Datos de Empresa', icon: Info },
      { id: 'seguridad', label: 'Políticas de Seguridad', icon: CheckCircle },
    ]
  }
];

export default function ConfiguracionesView() {
  const [activeTab, setActiveTab] = useState('diseño');
  const [activeSubtab, setActiveSubtab] = useState('pres_general');

  const currentTab = TABS_CONFIG.find(t => t.id === activeTab);

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 160px)' }}>
      {/* Sidebar de Categorías */}
      <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.mute, marginBottom: 8, paddingLeft: 12 }}>CATEGORÍAS</div>
        {TABS_CONFIG.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveSubtab(tab.subtabs[0].id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? T.ambDim : 'transparent',
                color: isActive ? T.AMB : T.sub,
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                transition: 'all 0.2s'
              }}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>{tab.label}</span>
              {isActive && <ChevronRight size={14} />}
            </button>
          );
        })}
      </div>

      {/* Contenido Principal con Sub-tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.card, borderRadius: 16, border: `1px solid ${T.bdr}`, overflow: 'hidden' }}>
        {/* Header de Sub-pestañas */}
        <div style={{ display: 'flex', background: T.card2, borderBottom: `1px solid ${T.bdr}`, padding: '0 12px' }}>
          {currentTab.subtabs.map(sub => {
            const isActive = activeSubtab === sub.id;
            const Icon = sub.icon;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubtab(sub.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? T.AMB : 'transparent'}`,
                  color: isActive ? T.txt : T.mute,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={14} />
                {sub.label}
              </button>
            );
          })}
        </div>

        {/* Área de Formulario / Configuración */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.txt }}>{currentTab.subtabs.find(s => s.id === activeSubtab)?.label}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: T.mute }}>Ajusta los parámetros visuales y de comportamiento del módulo.</p>
              </div>
              <button style={{ 
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', 
                background: T.AMB, color: '#000', border: 'none', borderRadius: 8, 
                fontWeight: 600, fontSize: 13, cursor: 'pointer' 
              }}>
                <Save size={16} /> Guardar Cambios
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <PlaceholderContent subtabId={activeSubtab} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderContent({ subtabId }) {
  return (
    <div style={{ 
      padding: 40, border: `2px dashed ${T.bdr}`, borderRadius: 12, 
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' 
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: T.card2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Settings size={24} color={T.mute} />
      </div>
      <div>
        <div style={{ fontWeight: 600, color: T.sub }}>Editor de {subtabId.replace('_', ' ')}</div>
        <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>Esta sección se habilitará al conectar con las APIs del servidor.</div>
      </div>
    </div>
  );
}
