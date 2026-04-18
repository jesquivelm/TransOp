import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

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

const DETAIL_TABS = [
  { id: "datos", label: "Datos" },
  { id: "trabajos", label: "Trabajos y servicios" },
];

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

function normalizeComparableValue(value) {
  return String(value || "").trim().toLowerCase();
}

function summarizeProformaStatus(proforma) {
  const estado = proforma?.data_json?.estado || proforma?.data_json?.socio?._estado || "borrador";
  const normalized = String(estado).trim().toLowerCase();
  if (normalized === "en_proceso") return "En proceso";
  if (normalized === "confirmada") return "Confirmada";
  if (normalized === "cancelada") return "Cancelada";
  if (normalized === "cerrada") return "Cerrada";
  return "Borrador";
}

function isActiveProformaStatus(status) {
  return ["borrador", "en proceso", "confirmada"].includes(String(status || "").trim().toLowerCase());
}

function matchesSocioProforma(proforma, socio) {
  if (!proforma || !socio) return false;

  const quoteSocio = proforma.data_json?.socio || {};
  const proformaCodigo = normalizeComparableValue(quoteSocio.sCodigoCliente || quoteSocio.codigoCliente);
  const proformaNombre = normalizeComparableValue(proforma.cliente_nombre || quoteSocio.sNombre || quoteSocio.nombre);
  const proformaEmpresa = normalizeComparableValue(proforma.cliente_empresa || quoteSocio.sEmpresa || quoteSocio.empresa);

  const socioCodigo = normalizeComparableValue(socio.codigoCliente);
  const socioNombre = normalizeComparableValue(socio.nombre);
  const socioEmpresa = normalizeComparableValue(socio.empresa);

  if (socioCodigo && proformaCodigo && socioCodigo === proformaCodigo) return true;
  if (socioNombre && proformaNombre && socioNombre === proformaNombre) {
    if (!socioEmpresa || !proformaEmpresa || socioEmpresa === proformaEmpresa) return true;
  }
  if (socioEmpresa && proformaEmpresa && socioEmpresa === proformaEmpresa && socioNombre && proformaNombre && socioNombre === proformaNombre) return true;

  return false;
}

function formatProformaDate(value) {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";
  return parsed.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "numeric" });
}

