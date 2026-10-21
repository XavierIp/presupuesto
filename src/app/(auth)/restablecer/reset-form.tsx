"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function ResetForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <p role="alert" className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">
        Este enlace no es válido. Pide uno nuevo.
      </p>
    );
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <p role="status" className="rounded-lg bg-income/10 px-3 py-2 text-sm font-medium text-income">
          Listo: tu contraseña cambió. Ya puedes entrar con ella.
        </p>
        <Link href="/login" className={buttonClasses({ size: "lg" })}>
          Iniciar sesión
        </Link>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password.length < 8) return setErrors({ password: "Usa al menos 8 caracteres." });
    if (password !== confirm) return setErrors({ confirm: "Las contraseñas no coinciden." });

    setErrors({});
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) {
      setErrors({
        form:
          error.code === "INVALID_TOKEN"
            ? "El enlace venció o ya se usó. Pide uno nuevo."
            : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
      });
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
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
      {errors.form && (
        <p role="alert" className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar contraseña
      </Button>
    </form>
  );
}
