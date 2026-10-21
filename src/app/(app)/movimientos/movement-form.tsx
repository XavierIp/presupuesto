"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useModalFormAction } from "@/components/use-modal-form-action";
import type { PaymentSource } from "@/lib/accounts-shared";
import { billDates, firstStatementMonth } from "@/lib/card-billing";
import {
  centsToInput,
  currencySymbol,
  formatMoney,
  parseMoney,
} from "@/lib/money";
import { addMonths, formatDate } from "@/lib/schedule";
import { createMovement } from "./actions";

type Kind = "expense" | "income" | "transfer";

const KINDS = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
];

export function MovementForm({
  currency,
  today,
  sources,
  incomeCategories,
  expenseCategories,
}: {
  currency: string;
  today: string;
  sources: PaymentSource[];
  incomeCategories: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    createMovement,
    "Movimiento registrado",
  );
  const errors = state.fieldErrors ?? {};

  const initialSource =
    sources.find((s) => s.type !== "credit") ?? sources[0] ?? null;
  const [kind, setKind] = useState<Kind>("expense");
  const [source, setSource] = useState<PaymentSource | null>(initialSource);
  const [payMode, setPayMode] = useState<"single" | "installments">("single");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [date, setDate] = useState(today);

  const isCredit = source?.type === "credit";
  const showInstallments = kind === "expense" && isCredit;
  const symbol = currencySymbol(currency);

  if (sources.length === 0) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
        Primero agrega una cuenta o tarjeta en Tarjetas y cuentas.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      noValidate
      onReset={() => {
        setKind("expense");
        setSource(initialSource);
        setPayMode("single");
        setAmount("");
        setInstallments("");
        setInstallmentAmount("");
        setDate(today);
      }}
    >
      <Segmented
        name="kind"
        value={kind}
        onChange={(v) => setKind(v as Kind)}
        options={KINDS}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={`Monto${payMode === "installments" && showInstallments ? " total de la compra" : ""} (${symbol})`}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
        />
        <Field
          label="Fecha"
          name="occurredOn"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.occurredOn}
        />
      </div>

      <Field
        label="Descripción (opcional)"
        name="description"
        autoComplete="off"
        maxLength={80}
        placeholder={
          kind === "income"
            ? "Sueldo, venta…"
            : kind === "expense"
              ? "Supermercado, televisor…"
              : ""
        }
        error={errors.description}
      />

      {kind !== "transfer" && (
        <SelectField
          key={kind}
          label="Categoría"
          name="categoryId"
          defaultValue=""
        >
          <option value="">Sin categoría</option>
          {(kind === "income" ? incomeCategories : expenseCategories).map(
            (c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ),
          )}
        </SelectField>
      )}

      <AccountSelect
        key={`from-${kind}`}
        label={
          kind === "expense"
            ? "¿Con qué pagaste?"
            : kind === "income"
              ? "¿A qué cuenta entró?"
              : "Desde"
        }
        name="accountId"
        sources={sources}
        currency={currency}
        defaultValue={kind === "transfer" ? initialSource?.id : source?.id}
        excludeTypes={
          kind === "expense" ? [] : kind === "income" ? ["credit"] : ["credit"]
        }
        onChange={setSource}
        error={errors.accountId}
      />

      {kind === "transfer" && (
        <AccountSelect
          label="Hacia"
          name="toAccountId"
          sources={sources}
          currency={currency}
          hint="Para pagar una tarjeta de crédito, elígela aquí."
          error={errors.toAccountId}
        />
      )}

      {showInstallments && (
        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-medium">
            ¿Cómo lo pagas con la tarjeta?
          </legend>
          <Segmented
            name="payMode"
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
                  name="installments"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej.: 12"
                  value={installments}
                  onChange={(e) =>
                    setInstallments(
                      e.target.value.replace(/\D/g, "").slice(0, 2),
                    )
                  }
                  error={errors.installments}
                />
                <Field
                  label={`Monto por cuota (${symbol})`}
                  name="installmentAmount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={
                    suggestedInstallment(amount, installments) ?? "0.00"
                  }
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  hint="Opcional: si tiene intereses, pon la cuota real."
                  error={errors.installmentAmount}
                />
              </div>
              <InstallmentPreview
                source={source}
                amount={amount}
                installments={installments}
                installmentAmount={installmentAmount}
                date={date}
                currency={currency}
              />
            </>
          )}
        </fieldset>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar movimiento
      </Button>
    </form>
  );
}

function suggestedInstallment(amount: string, installments: string) {
  const cents = parseMoney(amount);
  const n = Number(installments);
  if (!cents || !Number.isInteger(n) || n < 2) return null;
  return centsToInput(Math.round(cents / n));
}

function InstallmentPreview({
  source,
  amount,
  installments,
  installmentAmount,
  date,
  currency,
}: {
  source: PaymentSource | null;
  amount: string;
  installments: string;
  installmentAmount: string;
  date: string;
  currency: string;
}) {
  const cents = parseMoney(amount);
  const n = Number(installments);
  if (!cents || cents <= 0 || !Number.isInteger(n) || n < 2) return null;
  const each = parseMoney(installmentAmount) || Math.round(cents / n);
  const total = each * n;

  let when =
    "Agrega día de corte y de pago a la tarjeta para ver cuándo se cobra cada cuota.";
  if (
    source?.statementDay &&
    source.paymentDueDay &&
    /^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    const card = {
      statementDay: source.statementDay,
      dueDay: source.paymentDueDay,
    };
    const firstStatement = firstStatementMonth(card, date);
    // Mes de pago del primer corte: mismo mes si el pago es después del corte, si no el siguiente.
    const firstDue =
      card.dueDay > card.statementDay
        ? firstStatement
        : addMonths(firstStatement, 1);
    const lastDue = addMonths(firstDue, n - 1);
    when = `Primera cuota en tu pago del ${formatDate(billDates(card, firstDue).dueDate)}, última el ${formatDate(billDates(card, lastDue).dueDate)}.`;
  }

  return (
    <p className="rounded-lg bg-muted px-3 py-2.5 text-sm" aria-live="polite">
      {n} cuotas de {formatMoney(each, currency)}
      {total !== cents && (
        <> · total {formatMoney(total, currency)} (con intereses)</>
      )}
      . {when}
    </p>
  );
}