function formatUsd(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTaskRoute(task) {
  return [task?.origen, task?.destino].filter(Boolean).join(" → ") || "Sin ruta";
}

function buildWideTaskRange() {
  const now = new Date();
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - 3);
  const end = new Date(now);
  end.setFullYear(now.getFullYear() + 1);
  const toIso = (value) => value.toISOString().slice(0, 10);
  return { desde: toIso(start), hasta: toIso(end) };
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
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailTab, setDetailTab] = useState("datos");
  const [relatedProformas, setRelatedProformas] = useState([]);
  const [relatedEventos, setRelatedEventos] = useState([]);
  const [relatedTareas, setRelatedTareas] = useState([]);
  const formHydratedRef = useRef(false);
  const lastSavedFormRef = useRef("");

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
      const nextForm = {
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
      };

      setEditing(enriched);
      setForm(nextForm);
      lastSavedFormRef.current = JSON.stringify(nextForm);
      formHydratedRef.current = true;

      const proformasRes = await fetch("/api/tms/proformas", { headers: authHeaders });
      const proformasPayload = proformasRes.ok ? await proformasRes.json().catch(() => []) : [];
      const matchingProformas = Array.isArray(proformasPayload)
        ? proformasPayload.filter(item => matchesSocioProforma(item, enriched))
        : [];
      setRelatedProformas(matchingProformas);

      const eventosRes = await fetch("/api/tms/eventos", { headers: authHeaders });
      const eventosPayload = eventosRes.ok ? await eventosRes.json().catch(() => []) : [];
      const matchingEventos = Array.isArray(eventosPayload)
        ? eventosPayload.filter(item => matchesSocioProforma({
          cliente_nombre: item.clienteNombre || item.cliente,
          cliente_empresa: item.clienteEmpresa || item.cliente,
          data_json: { socio: { sNombre: item.clienteNombre || item.cliente, sEmpresa: item.clienteEmpresa || item.cliente } },
        }, enriched))
        : [];
      setRelatedEventos(matchingEventos);

      const { desde, hasta } = buildWideTaskRange();
      const tareasRes = await fetch(`/api/tms/tareas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`, { headers: authHeaders });
      const tareasPayload = tareasRes.ok ? await tareasRes.json().catch(() => []) : [];
      const eventIds = new Set(matchingEventos.map(item => item.id));
      const matchingTareas = Array.isArray(tareasPayload)
        ? tareasPayload.filter(item => item.eventoId && eventIds.has(item.eventoId))
        : [];
      setRelatedTareas(matchingTareas);
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

  const formSignature = useMemo(() => JSON.stringify(form), [form]);

  const guardar = useCallback(async () => {
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
      const contactosGuardados = editing?.contactos?.filter(contacto => contacto.id) || [];
      const contactosCreados = [];
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
        contactosCreados.push({
          id: contactPayload?.id || contacto.id || `tmp-${Date.now()}`,
          ...contacto,
        });
      }
      setEditing(prev => prev ? ({
        ...prev,
        ...body,
        contactos: [...contactosGuardados, ...contactosCreados],
      }) : prev);
      lastSavedFormRef.current = JSON.stringify(form);
    } catch (saveError) {
      console.error("Error actualizando socio:", saveError);
      setError(toErrorMessage(saveError, "No se pudo actualizar el socio."));
    } finally {
      setSaving(false);
    }
  }, [authHeaders, editing, form]);

  useEffect(() => {
    if (!formHydratedRef.current) return undefined;
    if (!editing?.id) return undefined;
    if (saving) return undefined;
    if (formSignature === lastSavedFormRef.current) return undefined;

    const timer = setTimeout(async () => {
      try {
        await guardar();
      } catch (_) {
        // El error ya se refleja en el banner superior.
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editing?.id, formSignature, guardar, saving]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.mute, fontSize: 13 }}>Cargando detalle del socio...</div>;
  }

  const proformasActivas = relatedProformas.filter(item => isActiveProformaStatus(summarizeProformaStatus(item)));
  const proformasHistoricas = relatedProformas.filter(item => !isActiveProformaStatus(summarizeProformaStatus(item)));
  const eventosActivos = relatedEventos.filter(item => ["planificado", "activo"].includes(String(item.estado || "").toLowerCase()));
  const eventosHistoricos = relatedEventos.filter(item => !["planificado", "activo"].includes(String(item.estado || "").toLowerCase()));

  return (
    <div style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.txt }}>{editing?.nombre || "Socio"}</div>
          <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>
            {editing?.codigoCliente || "Sin codigo"} {editing?.telefono ? `· ${editing.telefono}` : ""}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.RED}44`, borderRadius: 8, color: T.RED, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {DETAIL_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setDetailTab(tab.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: `1px solid ${detailTab === tab.id ? T.AMB : T.bdr2}`,
              background: detailTab === tab.id ? T.ambDim : T.card2,
              color: detailTab === tab.id ? T.AMB : T.sub,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {detailTab === "datos" && (
        <>
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
        {saving && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, color: T.mute, fontSize: 12 }}>
            Guardando cambios...
          </div>
        )}
        </>
      )}

      {detailTab === "trabajos" && (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.txt, marginBottom: 4 }}>Proformas activas</div>
            <div style={{ fontSize: 12, color: T.mute, marginBottom: 12 }}>
              Cotizaciones o servicios todavía en curso para este socio.
            </div>
            {proformasActivas.length === 0 ? (
              <div style={{ fontSize: 12, color: T.mute }}>No hay trabajos activos para este socio.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {proformasActivas.map(proforma => {
                  const status = summarizeProformaStatus(proforma);
                  return (
                    <div key={proforma.id} style={{ border: `1px solid ${T.bdr2}`, borderRadius: 10, padding: 12, background: T.card }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>{proforma.numero || "Sin número"}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.AMB, background: T.ambDim, borderRadius: 999, padding: "4px 8px" }}>{status}</div>
                      </div>
                      <div style={{ fontSize: 12, color: T.sub }}>{proforma.cliente_empresa || editing?.empresa || "Sin empresa"}</div>
                      <div style={{ fontSize: 12, color: T.mute, marginTop: 6 }}>
                        Emitida: {formatProformaDate(proforma.fecha_emision || proforma.created_at)} · Total: {formatUsd(proforma.total_usd)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.txt, marginBottom: 4 }}>Eventos asociados</div>
            <div style={{ fontSize: 12, color: T.mute, marginBottom: 12 }}>
              Eventos vinculados al socio, separados entre activos e historial.
            </div>
            {relatedEventos.length === 0 ? (
              <div style={{ fontSize: 12, color: T.mute }}>No hay eventos asociados a este socio.</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8 }}>Activos</div>
                  {eventosActivos.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.mute }}>No hay eventos activos.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {eventosActivos.map(evento => (
                        <div key={evento.id} style={{ border: `1px solid ${T.bdr2}`, borderRadius: 10, padding: 12, background: T.card }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>{evento.nombre || "Sin nombre"}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.AMB, background: T.ambDim, borderRadius: 999, padding: "4px 8px" }}>{evento.estado || "planificado"}</div>
                          </div>
                          <div style={{ fontSize: 12, color: T.mute }}>{evento.inicio} → {evento.fin} · {evento.tareas || 0} tareas</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8 }}>Historial</div>
                  {eventosHistoricos.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.mute }}>No hay eventos cerrados o históricos.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {eventosHistoricos.map(evento => (
                        <div key={evento.id} style={{ border: `1px solid ${T.bdr2}`, borderRadius: 10, padding: 12, background: T.card }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>{evento.nombre || "Sin nombre"}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, background: T.card3, borderRadius: 999, padding: "4px 8px" }}>{evento.estado || "finalizado"}</div>
                          </div>
                          <div style={{ fontSize: 12, color: T.mute }}>{evento.inicio} → {evento.fin} · {evento.tareas || 0} tareas</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.txt, marginBottom: 4 }}>Tareas asociadas</div>
            <div style={{ fontSize: 12, color: T.mute, marginBottom: 12 }}>
              Tareas vinculadas a eventos de este socio. Las tareas sueltas sin evento todavía no se pueden asociar con total certeza.
            </div>
            {relatedTareas.length === 0 ? (
              <div style={{ fontSize: 12, color: T.mute }}>No hay tareas asociadas por evento para este socio.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {relatedTareas.map(tarea => (
                  <div key={tarea.id} style={{ border: `1px solid ${T.bdr2}`, borderRadius: 10, padding: 12, background: T.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>{tarea.nombre || "Sin nombre"}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.BLU, background: T.bluDim, borderRadius: 999, padding: "4px 8px" }}>{tarea.estado || "pendiente"}</div>
                    </div>
                    <div style={{ fontSize: 12, color: T.sub }}>{tarea.fecha || "Sin fecha"} · {tarea.hora || "--:--"} a {tarea.fin || "--:--"}</div>
                    <div style={{ fontSize: 12, color: T.mute, marginTop: 6 }}>{formatTaskRoute(tarea)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: T.card2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.txt, marginBottom: 4 }}>Historial de proformas</div>
            <div style={{ fontSize: 12, color: T.mute, marginBottom: 12 }}>
              Cotizaciones anteriores asociadas a este socio.
            </div>
            {proformasHistoricas.length === 0 ? (
              <div style={{ fontSize: 12, color: T.mute }}>Todavía no hay historial cerrado o pasado para este socio.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {proformasHistoricas.map(proforma => {
                  const status = summarizeProformaStatus(proforma);
                  return (
                    <div key={proforma.id} style={{ border: `1px solid ${T.bdr2}`, borderRadius: 10, padding: 12, background: T.card }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>{proforma.numero || "Sin número"}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, background: T.card3, borderRadius: 999, padding: "4px 8px" }}>{status}</div>
                      </div>
                      <div style={{ fontSize: 12, color: T.sub }}>{proforma.cliente_empresa || editing?.empresa || "Sin empresa"}</div>
                      <div style={{ fontSize: 12, color: T.mute, marginTop: 6 }}>
                        Emitida: {formatProformaDate(proforma.fecha_emision || proforma.created_at)} · Total: {formatUsd(proforma.total_usd)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {saving && detailTab === "trabajos" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, color: T.mute, fontSize: 12 }}>
          Guardando cambios...
        </div>
      )}
    </div>
  );
}
