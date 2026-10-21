import { KeyRound } from "lucide-react";
import { recoveryCodeInfo } from "@/lib/recovery";
import { getCurrentUser } from "@/lib/session";
import { RecoveryCodePanel } from "./recovery-code-panel";

/** Aviso para quien aún no tiene código de recuperación (sin él no puede recuperar su cuenta solo). */
export async function RecoveryPrompt() {
  const user = await getCurrentUser();
  if (await recoveryCodeInfo(user.id)) return null;

  return (
    <section className="mb-8 grid gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:grid-cols-[auto_1fr] sm:items-start">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <KeyRound className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="font-semibold">Crea tu código de recuperación</h2>
          <p className="text-sm text-muted-foreground">
            Si algún día olvidas tu contraseña, podrás cambiarla con tu correo y este código, sin
            depender de nadie.
          </p>
        </div>
        <div>
          <RecoveryCodePanel hasCode={false} />
        </div>
      </div>
    </section>
  );
}
