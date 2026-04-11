import { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  User as UserIcon,
  Trash2,
  Edit2,
  MoreVertical,
  X,
  Save
} from 'lucide-react';
import { T } from '../../App';
import { useAuth } from '../../context/AuthContext';

export default function SociosView({ socios, refresh }) {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSocio, setEditingSocio] = useState(null);

  const filtered = useMemo(() => socios.filter(s => 
    s.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (s.cedula || '').includes(search) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  ), [socios, search]);

  const handleSave = async (data) => {
    try {
      const res = await fetch('/api/tms/socios', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setModalOpen(false);
        setEditingSocio(null);
        refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar el socio");
    }
  };

  const openEdit = (s) => {
    setEditingSocio(s);
    setModalOpen(true);
  };

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <StatCardCompact label="Total Socios" value={socios.length} icon={Users} color={T.BLU} />
        <StatCardCompact label="Empresas"      value={socios.filter(s=>s.tipo==='empresa').length} icon={Building2} color={T.AMB} />
        <StatCardCompact label="Particulares"  value={socios.filter(s=>s.tipo==='persona').length} icon={UserIcon}  color={T.GRN} />
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:T.txt }}>Catálogo de Socios</h2>
          <div style={{ display:'flex', gap:12, flex:1, maxWidth:400 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:T.card2, border:`1px solid ${T.bdr2}`, borderRadius:8, padding:'8px 12px' }}>
              <Search size={14} color={T.mute} />
              <input 
                placeholder="Buscar por nombre, ID o correo..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background:'transparent', border:'none', outline:'none', color:T.txt, fontSize:13, flex:1 }}
              />
            </div>
            <button 
              onClick={() => { setEditingSocio(null); setModalOpen(true); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:T.AMB, color:'#000', border:'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer' }}
            >
              <Plus size={16} /> Nuevo Socio
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16 }}>
          {filtered.map(s => (
            <SocioCard key={s.id} socio={s} onEdit={() => openEdit(s)} />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:T.mute }}>
              No se encontraron socios que coincidan con la búsqueda.
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <SocioModal 
          socio={editingSocio} 
          onClose={() => { setModalOpen(false); setEditingSocio(null); }} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
}

function StatCardCompact({ label, value, icon: Icon, color }) {
  return (
    <div style={{ flex:1, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ width:40, height:40, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize:20, fontWeight:800, color:T.txt }}>{value}</div>
        <div style={{ fontSize:12, color:T.mute, fontWeight:500 }}>{label}</div>
      </div>
    </div>
  );
}

function SocioCard({ socio, onEdit }) {
  return (
    <div style={{ background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, position:'relative' }}>
      <button 
        onClick={onEdit}
        style={{ position:'absolute', top:12, right:12, padding:6, background:T.card3, border:'none', borderRadius:6, cursor:'pointer', color:T.sub }}
      >
        <Edit2 size={14} />
      </button>

      <div style={{ display:'flex', gap:12, marginBottom:16 }}>
        <div style={{ width:44, height:44, borderRadius:10, background:T.card3, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:T.AMB }}>
          {socio.nombre[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:T.txt }}>{socio.nombre}</div>
          <div style={{ fontSize:11, color:T.mute, marginTop:2 }}>ID: {socio.cedula || '---'} · {socio.tipo.toUpperCase()}</div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.sub }}>
          <Phone size={12} color={T.mute} /> {socio.telefono || 'Sin teléfono'}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.sub }}>
          <Mail size={12} color={T.mute} /> {socio.email || 'Sin correo'}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.sub }}>
          <MapPin size={12} color={T.mute} /> 
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{socio.direccion || 'Sin dirección'}</span>
        </div>
      </div>
    </div>
  );
}

function SocioModal({ socio, onClose, onSave }) {
  const [formData, setFormData] = useState(socio || {
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    tipo: 'persona',
    direccion: '',
    notas: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 };
  const panel = { background:T.card, borderRadius:16, width:'100%', maxWidth:500, padding:32, boxShadow:'0 20px 50px rgba(0,0,0,0.5)' };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:T.txt }}>{socio ? 'Editar Socio' : 'Nuevo Socio'}</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:T.mute }}><X size={20}/></button>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <div className="field">
            <label style={{color:T.mute, fontSize:12}}>Tipo de Socio</label>
            <div style={{ display:'flex', gap:10, marginTop:6 }}>
              {['persona', 'empresa'].map(t => (
                <button 
                  key={t}
                  onClick={() => setFormData(p => ({ ...p, tipo:t }))}
                  style={{ flex:1, padding:'8px', borderRadius:8, border:`1px solid ${formData.tipo === t ? T.AMB : T.bdr}`, background: formData.tipo === t ? T.ambDim : 'transparent', color: formData.tipo === t ? T.AMB : T.sub, fontSize:12, fontWeight:600, cursor:'pointer' }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label style={{color:T.mute, fontSize:12}}>Nombre Completo / Razón Social</label>
            <input name="nombre" value={formData.nombre} onChange={handleChange} style={inputSt} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="field">
              <label style={{color:T.mute, fontSize:12}}>Identificación (Cédula)</label>
              <input name="cedula" value={formData.cedula} onChange={handleChange} style={inputSt} />
            </div>
            <div className="field">
              <label style={{color:T.mute, fontSize:12}}>Teléfono</label>
              <input name="telefono" value={formData.telefono} onChange={handleChange} style={inputSt} />
            </div>
          </div>

          <div className="field">
            <label style={{color:T.mute, fontSize:12}}>Correo Electrónico</label>
            <input name="email" value={formData.email} onChange={handleChange} style={inputSt} />
          </div>

          <div className="field">
            <label style={{color:T.mute, fontSize:12}}>Dirección</label>
            <textarea name="direccion" value={formData.direccion} onChange={handleChange} style={{ ...inputSt, height:60, resize:'none' }} />
          </div>
        </div>

        <div style={{ display:'flex', gap:12, marginTop:32 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', background:'transparent', border:`1px solid ${T.bdr}`, borderRadius:10, color:T.sub, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
          <button 
            onClick={() => onSave(formData)} 
            disabled={!formData.nombre}
            style={{ flex:1, padding:'12px', background:formData.nombre ? T.AMB : T.bdr, border:'none', borderRadius:10, color:'#000', fontWeight:700, cursor:'pointer', opacity:formData.nombre ? 1 : 0.5 }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <Save size={18} /> Guardar Socio
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

const inputSt = { width:'100%', padding:'10px 14px', background:T.card2, border:`1px solid ${T.bdr}`, borderRadius:8, color:T.txt, fontSize:14, outline:'none', marginTop:4 };
