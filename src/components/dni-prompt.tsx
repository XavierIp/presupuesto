import { IdCard } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { DniForm } from "./dni-form";

/** Aviso para cuentas sin DNI. No muestra nada si el usuario ya lo tiene. */
export async function DniPrompt() {
  const user = await getCurrentUser();
  if (user.dni) return null;

  return (
    <section className="mb-8 grid gap-4 rounded-xl border border-warning/40 bg-warning/5 p-5 sm:grid-cols-[auto_1fr] sm:items-start">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
        <IdCard className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="font-semibold">Completa tu DNI</h2>
          <p className="text-sm text-muted-foreground">
            Ahora cada cuenta necesita un DNI único. Solo se pide una vez.
          </p>
        </div>
        <DniForm />
      </div>
    </section>
  );
}
