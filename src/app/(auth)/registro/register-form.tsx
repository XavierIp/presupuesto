"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { cleanDni } from "@/lib/dni";
import { CURRENCIES } from "@/lib/money";
import { authErrorMessage } from "../auth-errors";

type Errors = Partial<Record<"name" | "dni" | "email" | "password" | "form", string>>;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const dni = String(form.get("dni")).trim();
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const currency = String(form.get("currency"));

    const nextErrors: Errors = {};
    if (!name) nextErrors.name = "Escribe tu nombre.";
    if (!/^\d{8}$/.test(dni)) nextErrors.dni = "El DNI debe tener exactamente 8 dígitos.";
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Escribe un correo válido.";
    if (password.length < 8) nextErrors.password = "Usa al menos 8 caracteres.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setPending(true);
    const { error } = await authClient.signUp.email({ name, email, password, dni, currency });
    if (error) {
      if (error.code === "DNI_ALREADY_EXISTS") setErrors({ dni: authErrorMessage(error) });
      else if (error.code?.startsWith("USER_ALREADY_EXISTS")) setErrors({ email: authErrorMessage(error) });
      else setErrors({ form: authErrorMessage(error) });
      setPending(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Nombre" name="name" autoComplete="name" required error={errors.name} />
      <Field
        label="DNI"
        name="dni"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        pattern="\d{8}"
        required
        hint="8 dígitos, sin espacios ni guiones."
        error={errors.dni}
        onChange={(e) => {
          e.currentTarget.value = cleanDni(e.currentTarget.value);
        }}
      />
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 8 caracteres."
        error={errors.password}
      />
      <SelectField
        label="Moneda principal"
        name="currency"
        defaultValue="PEN"
        hint="Puedes tener cuentas en otras monedas después."
      >
        {CURRENCIES.codes.map((code) => (
          <option key={code} value={code}>
            {CURRENCIES.labels[code]}
          </option>
        ))}
      </SelectField>
      {errors.form && (
        <p role="alert" className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
