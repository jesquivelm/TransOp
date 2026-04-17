import { useCallback, useEffect, useState } from "react";

export function useSocios(token) {
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch("/api/tms/socios", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const payload = await res.json().catch(() => []);
      if (!res.ok) throw new Error(payload.error || `Error ${res.status} al cargar socios`);

      const sociosConContactos = await Promise.all(
        payload.map(async socio => {
          try {
            const contactosRes = await fetch(`/api/tms/socios/${socio.id}/contactos`, {
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            });
            const contactos = contactosRes.ok ? await contactosRes.json() : [];
            return { ...socio, clasificacion: socio.clasificacion || "cliente", contactos };
          } catch {
            return { ...socio, clasificacion: socio.clasificacion || "cliente", contactos: [] };
          }
        })
      );

      setSocios(sociosConContactos);
    } catch (error) {
      console.error("useSocios error:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { socios, loading, recargar: cargar };
}
