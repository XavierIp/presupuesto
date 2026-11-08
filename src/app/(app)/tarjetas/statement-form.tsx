"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useModalFormAction } from "@/components/use-modal-form-action";
import { centsToInput, currencySymbol, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/schedule";
import { saveCardStatement } from "./actions";

/**
 * Copiar el estado de cuenta del banco: el pago total del mes y la deuda total de hoy.
 * Así el pago del mes y el calendario cuadran con el banco aunque algún movimiento
 * se haya registrado con otra fecha.
 */
export function StatementForm({
  cardId,
  currency,
  dueMonth,
  dueDate,
  billed,
  paid,
  debt,
  fromBank,
}: {
  cardId: string;
  currency: string;
  dueMonth: string;
  dueDate: string;
  billed: number;
  paid: number;
  debt: number;
  fromBank: boolean;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    saveCardStatement,
    "Tarjeta ajustada al estado de cuenta",
  );
  const symbol = currencySymbol(currency);
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="dueMonth" value={dueMonth} />
      <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
        La app calcula{" "}
        <span className="font-semibold">{formatMoney(billed, currency)}</span>{" "}
        para el pago del {formatDate(dueDate, { withYear: false })}
        {paid > 0 && <> y ya registraste {formatMoney(paid, currency)} en pagos</>}
        . Si tu banco dice otra cosa, copia aquí los montos de tu estado de
        cuenta.
      </p>
      <Field
        label={`Pago total del mes (${symbol})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={fromBank ? centsToInput(billed) : ""}
        hint={`El "Pago total del mes" que vence el ${formatDate(dueDate, { withYear: false })}. Déjalo vacío para usar el cálculo de la app.`}
        error={state.fieldErrors?.amount}
      />
      <Field
        label={`Deuda total de hoy (${symbol}, opcional)`}
        name="debt"
        inputMode="decimal"
        autoComplete="off"
        placeholder={centsToInput(debt)}
        hint={`La app tiene ${formatMoney(debt, currency)}. Ponla si tu banco muestra otra (tu línea utilizada).`}
        error={state.fieldErrors?.debt}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar
      </Button>
    </form>
  );
}
