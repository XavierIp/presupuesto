"use client";

import { Loader2 } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useModalFormAction } from "@/components/use-modal-form-action";
import type { PaymentSource } from "@/lib/accounts-shared";
import { centsToInput, currencySymbol, formatMoney } from "@/lib/money";
import { payCreditCard } from "./actions";

export function PayCardForm({
  cardId,
  currency,
  debt,
  sources,
  defaultAmount,
  defaultFromId,
}: {
  cardId: string;
  currency: string;
  debt: number;
  sources: PaymentSource[];
  /** Monto sugerido (p. ej. lo facturado este mes). Por defecto, toda la deuda. */
  defaultAmount?: number;
  defaultFromId?: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    payCreditCard,
    "Pago de tarjeta registrado",
  );
  const errors = state.fieldErrors ?? {};
  const hasSource = sources.some((s) => s.type !== "credit" && s.currency === currency);

  if (!hasSource) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
        Para pagar la tarjeta primero agrega una cuenta de efectivo, débito o ahorro.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="cardId" value={cardId} />
      <AccountSelect
        label="¿Desde qué cuenta pagas?"
        name="fromAccountId"
        sources={sources}
        currency={currency}
        excludeTypes={["credit"]}
        defaultValue={defaultFromId}
        error={errors.fromAccountId}
      />
      <Field
        label={`Monto (${currencySymbol(currency)})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={(defaultAmount ?? debt) > 0 ? centsToInput(defaultAmount ?? debt) : ""}
        hint={
          defaultAmount !== undefined
            ? `Sugerido: lo que vence este mes. Deuda total: ${formatMoney(debt, currency)}.`
            : "Por defecto, el total de la deuda. Puedes pagar una parte."
        }
        error={errors.amount}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Registrar pago
      </Button>
    </form>
  );
}
