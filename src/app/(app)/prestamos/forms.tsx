"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useModalFormAction } from "@/components/use-modal-form-action";
import type { PaymentSource } from "@/lib/accounts-shared";
import { cleanDni } from "@/lib/dni";
import { loanSchedule, percentToBasisPoints, totalOwed } from "@/lib/loans";
import {
  centsToInput,
  currencySymbol,
  formatMoney,
  parseMoney,
} from "@/lib/money";
import { formatDate } from "@/lib/schedule";
import {
  createLoan,
  giveMoney,
  lookupBorrower,
  registerPayment,
  requestMoney,
  respondLoan,
  respondPayment,
  respondRequest,
} from "./actions";

function Submit({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Aceptar / Rechazar en el mismo formulario: el botón pulsado envía `decision`. */
function DecisionButtons({
  pending,
  acceptLabel,
}: {
  pending: boolean;
  acceptLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="submit"
        name="decision"
        value="reject"
        variant="secondary"
        size="lg"
        disabled={pending}
      >
        <X className="size-4" aria-hidden />
        Rechazar
      </Button>
      <Button
        type="submit"
        name="decision"
        value="accept"
        size="lg"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        {acceptLabel}
      </Button>
    </div>
  );
}

/* ───────────── Nuevo préstamo ───────────── */

export function LoanForm({
  currency,
  sources,
  today,
}: {
  currency: string;
  sources: PaymentSource[];
  today: string;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    createLoan,
    "Préstamo creado",
  );
  const errors = state.fieldErrors ?? {};
  const [type, setType] = useState<"fixed" | "open">("fixed");
  const [target, setTarget] = useState<"user" | "external">("user");
  const [dni, setDni] = useState("");
  const [found, setFound] = useState<{ name?: string; error?: string } | null>(
    null,
  );
  const [searching, startSearch] = useTransition();
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [installments, setInstallments] = useState("1");
  const [firstDueOn, setFirstDueOn] = useState("");
  const symbol = currencySymbol(currency);
  const isOpen = type === "open";

  function search() {
    startSearch(async () => {
      const result = await lookupBorrower(dni);
      setFound(result.ok ? { name: result.name } : { error: result.error });
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      noValidate
      onReset={() => {
        setType("fixed");
        setTarget("user");
        setDni("");
        setFound(null);
        setAmount("");
        setInterest("");
        setInstallments("1");
        setFirstDueOn("");
      }}
    >
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Tipo de préstamo</legend>
        <Segmented
          name="type"
          value={type}
          onChange={(v) => {
            setType(v as typeof type);
            if (v === "open") setTarget("user");
          }}
          options={[
            { value: "fixed", label: "Con condiciones" },
            { value: "open", label: "Cuenta libre" },
          ]}
        />
        <p className="text-[13px] text-muted-foreground">
          {isOpen
            ? "Abres una cuenta: la persona te pide montos cuando necesita, tú los aceptas y se van sumando."
            : "Prestas un monto fijo con interés y cuotas. La otra persona lo acepta en su cuenta."}
        </p>
      </fieldset>

      {!isOpen && (
        <Segmented
          name="target"
          value={target}
          onChange={(v) => setTarget(v as typeof target)}
          options={[
            { value: "user", label: "Usuario de la app" },
            { value: "external", label: "Persona externa" },
          ]}
        />
      )}
      {isOpen && <input type="hidden" name="target" value="user" />}

      {target === "user" ? (
        <div className="grid gap-1.5">
          <div className="flex items-end gap-2">
            <Field
              label="DNI de la persona"
              name="dni"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              className="flex-1"
              value={dni}
              onChange={(e) => {
                setDni(cleanDni(e.target.value));
                setFound(null);
              }}
              error={errors.dni}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={search}
              disabled={dni.length !== 8 || searching}
              aria-label="Buscar por DNI"
              className={errors.dni ? "mb-[26px]" : undefined}
            >
              {searching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Search className="size-4" aria-hidden />
              )}
              Buscar
            </Button>
          </div>
          {found?.name && (
            <p className="text-[13px] font-medium text-income">
              Se enviará a {found.name} · debe aceptarlo
            </p>
          )}
          {found?.error && (
            <p className="text-[13px] text-expense">{found.error}</p>
          )}
        </div>
      ) : (
        <Field
          label="Nombre de la persona"
          name="borrowerName"
          autoComplete="off"
          maxLength={60}
          hint="No usa la app: tú registras sus abonos."
          error={errors.borrowerName}
        />
      )}

      {!isOpen ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={`Monto (${symbol})`}
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errors.amount}
            />
            <Field
              label="Interés total (%)"
              name="interest"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              error={errors.interest}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Número de cuotas"
              name="installments"
              inputMode="numeric"
              autoComplete="off"
              value={installments}
              onChange={(e) =>
                setInstallments(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              error={errors.installments}
            />
            <Field
              label="Primer pago"
              name="firstDueOn"
              type="date"
              min={today}
              value={firstDueOn}
              onChange={(e) => setFirstDueOn(e.target.value)}
              error={errors.firstDueOn}
            />
          </div>
          <FixedPreview
            amount={amount}
            interest={interest}
            installments={installments}
            firstDueOn={firstDueOn}
            currency={currency}
          />
          <AccountSelect
            label="¿De qué cuenta sale el dinero?"
            name="accountId"
            sources={sources}
            currency={currency}
            excludeTypes={["credit"]}
            hint={
              target === "user"
                ? "Se descuenta cuando la persona acepte."
                : undefined
            }
            error={errors.accountId}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Día de pago (cada mes)"
              name="payDay"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej.: 30"
              maxLength={2}
              error={errors.payDay}
            />
            <Field
              label={`Límite (${symbol}, opcional)`}
              name="creditLimit"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Sin límite"
              error={errors.creditLimit}
            />
          </div>
          <Field
            label="Interés (%, opcional)"
            name="interest"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            hint="Se aplica sobre todo lo que te pida."
            error={errors.interest}
          />
          <AccountSelect
            label="Cuenta habitual para entregar el dinero"
            name="accountId"
            sources={sources}
            currency={currency}
            excludeTypes={["credit"]}
            noneLabel="Elegir en cada entrega"
            error={errors.accountId}
          />
        </>
      )}

      <Field
        label="Nota (opcional)"
        name="note"
        autoComplete="off"
        maxLength={120}
        placeholder="Para qué es…"
      />
      {errors.target && (
        <p className="text-[13px] text-expense">{errors.target}</p>
      )}
      <Submit pending={pending}>
        {isOpen ? "Abrir cuenta libre" : "Prestar"}
      </Submit>
    </form>
  );
}

function FixedPreview({
  amount,
  interest,
  installments,
  firstDueOn,
  currency,
}: {
  amount: string;
  interest: string;
  installments: string;
  firstDueOn: string;
  currency: string;
}) {
  const cents = parseMoney(amount);
  const n = Number(installments);
  const rate = interest ? percentToBasisPoints(interest) : 0;
  if (
    !cents ||
    cents <= 0 ||
    !Number.isInteger(n) ||
    n < 1 ||
    !Number.isFinite(rate)
  )
    return null;
  const owed = totalOwed(cents, rate);
  const schedule = /^\d{4}-\d{2}-\d{2}$/.test(firstDueOn)
    ? loanSchedule(owed, n, firstDueOn)
    : null;
  return (
    <p className="rounded-lg bg-muted px-3 py-2.5 text-sm" aria-live="polite">
      Te devolverá {formatMoney(owed, currency)}
      {rate > 0 && (
        <> (incluye {formatMoney(owed - cents, currency)} de interés)</>
      )}
      {n > 1
        ? ` en ${n} cuotas de ${formatMoney(schedule?.[0].amount ?? Math.floor(owed / n), currency)}`
        : " en un pago"}
      {schedule && (
        <>
          , {n > 1 ? "del" : "el"} {formatDate(schedule[0].dueOn)}
          {n > 1 && <> al {formatDate(schedule.at(-1)!.dueOn)}</>}
        </>
      )}
      .
    </p>
  );
}

/* ───────────── Deudor ───────────── */

export function RespondLoanForm({
  loanId,
  currency,
  sources,
  amount,
  defaultAccountId,
}: {
  loanId: string;
  currency: string;
  sources: PaymentSource[];
  amount: number;
  defaultAccountId: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    respondLoan,
    "Respuesta enviada",
  );
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="loanId" value={loanId} />
      <AccountSelect
        label={
          amount > 0
            ? "¿A qué cuenta te llega el dinero?"
            : "Cuenta donde recibirás lo que pidas"
        }
        name="accountId"
        sources={sources}
        currency={currency}
        excludeTypes={["credit"]}
        noneLabel="No registrar en mis cuentas"
        defaultValue={defaultAccountId}
        error={state.fieldErrors?.accountId}
      />
      <DecisionButtons pending={pending} acceptLabel="Aceptar" />
    </form>
  );
}

export function RequestMoneyForm({
  loanId,
  currency,
  available,
}: {
  loanId: string;
  currency: string;
  available: number | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    requestMoney,
    "Pedido enviado",
  );
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="loanId" value={loanId} />
      <Field
        label={`Monto (${currencySymbol(currency)})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        hint={
          available !== null
            ? `Puedes pedir hasta ${formatMoney(available, currency)}.`
            : undefined
        }
        error={state.fieldErrors?.amount}
      />
      <Field
        label="¿Para qué? (opcional)"
        name="note"
        autoComplete="off"
        maxLength={120}
      />
      <Submit pending={pending}>Enviar pedido</Submit>
    </form>
  );
}

/* ───────────── Prestamista ───────────── */

export function RespondRequestForm({
  entryId,
  currency,
  sources,
  defaultAccountId,
}: {
  entryId: string;
  currency: string;
  sources: PaymentSource[];
  defaultAccountId: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    respondRequest,
    "Pedido respondido",
  );
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="entryId" value={entryId} />
      <AccountSelect
        label="¿De qué cuenta sale el dinero?"
        name="accountId"
        sources={sources}
        currency={currency}
        excludeTypes={["credit"]}
        defaultValue={defaultAccountId}
        noneLabel="No registrar en mis cuentas"
        error={state.fieldErrors?.accountId}
      />
      <DecisionButtons pending={pending} acceptLabel="Aceptar y entregar" />
    </form>
  );
}

export function GiveMoneyForm({
  loanId,
  currency,
  sources,
  defaultAccountId,
}: {
  loanId: string;
  currency: string;
  sources: PaymentSource[];
  defaultAccountId: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    giveMoney,
    "Entrega registrada",
  );
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="loanId" value={loanId} />
      <Field
        label={`Monto (${currencySymbol(currency)})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        error={state.fieldErrors?.amount}
      />
      <Field
        label="Nota (opcional)"
        name="note"
        autoComplete="off"
        maxLength={120}
      />
      <AccountSelect
        label="¿De qué cuenta sale?"
        name="accountId"
        sources={sources}
        currency={currency}
        excludeTypes={["credit"]}
        defaultValue={defaultAccountId}
        noneLabel="No registrar en mis cuentas"
        error={state.fieldErrors?.accountId}
      />
      <Submit pending={pending}>Entregar</Submit>
    </form>
  );
}

export function RespondPaymentForm({
  paymentId,
  currency,
  sources,
  defaultAccountId,
}: {
  paymentId: string;
  currency: string;
  sources: PaymentSource[];
  defaultAccountId: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    respondPayment,
    "Abono respondido",
  );
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="paymentId" value={paymentId} />
      <AccountSelect
        label="¿A qué cuenta te llegó?"
        name="accountId"
        sources={sources}
        currency={currency}
        excludeTypes={["credit"]}
        defaultValue={defaultAccountId}
        noneLabel="No registrar en mis cuentas"
        hint="Rechaza solo si no recibiste el dinero: se le devuelve a su cuenta."
        error={state.fieldErrors?.accountId}
      />
      <DecisionButtons pending={pending} acceptLabel="Confirmar" />
    </form>
  );
}

/* ───────────── Abonos (ambas partes) ───────────── */

export function PaymentForm({
  loanId,
  role,
  currency,
  sources,
  defaultAmount,
  defaultAccountId,
}: {
  loanId: string;
  role: "lender" | "borrower";
  currency: string;
  sources: PaymentSource[];
  defaultAmount?: number;
  defaultAccountId: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    registerPayment,
    role === "lender"
      ? "Cobro registrado"
      : "Abono enviado: falta que lo confirmen",
  );
  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="loanId" value={loanId} />
      <Field
        label={`Monto (${currencySymbol(currency)})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={defaultAmount ? centsToInput(defaultAmount) : ""}
        error={state.fieldErrors?.amount}
      />
      <AccountSelect
        label={
          role === "lender"
            ? "¿A qué cuenta te llegó?"
            : "¿Desde qué cuenta pagas?"
        }
        name="accountId"
        sources={sources}
        currency={currency}
        excludeTypes={["credit"]}
        defaultValue={defaultAccountId}
        noneLabel={
          role === "lender"
            ? "No registrar en mis cuentas"
            : "Pagué en efectivo / no registrar"
        }
        hint={
          role === "borrower"
            ? "La otra persona confirmará que lo recibió."
            : undefined
        }
        error={state.fieldErrors?.accountId}
      />
      <Field
        label="Nota (opcional)"
        name="note"
        autoComplete="off"
        maxLength={120}
      />
      <Submit pending={pending}>
        {role === "lender" ? "Registrar cobro" : "Registrar pago"}
      </Submit>
    </form>
  );
}
