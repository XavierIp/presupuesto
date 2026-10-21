"use client";

import { useEffect, useState } from "react";
import { AccountSelect } from "@/components/account-select";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import type { PaymentSource } from "@/lib/accounts-shared";
import {
  centsToInput,
  currencySymbol,
  formatMoney,
  parseMoney,
} from "@/lib/money";

/**
 * "¿De dónde sale el dinero?" del prestamista. Acepta cuentas y tarjetas de crédito;
 * con tarjeta se puede pagar en 1 cuota o en cuotas, y queda como gasto en la tarjeta.
 */
export function LenderSourceFields({
  label,
  sources,
  currency,
  defaultAccountId,
  amount,
  defaults,
  errors,
  onCardTotalChange,
}: {
  label: string;
  sources: PaymentSource[];
  currency: string;
  defaultAccountId: string | null;
  /** Monto a prestar, si ya se conoce (para sugerir el monto por cuota). */
  amount?: number;
  defaults?: { installments: number | null; installmentAmount: number | null };
  errors: Record<string, string>;
  /** Avisa cuánto suman las cuotas de la tarjeta (null si no es tarjeta en cuotas). */
  onCardTotalChange?: (total: number | null) => void;
}) {
  const inCurrency = sources.filter((s) => s.currency === currency);
  const [source, setSource] = useState<PaymentSource | null>(
    inCurrency.find((s) => s.id === defaultAccountId) ?? null,
  );
  const [payMode, setPayMode] = useState<"single" | "installments">(
    defaults?.installments ? "installments" : "single",
  );
  const [installments, setInstallments] = useState(
    defaults?.installments ? String(defaults.installments) : "",
  );
  const [each, setEach] = useState(
    defaults?.installmentAmount ? centsToInput(defaults.installmentAmount) : "",
  );
  const isCredit = source?.type === "credit";
  const n = Number(installments);
  const suggested =
    amount && Number.isInteger(n) && n >= 2 ? Math.round(amount / n) : null;
  const eachCents = parseMoney(each) || suggested;
  const cardTotal =
    isCredit && payMode === "installments" && eachCents && n >= 2
      ? eachCents * n
      : null;

  useEffect(() => {
    onCardTotalChange?.(cardTotal);
  }, [cardTotal, onCardTotalChange]);

  return (
    <>
      <AccountSelect
        label={label}
        name="accountId"
        sources={sources}
        currency={currency}
        defaultValue={defaultAccountId}
        noneLabel="No registrar en mis cuentas"
        hint={
          isCredit
            ? "Para algo que compraste tú con tu tarjeta para esta persona: a ella no le llega dinero; se suma a lo que te debe y queda como gasto en tu tarjeta."
            : "El dinero se mueve solo cuando la otra persona lo acepte."
        }
        onChange={setSource}
        error={errors.accountId}
      />
      {isCredit && (
        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-medium">
            ¿Cómo lo pagas con la tarjeta?
          </legend>
          <Segmented
            name="cardPayMode"
            value={payMode}
            onChange={(v) => setPayMode(v as typeof payMode)}
            options={[
              { value: "single", label: "En 1 cuota" },
              { value: "installments", label: "En cuotas" },
            ]}
          />
          {payMode === "installments" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Número de cuotas"
                  name="cardInstallments"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej.: 6"
                  value={installments}
                  onChange={(e) =>
                    setInstallments(
                      e.target.value.replace(/\D/g, "").slice(0, 2),
                    )
                  }
                  error={errors.cardInstallments}
                />
                <Field
                  label={`Monto por cuota (${currencySymbol(currency)})`}
                  name="cardInstallmentAmount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={suggested ? centsToInput(suggested) : "Opcional"}
                  value={each}
                  onChange={(e) => setEach(e.target.value)}
                  hint="Si tiene intereses, pon la cuota real."
                  error={errors.cardInstallmentAmount}
                />
              </div>
              {eachCents && n >= 2 && (
                <p
                  className="rounded-lg bg-muted px-3 py-2.5 text-sm"
                  aria-live="polite"
                >
                  {n} cuotas de {formatMoney(eachCents, currency)} en tu tarjeta
                  {amount && eachCents * n !== amount
                    ? ` · total ${formatMoney(eachCents * n, currency)} con intereses`
                    : ""}
                  .
                </p>
              )}
            </>
          )}
        </fieldset>
      )}
    </>
  );
}
