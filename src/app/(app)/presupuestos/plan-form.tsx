"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import type { PaymentSource } from "@/lib/accounts-shared";
import { currencySymbol, formatMoney, parseMoney } from "@/lib/money";
import {
  formatDate,
  lastDueDate,
  parseDate,
  type Frequency,
} from "@/lib/schedule";
import { createPlan } from "./actions";
import { useModalFormAction } from "@/components/use-modal-form-action";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Cada mes" },
  { value: "semimonthly", label: "Quincenal" },
  { value: "yearly", label: "Cada año" },
  { value: "once", label: "Una vez" },
];

export function PlanForm({
  currency,
  categories,
  sources,
  today,
}: {
  currency: string;
  categories: { id: string; name: string }[];
  sources: PaymentSource[];
  today: string;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    createPlan,
    "Pago programado creado",
  );
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [duration, setDuration] = useState<"installments" | "indefinite">(
    "installments",
  );
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [installments, setInstallments] = useState("");

  const errors = state.fieldErrors ?? {};
  const preview = describePlan({
    frequency,
    duration,
    amount,
    startDate,
    installments,
    currency,
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      noValidate
      onReset={() => {
        setFrequency("monthly");
        setDuration("installments");
        setAmount("");
        setStartDate(today);
        setInstallments("");
      }}
    >
      <Field
        label="Nombre"
        name="name"
        placeholder="Cuota del auto, plan de teléfono…"
        autoComplete="off"
        maxLength={60}
        error={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={`Monto de cada pago (${currencySymbol(currency)})`}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
        />
        <SelectField label="Categoría" name="categoryId" defaultValue="">
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>

      {sources.length > 0 && (
        <AccountSelect
          label="Cuenta o tarjeta habitual"
          name="accountId"
          sources={sources}
          currency={currency}
          noneLabel="Elegir al momento de pagar"
          hint="Se sugerirá al pagar; siempre puedes cambiarla."
          error={errors.accountId}
        />
      )}

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">
          ¿Cada cuánto se paga?
        </legend>
        <Segmented
          name="frequency"
          value={frequency}
          onChange={(v) => setFrequency(v as Frequency)}
          options={FREQUENCIES}
        />
      </fieldset>

      <Field
        label={
          frequency === "once" ? "Fecha del pago" : "Fecha del primer pago"
        }
        name="startDate"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        hint={
          frequency === "semimonthly"
            ? "Se paga el 15 y el último día de cada mes. Elige desde cuándo empieza."
            : frequency === "monthly" && startDate
              ? `Se pagará el día ${parseDate(startDate).day} de cada mes.`
              : undefined
        }
        error={errors.startDate}
      />

      {frequency !== "once" && (
        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-medium">¿Hasta cuándo?</legend>
          <Segmented
            name="duration"
            value={duration}
            onChange={(v) => setDuration(v as typeof duration)}
            options={[
              { value: "installments", label: "Número de cuotas" },
              { value: "indefinite", label: "Sin fecha de fin" },
            ]}
          />
          {duration === "installments" && (
            <Field
              label={
                frequency === "monthly"
                  ? "Cuántas cuotas (meses)"
                  : frequency === "semimonthly"
                    ? "Cuántos pagos (quincenas)"
                    : "Cuántos pagos (años)"
              }
              name="installments"
              inputMode="numeric"
              autoComplete="off"
              placeholder={
                frequency === "monthly"
                  ? "Ej.: 36 para 3 años"
                  : frequency === "semimonthly"
                    ? "Ej.: 24 para 1 año"
                    : "Ej.: 5"
              }
              value={installments}
              onChange={(e) =>
                setInstallments(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              error={errors.installments}
            />
          )}
        </fieldset>
      )}

      {preview && (
        <p
          className="rounded-lg bg-muted px-3 py-2.5 text-sm"
          aria-live="polite"
        >
          {preview}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar pago programado
      </Button>
    </form>
  );
}

function describePlan({
  frequency,
  duration,
  amount,
  startDate,
  installments,
  currency,
}: {
  frequency: Frequency;
  duration: "installments" | "indefinite";
  amount: string;
  startDate: string;
  installments: string;
  currency: string;
}) {
  const cents = parseMoney(amount);
  if (!cents || cents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    return null;
  const each = formatMoney(cents, currency);

  if (frequency === "once")
    return `Un pago de ${each} el ${formatDate(startDate)}.`;

  const unit =
    frequency === "monthly"
      ? "mes"
      : frequency === "semimonthly"
        ? "quincena (15 y fin de mes)"
        : "año";
  if (duration === "indefinite") {
    return `${each} cada ${unit}, desde el ${formatDate(startDate)}, sin fecha de fin.`;
  }
  const n = Number(installments);
  if (!Number.isInteger(n) || n < 1) return null;
  const last = lastDueDate({
    frequency,
    startDate,
    dayOfMonth: frequency === "semimonthly" ? 15 : parseDate(startDate).day,
    installments: n,
  });
  return `${n} ${n === 1 ? "pago" : "pagos"} de ${each} · último el ${last ? formatDate(last) : "—"} · total ${formatMoney(cents * n, currency)}.`;
}
