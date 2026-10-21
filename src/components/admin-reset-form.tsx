"use client";

import { useActionState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { createResetLink, type ResetLinkState } from "@/app/(app)/actions";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

/** Solo administradores: enlace de un solo uso para que alguien elija una nueva contraseña. */
export function AdminResetForm() {
  const [state, action, pending] = useActionState<ResetLinkState, FormData>(createResetLink, {
    ok: false,
  });
  const expires = state.expiresAt
    ? new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(new Date(state.expiresAt))
    : null;

  return (
    <div className="grid gap-4">
      <form action={action} className="flex flex-wrap items-start gap-3" noValidate>
        <Field
          label="Correo o DNI de la persona"
          name="who"
          autoComplete="off"
          className="min-w-0 flex-1 basis-56"
          error={state.fieldErrors?.who ?? state.error}
        />
        <Button type="submit" disabled={pending} className="sm:mt-[26px]">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
          Generar enlace
        </Button>
      </form>
      {state.ok && state.url && (
        <div data-hold-refresh className="grid gap-3 rounded-lg border bg-muted/50 p-4">
          <p className="text-sm">
            Enlace para <strong className="font-semibold">{state.name}</strong>. Sirve una sola vez y vence
            a las {expires}.
          </p>
          <p className="rounded-md bg-card px-3 py-2 font-mono text-[13px] break-all select-all">{state.url}</p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={state.url} label="Copiar enlace" />
            <p className="text-[13px] text-muted-foreground">
              Envíaselo por WhatsApp. Ella elegirá su contraseña; tú no la verás.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
