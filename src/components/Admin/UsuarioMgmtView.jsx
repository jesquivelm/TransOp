import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Shield, Plus, Trash2, Camera, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { T } from '../../App';

export default function UsuarioMgmtView() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { token, user: activeUser } = useAuth();

  const [form, setForm] = useState({
    nombre: '',
    username: '',
    email: '',
    password: '',
    rol: 'operador',
    foto_url: ''
  });

  const cargarUsuarios = async () => {
    try {
      const resp = await fetch('/api/tms/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error('Error al cargar usuarios');
      const data = await resp.json();
      setUsuarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch('/api/tms/usuarios', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      if (!resp.ok) throw new Error('No se pudo crear el usuario');
      
      setShowModal(false);
      setForm({ nombre: '', username: '', email: '', password: '', rol: 'operador', foto_url: '' });
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarUsuario = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      const resp = await fetch(`/api/tms/usuarios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error('No se pudo eliminar');
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  if (activeUser?.rol !== 'admin') {
    return (
      <div style={{ textAlign:'center', padding:40, color:T.mute }}>
        <Shield size={48} style={{ marginBottom:16, opacity:0.5 }} />
        <h3>Acceso restringido</h3>
        <p>Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.txt }}>Gestión de Usuarios</h2>
          <p style={{ margin: '4px 0 0', color: T.mute, fontSize: 13 }}>Administra el personal que tiene acceso al sistema</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{ 
            background: T.AMB, color: '#000', border: 'none', padding: '10px 20px', 
            borderRadius: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' 
          }}
        >
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 className="animate-spin" color={T.AMB} /></div>}
      
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {usuarios.map(u => (
            <div key={u.id} style={{ 
              background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 16,
              display: 'flex', alignItems: 'center', gap: 16
            }}>
              <img 
                src={u.foto_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} 
                style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', background: T.card2 }}
                alt={u.nombre}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: T.txt, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre}</div>
                <div style={{ fontSize: 12, color: T.mute }}>@{u.username} · {u.rol}</div>
              </div>
              <button 
                onClick={() => eliminarUsuario(u.id)}
                style={{ background: 'transparent', border: 'none', color: T.RED, cursor: 'pointer', padding: 8, borderRadius: 8 }}
                title="Eliminar usuario"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear Usuario */}
      {showModal && (
        <div style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{ 
            background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 20, 
            width: '100%', maxWidth: 480, padding: 32, position: 'relative'
          }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: T.mute, cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 24px', color: T.txt }}>Añadir nuevo operador</h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, display: 'block' }}>NOMBRE COMPLETO</label>
                <input 
                  type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                  style={{ width: '100%', padding: 12, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.txt }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, display: 'block' }}>USUARIO</label>
                  <input 
                    type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                    style={{ width: '100%', padding: 12, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.txt }}
                    required
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, display: 'block' }}>CONTRASEÑA</label>
                  <input 
                    type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    style={{ width: '100%', padding: 12, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.txt }}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, display: 'block' }}>EMAIL</label>
                <input 
                  type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  style={{ width: '100%', padding: 12, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.txt }}
                  required
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, display: 'block' }}>URL FOTO DE PERFIL</label>
                <input 
                  type="text" value={form.foto_url} onChange={e => setForm({...form, foto_url: e.target.value})}
                  placeholder="https://..."
                  style={{ width: '100%', padding: 12, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.txt }}
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, display: 'block' }}>ROL</label>
                <select 
                  value={form.rol} onChange={e => setForm({...form, rol: e.target.value})}
                  style={{ width: '100%', padding: 12, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.txt }}
                >
                  <option value="operador">Operador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <button 
                type="submit" 
                style={{ 
                  marginTop: 10, background: T.AMB, color: '#000', border: 'none', padding: 14, 
                  borderRadius: 10, fontWeight: 700, cursor: 'pointer' 
                }}
              >
                Crear Usuario
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
