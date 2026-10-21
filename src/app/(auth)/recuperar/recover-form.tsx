"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { RecoveryCodeReveal } from "@/components/recovery-code-panel";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { recoverWithCode, type RecoverState } from "./actions";

export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(recoverWithCode, {
    ok: false,
  });
  const errors = state.fieldErrors ?? {};

  if (state.ok && state.newCode) {
    return (
      <div className="grid gap-4">
        <p role="status" className="rounded-lg bg-income/10 px-3 py-2 text-sm font-medium text-income">
          Listo: tu contraseña cambió. Tu código anterior ya no sirve; este es el nuevo.
        </p>
        <RecoveryCodeReveal code={state.newCode} />
        <Link href="/login" className={buttonClasses({ size: "lg" })}>
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field label="Correo" name="email" type="email" autoComplete="email" required error={errors.email} />
      <Field
        label="Código de recuperación"
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        required
        error={errors.code}
      />
      <Field
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres."
        required
        error={errors.password}
      />
      <Field
        label="Repite la nueva contraseña"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirm}
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Cambiar contraseña
      </Button>
    </form>
  );
}
