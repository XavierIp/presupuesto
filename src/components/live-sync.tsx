"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const INTERVAL_MS = 4000;

/**
 * Mantiene la pantalla al día sin recargar: cada pocos segundos pregunta si cambió algo
 * (por ejemplo, la otra persona aceptó un pedido) y, si cambió, refresca los datos.
 * - Se pausa con la pestaña oculta y revisa en cuanto vuelve.
 * - Si hay un formulario abierto, espera a que se cierre para no borrar lo escrito.
 */
export function LiveSync() {
  const router = useRouter();
  const version = useRef<string | null>(null);
  const pending = useRef<number | null>(null);
  const stale = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const refreshIfIdle = () => {
      if (!stale.current) return;
      // Con un modal abierto o un código por guardar en pantalla, se reintenta en el próximo ciclo.
      if (document.querySelector("dialog[open], [data-hold-refresh]")) return;
      stale.current = false;
      router.refresh();
    };

    const check = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const res = await fetch("/api/sync", { cache: "no-store" });
        if (!res.ok) return;
        const data: { version: string; pending: number } = await res.json();
        if (version.current !== null && data.version !== version.current) stale.current = true;
        if (pending.current !== null && data.pending > pending.current) {
          toast.info("Tienes algo nuevo por responder en Préstamos", {
            action: { label: "Ver", onClick: () => router.push("/prestamos") },
          });
        }
        version.current = data.version;
        pending.current = data.pending;
      } catch {
        // Sin conexión: se vuelve a intentar en el próximo ciclo.
      } finally {
        inFlight = false;
        refreshIfIdle();
      }
    };

    const loop = async () => {
      await check();
      timer = setTimeout(loop, INTERVAL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    loop();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // Al cerrar un modal, aplica un refresco que estaba esperando.
    document.addEventListener("close", refreshIfIdle, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("close", refreshIfIdle, true);
    };
  }, [router]);

  return null;
}
