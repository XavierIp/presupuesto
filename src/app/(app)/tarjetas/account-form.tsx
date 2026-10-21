"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useModalFormAction } from "@/components/use-modal-form-action";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/accounts-shared";
import { centsToInput, currencySymbol } from "@/lib/money";
import { saveAccount } from "./actions";

const TYPES = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABELS[value],
}));

export type AccountDefaults = {
  id: string;
  name: string;
  type: AccountType;
  last4: string | null;
  balance: number;
  creditLimit: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
};

export function AccountForm({ currency, account }: { currency: string; account?: AccountDefaults }) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    saveAccount,
    account ? "Cuenta actualizada" : "Cuenta creada",
  );
  const [type, setType] = useState<AccountType>(account?.type ?? "debit");
  const errors = state.fieldErrors ?? {};
  const symbol = currencySymbol(currency);
  const isCredit = type === "credit";
  const isCard = type === "debit" || isCredit;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      noValidate
      onReset={() => setType(account?.type ?? "debit")}
    >
      {account && <input type="hidden" name="id" value={account.id} />}

      {account ? (
        <input type="hidden" name="type" value={account.type} />
      ) : (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
          <Segmented name="type" value={type} onChange={(v) => setType(v as AccountType)} options={TYPES} />
        </fieldset>
      )}

      <Field
        label="Nombre"
        name="name"
        placeholder={isCard ? "BCP, Interbank, BBVA…" : "Efectivo, Ahorro casa…"}
        autoComplete="off"
        maxLength={40}
        defaultValue={account?.name}
        error={errors.name}
      />

      {isCard && (
        <Field
          label="Últimos 4 dígitos (opcional)"
          name="last4"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="1234"
          defaultValue={account?.last4 ?? ""}
          hint="Nunca guardamos el número completo de la tarjeta."
          error={errors.last4}
          onChange={(e) => {
            e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 4);
          }}
        />
      )}

      <Field
        key={isCredit ? "debt" : "balance"}
        label={isCredit ? `Deuda actual (${symbol})` : `Saldo actual (${symbol})`}
        name="balance"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={
          account ? centsToInput(isCredit ? Math.max(0, -account.balance) : account.balance) : ""
        }
        hint={
          isCredit
            ? "Lo que debes hoy en la tarjeta. Escribe 0 si no debes nada."
            : account
              ? "Si lo cambias, se ajusta el saldo sin borrar tus movimientos."
              : undefined
        }
        error={errors.balance}
      />

      {isCredit && (
        <>
          <Field
            label={`Límite de crédito (${symbol}, opcional)`}
            name="creditLimit"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            defaultValue={account?.creditLimit ? centsToInput(account.creditLimit) : ""}
            error={errors.creditLimit}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Día de corte"
              name="statementDay"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej.: 20"
              maxLength={2}
              defaultValue={account?.statementDay ?? ""}
              error={errors.statementDay}
            />
            <Field
              label="Día de pago"
              name="paymentDueDay"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej.: 5"
              maxLength={2}
              defaultValue={account?.paymentDueDay ?? ""}
              error={errors.paymentDueDay}
            />
          </div>
        </>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {account ? "Guardar cambios" : "Crear cuenta"}
      </Button>
    </form>
  );
}
