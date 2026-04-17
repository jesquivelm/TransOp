import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTabs } from "../context/TabsContext";

const T = {
  bg: "var(--bg)",
  card: "var(--card)",
  card2: "var(--card2)",
  card3: "var(--card3)",
  bdr: "var(--bdr)",
  bdr2: "var(--bdr2)",
  txt: "var(--txt)",
  mute: "var(--mute)",
  sub: "var(--sub)",
  AMB: "var(--AMB)",
  ambDim: "var(--ambDim)",
  BLU: "var(--BLU)",
  bluDim: "var(--bluDim)",
  GRN: "var(--GRN)",
  grnDim: "var(--grnDim)",
  RED: "var(--RED)",
  redDim: "var(--redDim)",
  PUR: "var(--PUR)",
  purDim: "var(--purDim)",
  ORG: "var(--ORG)",
  orgDim: "var(--orgDim)",
};

const TIPOS = [
  { id: "cliente", label: "Cliente" },
  { id: "proveedor", label: "Proveedor" },
  { id: "operador", label: "Operador" },
  { id: "agencia", label: "Agencia" },
  { id: "corporativo", label: "Corporativo" },
];

const CLASIFICACIONES = [
  { id: "prospecto", label: "Prospecto" },
  { id: "cliente", label: "Cliente" },
];

const EMPTY_FORM = {
  codigoCliente: "",
  nombre: "",
  empresa: "",
  identificacion: "",
  email: "",
  telefono: "",
  tipo: "cliente",
  clasificacion: "cliente",
  direccion: "",
  notas: "",
  contactos: [],
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: T.card2,
  border: `1px solid ${T.bdr2}`,
  borderRadius: 8,
  color: T.txt,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.sub, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TipoBadge({ tipo }) {
  const colors = {
    cliente: [T.BLU, T.bluDim],
    proveedor: [T.ORG, T.orgDim],
    operador: [T.PUR, T.purDim],
    agencia: [T.GRN, T.grnDim],
    corporativo: [T.AMB, T.ambDim],
  };
  const [color, bg] = colors[tipo] ?? [T.mute, T.card3];
  const label = TIPOS.find(t => t.id === tipo)?.label ?? tipo;

  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: 0.3, color, background: bg, whiteSpace: "nowrap" }}>
      {label.toUpperCase()}
    </span>
  );
}

function ClasificacionBadge({ clasificacion }) {
  const safeClasificacion = clasificacion || "cliente";
  const colors = {
    prospecto: [T.AMB, T.ambDim],
    cliente: [T.GRN, T.grnDim],
  };
  const [color, bg] = colors[safeClasificacion] ?? [T.mute, T.card3];
  const label = CLASIFICACIONES.find(item => item.id === safeClasificacion)?.label ?? "Cliente";

  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: 0.3, color, background: bg, whiteSpace: "nowrap" }}>
      {label.toUpperCase()}
    </span>
  );
}

function SocioBadge({ tipo, clasificacion }) {
  if (tipo === "cliente") {
    return <ClasificacionBadge clasificacion={clasificacion} />;
  }

  return <TipoBadge tipo={tipo} />;
}

function toErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function SociosView({ voiceDraft = null, onVoiceDraftApplied, onOpenSocio }) {
  const { token } = useAuth();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tms/socios", { headers: authHeaders });
      const payload = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(payload.error || `Error ${res.status} al cargar socios`);
      }

      const sociosConContactos = await Promise.all(
        payload.map(async socio => {
          try {
            const contactosRes = await fetch(`/api/tms/socios/${socio.id}/contactos`, { headers: authHeaders });
            const contactos = contactosRes.ok ? await contactosRes.json() : [];
            return { ...socio, clasificacion: socio.clasificacion || "cliente", contactos };
          } catch {
            return { ...socio, clasificacion: socio.clasificacion || "cliente", contactos: [] };
          }
        })
      );

      setSocios(sociosConContactos);
    } catch (fetchError) {
      console.error("Error cargando socios:", fetchError);
      setError(toErrorMessage(fetchError, "No se pudieron cargar los socios."));
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (token) cargar();
  }, [cargar, token]);

  useEffect(() => {
    if (!voiceDraft?.id) return;

    const data = voiceDraft.socioData || {};
    const contactoPrincipal = {
      nombre: data.contactoNombre || data.nombreContacto || '',
      cargo: data.contactoCargo || data.cargo || '',
      telefono: data.contactoTelefono || data.telefono || '',
      email: data.contactoEmail || data.email || '',
      es_principal: true,
    };

    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      codigoCliente: data.codigoCliente || '',
      nombre: data.nombre || data.razonSocial || '',
      empresa: data.empresa || '',
      identificacion: data.identificacion || '',
      email: data.email || '',
      telefono: data.telefono || '',
      tipo: data.tipo || 'cliente',
      clasificacion: data.clasificacion || 'cliente',
      direccion: data.direccion || '',
      notas: data.notas || voiceDraft.transcript || '',
      contactos: contactoPrincipal.nombre ? [contactoPrincipal] : [],
    });
    setError('');
    setShowForm(true);
    onVoiceDraftApplied?.(voiceDraft.id);
  }, [onVoiceDraftApplied, voiceDraft]);

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      nombre: form.nombre.trim(),
      codigoCliente: form.codigoCliente.trim(),
      empresa: form.empresa.trim() || null,
      identificacion: form.identificacion.trim() || null,
      tipo: form.tipo || "cliente",
      clasificacion: form.clasificacion || "cliente",
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      notas: form.notas.trim() || null,
    };

    try {
      let socioId = editing?.id;

      if (editing) {
        const res = await fetch(`/api/tms/socios/${editing.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || `Error ${res.status} al actualizar socio`);
      } else {
        const res = await fetch("/api/tms/socios", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || `Error ${res.status} al crear socio`);
        if (!payload.id) throw new Error("El servidor no devolvió un ID válido.");
        socioId = payload.id;
      }

      if (socioId) {
        const contactosNuevos = form.contactos.filter(contacto => !contacto.id && contacto.nombre.trim());
        for (const contacto of contactosNuevos) {
          const res = await fetch(`/api/tms/socios/${socioId}/contactos`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              nombre: contacto.nombre,
              cargo: contacto.cargo || null,
              telefono: contacto.telefono || null,
              email: contacto.email || null,
              es_principal: Boolean(contacto.es_principal),
            }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.error || `Error ${res.status} al guardar contactos`);
        }
      }

      await cargar();
      setShowForm(false);
    } catch (saveError) {
      console.error("Error guardando socio:", saveError);
      setError(toErrorMessage(saveError, "No se pudo guardar el socio."));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Desactivar este socio?")) return;

    try {
      const res = await fetch(`/api/tms/socios/${id}`, { method: "DELETE", headers: authHeaders });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Error ${res.status} al desactivar socio`);
      await cargar();
    } catch (deleteError) {
      console.error("Error eliminando:", deleteError);
      setError(toErrorMessage(deleteError, "No se pudo desactivar el socio."));
    }
  };

  const filtrados = socios.filter(socio => {
    const q = search.toLowerCase();
    const matchSearch =
      socio.nombre.toLowerCase().includes(q) ||
      (socio.email ?? "").toLowerCase().includes(q) ||
      (socio.telefono ?? "").toLowerCase().includes(q);
    const matchTipo = tipoFiltro === "todos" || socio.tipo === tipoFiltro;
    return matchSearch && matchTipo;
  });

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: "8px 12px" }}>
            <Search size={14} color={T.mute} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar socio, email, teléfono..."
              style={{ background: "transparent", border: "none", outline: "none", color: T.txt, fontSize: 13, flex: 1 }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.mute, padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>

          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value)}
            style={{ padding: "8px 12px", background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 8, color: T.sub, fontSize: 13, cursor: "pointer" }}
          >
            <option value="todos">Todos los tipos</option>
            {TIPOS.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
          </select>
        </div>

        {error && !showForm && (
          <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.RED}44`, borderRadius: 8, color: T.RED, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.mute, fontSize: 13 }}>Cargando socios...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.mute, fontSize: 13 }}>
            {socios.length === 0 ? "No hay socios registrados. Crea el primero." : "Sin resultados para la búsqueda."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filtrados.map(socio => (
              <div
                key={socio.id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 10px", borderRadius: 10, cursor: "pointer", transition: "background .15s", border: "1px solid transparent" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.card2; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => onOpenSocio?.(socio)}
              >
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.card3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 700, color: T.AMB }}>
                  {socio.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T.txt }}>{socio.nombre}</span>
                    <SocioBadge tipo={socio.tipo} clasificacion={socio.clasificacion} />
                  </div>
                  {socio.codigoCliente && (
                    <div style={{ fontSize: 11, color: T.mute, marginTop: 3 }}>
                      {socio.codigoCliente}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>
                    {[socio.empresa, socio.email].filter(Boolean).join(" · ")}
                  </div>
                </div>

                {socio.telefono && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, width: 120 }}>
                    <Phone size={12} color={T.mute} />
                    <span style={{ fontSize: 12, color: T.sub }}>{socio.telefono}</span>
                  </div>
                )}

                {socio.contactos?.length > 0 && (
                  <div style={{ fontSize: 11, color: T.mute, width: 60, textAlign: "right" }}>
                    +{socio.contactos.length} cto.
                  </div>
                )}

                <button
                  onClick={e => {
                    e.stopPropagation();
                    eliminar(socio.id);
                  }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: T.mute, padding: 4, flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.txt }}>
                  {editing ? "Editar Socio" : "Nuevo Socio"}
                </div>
                {editing && <div style={{ fontSize: 12, color: T.mute, marginTop: 2 }}>ID: {editing.id}</div>}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.mute, padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.RED}44`, borderRadius: 8, color: T.RED, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              {editing && <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Código Cliente">
                  <input value={form.codigoCliente} readOnly style={{ ...inputStyle, color: T.mute, background: T.card2, cursor: "default" }} />
                </Field>
              </div>}

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Nombre Completo *">
                  <input value={form.nombre} onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))} style={inputStyle} />
                </Field>
              </div>

              <Field label="Clasificación">
                <select value={form.clasificacion} onChange={e => setForm(prev => ({ ...prev, clasificacion: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                  {CLASIFICACIONES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </Field>

              <Field label="Tipo de Socio">
                <select value={form.tipo} onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                  {TIPOS.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
                </select>
              </Field>

              <Field label="Correo Electrónico">
                <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} style={inputStyle} />
              </Field>

              <Field label="Empresa">
                <input value={form.empresa} onChange={e => setForm(prev => ({ ...prev, empresa: e.target.value }))} style={inputStyle} />
              </Field>

              <Field label="Identificación">
                <input value={form.identificacion} onChange={e => setForm(prev => ({ ...prev, identificacion: e.target.value }))} style={inputStyle} />
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Teléfono">
                  <input value={form.telefono} onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
            </div>

            <Field label="Dirección">
              <input value={form.direccion} onChange={e => setForm(prev => ({ ...prev, direccion: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Notas internas">
              <textarea value={form.notas} onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.sub, display: "block", marginBottom: 8 }}>
                Contactos Adicionales
              </label>

              {form.contactos.map((contacto, index) => (
                <div key={`${contacto.id || "nuevo"}-${index}`} style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      placeholder="Nombre *"
                      value={contacto.nombre}
                      onChange={e => {
                        const next = [...form.contactos];
                        next[index] = { ...next[index], nombre: e.target.value };
                        setForm(prev => ({ ...prev, contactos: next }));
                      }}
                      style={{ flex: 2, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
                    />
                    <input
                      placeholder="Cargo"
                      value={contacto.cargo || ""}
                      onChange={e => {
                        const next = [...form.contactos];
                        next[index] = { ...next[index], cargo: e.target.value };
                        setForm(prev => ({ ...prev, contactos: next }));
                      }}
                      style={{ flex: 1, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
                    />
                    <button
                      onClick={() => setForm(prev => ({ ...prev, contactos: prev.contactos.filter((_, idx) => idx !== index) }))}
                      style={{ padding: 8, background: T.redDim, border: "none", borderRadius: 6, color: T.RED, cursor: "pointer", flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      placeholder="Teléfono"
                      value={contacto.telefono || ""}
                      onChange={e => {
                        const next = [...form.contactos];
                        next[index] = { ...next[index], telefono: e.target.value };
                        setForm(prev => ({ ...prev, contactos: next }));
                      }}
                      style={{ flex: 1, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
                    />
                    <input
                      placeholder="Email"
                      value={contacto.email || ""}
                      onChange={e => {
                        const next = [...form.contactos];
                        next[index] = { ...next[index], email: e.target.value };
                        setForm(prev => ({ ...prev, contactos: next }));
                      }}
                      style={{ flex: 1, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.mute, cursor: "pointer", flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={contacto.es_principal || false}
                        onChange={e => {
                          const next = [...form.contactos];
                          next[index] = { ...next[index], es_principal: e.target.checked };
                          setForm(prev => ({ ...prev, contactos: next }));
                        }}
                      />
                      Principal
                    </label>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setForm(prev => ({ ...prev, contactos: [...prev.contactos, { nombre: "", cargo: "", telefono: "", email: "", es_principal: false }] }))}
                style={{ padding: "6px 12px", background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.sub, cursor: "pointer", fontSize: 12 }}
              >
                + Agregar contacto
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", background: "transparent", border: `1px solid ${T.bdr2}`, borderRadius: 8, color: T.sub, cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving} style={{ padding: "10px 20px", background: T.AMB, border: "none", borderRadius: 8, color: "#000", cursor: saving ? "wait" : "pointer", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SociosView;

export function SocioDetailView({ socioId, onCloseTab }) {
  const { token } = useAuth();
  const { closeTab } = useTabs();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const cargarDetalle = useCallback(async () => {
    if (!token || !socioId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tms/socios", { headers: authHeaders });
      const payload = await res.json().catch(() => []);
      if (!res.ok) throw new Error(payload.error || `Error ${res.status} al cargar socios`);

      const socio = Array.isArray(payload) ? payload.find(item => String(item.id) === String(socioId)) : null;
      if (!socio) throw new Error("No se encontro el socio solicitado.");

      const contactosRes = await fetch(`/api/tms/socios/${socio.id}/contactos`, { headers: authHeaders });
      const contactos = contactosRes.ok ? await contactosRes.json() : [];
      const enriched = { ...socio, clasificacion: socio.clasificacion || "cliente", contactos };

      setEditing(enriched);
      setForm({
        nombre: enriched.nombre ?? "",
        codigoCliente: enriched.codigoCliente ?? "",
        empresa: enriched.empresa ?? "",
        identificacion: enriched.identificacion ?? "",
        email: enriched.email ?? "",
        telefono: enriched.telefono ?? "",
        tipo: enriched.tipo ?? "cliente",
        clasificacion: enriched.clasificacion ?? "cliente",
        direccion: enriched.direccion ?? "",
        notas: enriched.notas ?? "",
        contactos: enriched.contactos ?? [],
      });
    } catch (detailError) {
      console.error("Error cargando detalle de socio:", detailError);
      setError(toErrorMessage(detailError, "No se pudo cargar el detalle del socio."));
    } finally {
      setLoading(false);
    }
  }, [authHeaders, socioId, token]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  const guardar = async () => {
    if (!form.nombre.trim() || !editing?.id) {
      setError("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      nombre: form.nombre.trim(),
      codigoCliente: form.codigoCliente.trim(),
      empresa: form.empresa.trim() || null,
      identificacion: form.identificacion.trim() || null,
      tipo: form.tipo || "cliente",
      clasificacion: form.clasificacion || "cliente",
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      notas: form.notas.trim() || null,
    };

    try {
      const res = await fetch(`/api/tms/socios/${editing.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Error ${res.status} al actualizar socio`);

      const contactosNuevos = form.contactos.filter(contacto => !contacto.id && contacto.nombre.trim());
      for (const contacto of contactosNuevos) {
        const contactRes = await fetch(`/api/tms/socios/${editing.id}/contactos`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            nombre: contacto.nombre,
            cargo: contacto.cargo || null,
            telefono: contacto.telefono || null,
            email: contacto.email || null,
            es_principal: Boolean(contacto.es_principal),
          }),
        });
        const contactPayload = await contactRes.json().catch(() => ({}));
        if (!contactRes.ok) throw new Error(contactPayload.error || `Error ${contactRes.status} al guardar contactos`);
      }

      await cargarDetalle();
    } catch (saveError) {
      console.error("Error actualizando socio:", saveError);
      setError(toErrorMessage(saveError, "No se pudo actualizar el socio."));
    } finally {
      setSaving(false);
    }
  };

  const cerrar = () => {
    if (onCloseTab) onCloseTab();
    else if (editing?.id) closeTab(`socio-${editing.id}`);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.mute, fontSize: 13 }}>Cargando detalle del socio...</div>;
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.txt }}>{editing?.nombre || "Socio"}</div>
          <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>
            {editing?.codigoCliente || "Sin codigo"} {editing?.telefono ? `· ${editing.telefono}` : ""}
          </div>
        </div>
        <button onClick={cerrar} style={{ padding: "9px 14px", background: "transparent", border: `1px solid ${T.bdr2}`, borderRadius: 10, color: T.sub, cursor: "pointer" }}>
          Cerrar pestaña
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.RED}44`, borderRadius: 8, color: T.RED, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        {editing && <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Código Cliente">
            <input value={form.codigoCliente} readOnly style={{ ...inputStyle, color: T.mute, background: T.card2, cursor: "default" }} />
          </Field>
        </div>}

        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Nombre Completo *">
            <input value={form.nombre} onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))} style={inputStyle} />
          </Field>
        </div>

        <Field label="Clasificación">
          <select value={form.clasificacion} onChange={e => setForm(prev => ({ ...prev, clasificacion: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
            {CLASIFICACIONES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </Field>

        <Field label="Tipo de Socio">
          <select value={form.tipo} onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
            {TIPOS.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
          </select>
        </Field>

        <Field label="Correo Electrónico">
          <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} style={inputStyle} />
        </Field>

        <Field label="Empresa">
          <input value={form.empresa} onChange={e => setForm(prev => ({ ...prev, empresa: e.target.value }))} style={inputStyle} />
        </Field>

        <Field label="Identificación">
          <input value={form.identificacion} onChange={e => setForm(prev => ({ ...prev, identificacion: e.target.value }))} style={inputStyle} />
        </Field>

        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Teléfono">
            <input value={form.telefono} onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value }))} style={inputStyle} />
          </Field>
        </div>
      </div>

      <Field label="Dirección">
        <input value={form.direccion} onChange={e => setForm(prev => ({ ...prev, direccion: e.target.value }))} style={inputStyle} />
      </Field>

      <Field label="Notas internas">
        <textarea value={form.notas} onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: T.sub, display: "block", marginBottom: 8 }}>
          Contactos Adicionales
        </label>

        {form.contactos.map((contacto, index) => (
          <div key={`${contacto.id || "nuevo"}-${index}`} style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Nombre *"
                value={contacto.nombre}
                onChange={e => {
                  const next = [...form.contactos];
                  next[index] = { ...next[index], nombre: e.target.value };
                  setForm(prev => ({ ...prev, contactos: next }));
                }}
                style={{ flex: 2, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
              />
              <input
                placeholder="Cargo"
                value={contacto.cargo || ""}
                onChange={e => {
                  const next = [...form.contactos];
                  next[index] = { ...next[index], cargo: e.target.value };
                  setForm(prev => ({ ...prev, contactos: next }));
                }}
                style={{ flex: 1, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
              />
              <button
                onClick={() => setForm(prev => ({ ...prev, contactos: prev.contactos.filter((_, idx) => idx !== index) }))}
                style={{ padding: 8, background: T.redDim, border: "none", borderRadius: 6, color: T.RED, cursor: "pointer", flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder="Teléfono"
                value={contacto.telefono || ""}
                onChange={e => {
                  const next = [...form.contactos];
                  next[index] = { ...next[index], telefono: e.target.value };
                  setForm(prev => ({ ...prev, contactos: next }));
                }}
                style={{ flex: 1, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
              />
              <input
                placeholder="Email"
                value={contacto.email || ""}
                onChange={e => {
                  const next = [...form.contactos];
                  next[index] = { ...next[index], email: e.target.value };
                  setForm(prev => ({ ...prev, contactos: next }));
                }}
                style={{ flex: 1, padding: "7px 10px", background: T.card, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.mute, cursor: "pointer", flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={contacto.es_principal || false}
                  onChange={e => {
                    const next = [...form.contactos];
                    next[index] = { ...next[index], es_principal: e.target.checked };
                    setForm(prev => ({ ...prev, contactos: next }));
                  }}
                />
                Principal
              </label>
            </div>
          </div>
        ))}

        <button
          onClick={() => setForm(prev => ({ ...prev, contactos: [...prev.contactos, { nombre: "", cargo: "", telefono: "", email: "", es_principal: false }] }))}
          style={{ padding: "6px 12px", background: T.card2, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.sub, cursor: "pointer", fontSize: 12 }}
        >
          + Agregar contacto
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={cargarDetalle} style={{ padding: "10px 20px", background: "transparent", border: `1px solid ${T.bdr2}`, borderRadius: 8, color: T.sub, cursor: "pointer", fontSize: 14 }}>
          Recargar
        </button>
        <button onClick={guardar} disabled={saving} style={{ padding: "10px 20px", background: T.AMB, border: "none", borderRadius: 8, color: "#000", cursor: saving ? "wait" : "pointer", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
