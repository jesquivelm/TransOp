import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Loader2, Plus, Shield, Trash2, X } from 'lucide-react';
import { T } from '../../theme';

const emptyForm = {
  nombre: '',
  username: '',
  email: '',
  telefono: '',
  password: '',
  rol: 'operador',
  foto_url: '',
  recordarTabs: false,
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: T.card2,
  border: `1px solid ${T.bdr2}`,
  borderRadius: 10,
  color: T.txt,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.mute, marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function CreateUserModal({ form, setForm, loading, error, onClose, onSubmit }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:20 }}>
      <div style={{ width:'min(560px, 100%)', background:T.card, border:`1px solid ${T.bdr}`, borderRadius:20, padding:24, position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, width:36, height:36, borderRadius:10, border:`1px solid ${T.bdr2}`, background:'transparent', color:T.mute, cursor:'pointer' }}>
          <X size={16} />
        </button>
        <div style={{ fontSize:20, fontWeight:900, color:T.txt, marginBottom:18 }}>Crear Usuario</div>
        <div style={{ display:'grid', gap:12 }}>
          <Field label="Nombre Completo"><input value={form.nombre} onChange={e => setForm(prev => ({ ...prev, nombre:e.target.value }))} style={inputStyle} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Usuario"><input value={form.username} onChange={e => setForm(prev => ({ ...prev, username:e.target.value }))} style={inputStyle} /></Field>
            <Field label="Contraseña"><input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password:e.target.value }))} style={inputStyle} /></Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Correo"><input value={form.email} onChange={e => setForm(prev => ({ ...prev, email:e.target.value }))} style={inputStyle} /></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={e => setForm(prev => ({ ...prev, telefono:e.target.value }))} style={inputStyle} /></Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Rol">
              <select value={form.rol} onChange={e => setForm(prev => ({ ...prev, rol:e.target.value }))} style={inputStyle}>
                <option value="operador">Operador</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
                <option value="conductor">Conductor</option>
              </select>
            </Field>
            <Field label="Foto (URL)"><input value={form.foto_url} onChange={e => setForm(prev => ({ ...prev, foto_url:e.target.value }))} style={inputStyle} placeholder="https://..." /></Field>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:10, color:T.sub, fontSize:13 }}>
            <input type="checkbox" checked={form.recordarTabs} onChange={e => setForm(prev => ({ ...prev, recordarTabs:e.target.checked }))} />
            Recordar Pestañas al Iniciar
          </label>
          {error && <div style={{ padding:'10px 12px', borderRadius:10, background:T.redDim, color:T.RED, fontSize:12 }}>{error}</div>}
          <button onClick={onSubmit} disabled={loading} style={{ padding:'12px 14px', border:'none', borderRadius:10, background:T.AMB, color:'#111827', cursor:loading ? 'wait' : 'pointer', fontWeight:800 }}>
            {loading ? 'Creando...' : 'Crear Usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuarioMgmtView() {
  const { token, user: activeUser, updateUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [detailForm, setDetailForm] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const selectedUser = useMemo(() => usuarios.find(item => item.id === selectedId) || usuarios[0] || null, [selectedId, usuarios]);

  useEffect(() => {
    if (selectedUser) {
      setDetailForm({
        nombre: selectedUser.nombre || '',
        email: selectedUser.email || '',
        telefono: selectedUser.telefono || '',
        rol: selectedUser.rol || 'operador',
        foto_url: selectedUser.foto_url || '',
        recordarTabs: Boolean(selectedUser.recordarTabs),
      });
      setSelectedId(selectedUser.id);
    }
  }, [selectedUser]);

  const cargarUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/tms/usuarios', { headers: authHeaders });
      const data = await resp.json().catch(() => ([]));
      if (!resp.ok) throw new Error(data.error || 'No se pudieron cargar los usuarios.');
      setUsuarios(Array.isArray(data) ? data : []);
      if (!selectedId && data[0]?.id) setSelectedId(data[0].id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, [token]);

  async function handleCreateUser() {
    setSaving(true);
    setError('');
    try {
      const resp = await fetch('/api/tms/usuarios', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(createForm),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'No se pudo crear el usuario.');
      setShowModal(false);
      setCreateForm(emptyForm);
      await cargarUsuarios();
      setSelectedId(data.id);
      setMessage('Usuario creado correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUser() {
    if (!selectedUser || !detailForm) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const resp = await fetch(`/api/tms/usuarios/${selectedUser.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(detailForm),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'No se pudo guardar el usuario.');
      setUsuarios(prev => prev.map(item => item.id === selectedUser.id ? { ...item, ...data.user } : item));
      if (selectedUser.id === activeUser?.id) updateUser(data.user);
      setMessage('Usuario actualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!selectedUser || !passwordForm.newPassword.trim()) return;
    setPasswordSaving(true);
    setError('');
    setMessage('');
    try {
      const resp = await fetch(`/api/tms/usuarios/${selectedUser.id}/password`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ newPassword: passwordForm.newPassword }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'No se pudo actualizar la contraseña.');
      setPasswordForm({ newPassword: '' });
      setMessage('Contraseña actualizada correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function eliminarUsuario(id) {
    if (!confirm('¿Seguro que deseas desactivar este usuario?')) return;
    setError('');
    setMessage('');
    try {
      const resp = await fetch(`/api/tms/usuarios/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'No se pudo desactivar el usuario.');
      const next = usuarios.filter(item => item.id !== id);
      setUsuarios(next);
      if (selectedId === id) setSelectedId(next[0]?.id || null);
      setMessage('Usuario desactivado.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (activeUser?.rol !== 'admin') {
    return (
      <div style={{ textAlign:'center', padding:40, color:T.mute }}>
        <Shield size={48} style={{ marginBottom:16, opacity:0.5 }} />
        <h3>Acceso Restringido</h3>
        <p>Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div style={{ width:'100%', maxWidth:1320, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:24, fontWeight:900, color:T.txt }}>Seguridad</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>Gestiona usuarios, contraseñas y preferencias internas.</div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:10, border:'none', background:T.AMB, color:'#111827', cursor:'pointer', fontWeight:800 }}>
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {error && <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:12, background:T.redDim, color:T.RED, fontSize:13 }}>{error}</div>}
      {message && <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:12, background:T.grnDim, color:T.GRN, fontSize:13 }}>{message}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'320px minmax(0, 1fr)', gap:18, alignItems:'start' }}>
        <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:16, padding:14 }}>
          <div style={{ fontSize:12, color:T.mute, fontWeight:700, marginBottom:12 }}>USUARIOS ACTIVOS</div>
          {loading ? (
            <div style={{ padding:24, textAlign:'center' }}><Loader2 size={18} color={T.AMB} style={{ animation:'spin 0.8s linear infinite' }} /></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {usuarios.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1px solid ${selectedUser?.id === item.id ? `${T.AMB}55` : T.bdr}`, background:selectedUser?.id === item.id ? T.ambDim : T.card2, color:selectedUser?.id === item.id ? T.AMB : T.txt, cursor:'pointer', textAlign:'left' }}
                >
                  <img src={item.foto_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} alt={item.nombre} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover' }} />
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:selectedUser?.id === item.id ? T.AMB : T.txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.nombre}</div>
                    <div style={{ fontSize:11, color:T.mute, marginTop:4 }}>@{item.username} · {item.rol}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:16, padding:18 }}>
          {!selectedUser || !detailForm ? (
            <div style={{ padding:40, textAlign:'center', color:T.mute }}>Selecciona un usuario para editarlo.</div>
          ) : (
            <div style={{ display:'grid', gap:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <img src={detailForm.foto_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} alt={selectedUser.nombre} style={{ width:68, height:68, borderRadius:'50%', objectFit:'cover' }} />
                  <div>
                    <div style={{ fontSize:20, fontWeight:900, color:T.txt }}>{selectedUser.nombre}</div>
                    <div style={{ fontSize:12, color:T.mute, marginTop:4 }}>@{selectedUser.username} · {selectedUser.rol}</div>
                  </div>
                </div>
                <button onClick={() => eliminarUsuario(selectedUser.id)} style={{ width:38, height:38, borderRadius:10, border:`1px solid ${T.RED}33`, background:T.redDim, color:T.RED, cursor:'pointer' }} title="Desactivar usuario">
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:14 }}>
                <Field label="Nombre"><input value={detailForm.nombre} onChange={e => setDetailForm(prev => ({ ...prev, nombre:e.target.value }))} style={inputStyle} /></Field>
                <Field label="Usuario"><input value={selectedUser.username} readOnly style={{ ...inputStyle, color:T.mute, cursor:'default' }} /></Field>
                <Field label="Correo"><input value={detailForm.email} onChange={e => setDetailForm(prev => ({ ...prev, email:e.target.value }))} style={inputStyle} /></Field>
                <Field label="Teléfono"><input value={detailForm.telefono} onChange={e => setDetailForm(prev => ({ ...prev, telefono:e.target.value }))} style={inputStyle} /></Field>
                <Field label="Rol">
                  <select value={detailForm.rol} onChange={e => setDetailForm(prev => ({ ...prev, rol:e.target.value }))} style={inputStyle}>
                    <option value="operador">Operador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                    <option value="conductor">Conductor</option>
                  </select>
                </Field>
                <Field label="Foto (URL)"><input value={detailForm.foto_url} onChange={e => setDetailForm(prev => ({ ...prev, foto_url:e.target.value }))} style={inputStyle} placeholder="https://..." /></Field>
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.sub }}>
                <input type="checkbox" checked={detailForm.recordarTabs} onChange={e => setDetailForm(prev => ({ ...prev, recordarTabs:e.target.checked }))} />
                Recordar Pestañas al Iniciar
              </label>

              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button onClick={handleSaveUser} disabled={saving} style={{ padding:'11px 16px', borderRadius:10, border:'none', background:T.AMB, color:'#111827', cursor:saving ? 'wait' : 'pointer', fontWeight:800 }}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>

              <div style={{ paddingTop:18, borderTop:`1px solid ${T.bdr}` }}>
                <div style={{ fontSize:15, fontWeight:800, color:T.txt, marginBottom:12 }}>Cambiar Contraseña</div>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:12 }}>
                  <Field label="Nueva Contraseña">
                    <input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ newPassword: e.target.value })} style={inputStyle} />
                  </Field>
                  <div style={{ alignSelf:'end' }}>
                    <button onClick={handleResetPassword} disabled={passwordSaving} style={{ padding:'11px 16px', borderRadius:10, border:'none', background:T.bluDim, color:T.BLU, cursor:passwordSaving ? 'wait' : 'pointer', fontWeight:800 }}>
                      {passwordSaving ? 'Actualizando...' : 'Actualizar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateUserModal
          form={createForm}
          setForm={setCreateForm}
          loading={saving}
          error={error}
          onClose={() => {
            setShowModal(false);
            setCreateForm(emptyForm);
          }}
          onSubmit={handleCreateUser}
        />
      )}
    </div>
  );
}
