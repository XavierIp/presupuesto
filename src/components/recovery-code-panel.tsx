"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { createMyRecoveryCode } from "@/app/(app)/actions";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";

/** Muestra un código de recuperación recién creado: se ve una sola vez. */
export function RecoveryCodeReveal({ code, onDone }: { code: string; onDone?: () => void }) {
  return (
    <div data-hold-refresh className="grid gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
      <p className="text-sm font-medium">
        Guarda este código en un lugar seguro (una nota o una foto). No lo volveremos a mostrar.
      </p>
      <p
        className="rounded-lg bg-card px-3 py-3 text-center font-mono text-xl font-semibold tracking-[0.12em] select-all"
        aria-label="Código de recuperación"
      >
        {code}
      </p>
      <p className="text-[13px] text-muted-foreground">
        Si olvidas tu contraseña, entra a “¿Olvidaste tu contraseña?” con tu correo y este código.
      </p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={code} label="Copiar código" />
        {onDone && <Button onClick={onDone}>Ya lo guardé</Button>}
      </div>
    </div>
  );
}

/** Crear o renovar el código de recuperación del usuario actual. */
export function RecoveryCodePanel({ hasCode }: { hasCode: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (code) {
    return (
      <RecoveryCodeReveal
        code={code}
        onDone={() => {
          setCode(null);
          router.refresh();
        }}
      />
    );
  }
  return (
    <Button
      variant={hasCode ? "secondary" : "primary"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createMyRecoveryCode();
          setCode(result.code);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
      {hasCode ? "Generar un código nuevo" : "Crear mi código de recuperación"}
    </Button>
  );
}
