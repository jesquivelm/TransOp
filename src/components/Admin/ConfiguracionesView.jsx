import { useState } from 'react';
import { 
  Settings, 
  Image as ImageIcon, 
  Info,
  Save,
  FileText,
  Phone,
  Mail,
  Globe,
  Building
} from 'lucide-react';
import { T } from '../../App';
import { useAuth } from '../../context/AuthContext';

const TABS_CONFIG = [
  {
    id: 'empresa',
    label: 'Empresa',
    icon: Building,
  },
  {
    id: 'textos',
    label: 'Textos PDF',
    icon: FileText,
  }
];

export default function ConfiguracionesView({ empresaConfig, setEmpresaConfig, logoData, setLogoData }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('empresa');
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmpresaConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoData(event.target.result);
        localStorage.setItem('transop_logo', event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/tms/config/global', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ valor: { empresa: empresaConfig } })
      });
      if (res.ok) {
        alert("Configuración guardada correctamente");
      }
    } catch (err) {
      console.error("Error saving config:", err);
      alert("Error al guardar la configuración");
    } finally {
      setIsSaving(false);
    }
  };

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
              onClick={() => setActiveTab(tab.id)}
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
            </button>
          );
        })}
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.card, borderRadius: 16, border: `1px solid ${T.bdr}`, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.txt }}>
                  {activeTab === 'empresa' ? 'Perfil de Empresa' : 'Configuración de Proformas'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: T.mute }}>
                  {activeTab === 'empresa' ? 'Gestiona la identidad visual y datos de contacto de tu negocio.' : 'Personaliza los textos legales y el formato de tus cotizaciones PDF.'}
                </p>
              </div>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', 
                  background: T.AMB, color: '#000', border: 'none', borderRadius: 8, 
                  fontWeight: 600, fontSize: 14, cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>

            {activeTab === 'empresa' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                {/* Logo Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20, background: T.card2, borderRadius: 12, border: `1px solid ${T.bdr}` }}>
                  <div style={{ 
                    width: 100, height: 100, background: T.bg, borderRadius: 12, border: `2px dashed ${T.bdr2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                  }}>
                    {logoData ? <img src={logoData} alt="Logo" style={{ maxWidth: '90%', maxHeight: '90%' }} /> : <ImageIcon size={32} color={T.mute} />}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 8px', color: T.txt, fontSize: 14 }}>Logotipo Institucional</h4>
                    <p style={{ margin: '0 0 16px', fontSize: 12, color: T.mute }}>Suba su logo en formato PNG o JPG (recomendado 200x200px).</p>
                    <input type="file" id="logo-upload" hidden onChange={handleLogoUpload} accept="image/*" />
                    <button 
                      onClick={() => document.getElementById('logo-upload').click()}
                      style={{ padding: '8px 16px', background: T.ambDim, color: T.AMB, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                    >
                      Subir Nueva Imagen
                    </button>
                  </div>
                </div>

                {/* Grid de campos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <ConfigField label="Nombre Comercial" name="nombre" value={empresaConfig.nombre} onChange={handleChange} icon={Building} />
                  <ConfigField label="Cédula Jurídica / ID" name="cedJur" value={empresaConfig.cedJur} onChange={handleChange} />
                  <ConfigField label="Teléfono de Contacto" name="tel" value={empresaConfig.tel} onChange={handleChange} icon={Phone} />
                  <ConfigField label="Correo Electrónico" name="email" value={empresaConfig.email} onChange={handleChange} icon={Mail} />
                  <ConfigField label="Sitio Web" name="web" value={empresaConfig.web} onChange={handleChange} icon={Globe} />
                  <ConfigField label="País / Región" name="pais" value={empresaConfig.pais} onChange={handleChange} />
                </div>
                
                <div style={{ display: 'grid', gap: 8 }}>
                   <label style={{ fontSize: 12, fontWeight: 600, color: T.mute }}>Dirección Física</label>
                   <textarea name="dir" value={empresaConfig.dir} onChange={handleChange} rows={3} style={inputStyles} />
                </div>
              </div>
            )}

            {activeTab === 'textos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <ConfigField label="Título del Documento" name="tituloPDF" value={empresaConfig.tituloPDF} onChange={handleChange} />
                <div style={{ display: 'grid', gap: 8 }}>
                   <label style={{ fontSize: 12, fontWeight: 600, color: T.mute }}>Términos y Condiciones (Texto Legal)</label>
                   <textarea name="terminos" value={empresaConfig.terminos} onChange={handleChange} rows={6} style={inputStyles} />
                </div>
                <ConfigField label="Nota de Pie de Página" name="nota" value={empresaConfig.nota} onChange={handleChange} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigField({ label, name, value, onChange, icon: Icon }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.mute }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {Icon && <Icon size={14} color={T.mute} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />}
        <input 
          type="text" 
          name={name}
          value={value} 
          onChange={onChange} 
          style={{ ...inputStyles, paddingLeft: Icon ? 36 : 14 }} 
        />
      </div>
    </div>
  );
}

const inputStyles = {
  width: '100%',
  padding: '10px 14px',
  background: T.card2,
  border: `1px solid ${T.bdr}`,
  borderRadius: 8,
  color: T.txt,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s'
};
