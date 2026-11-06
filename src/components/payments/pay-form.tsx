"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AccountSelect } from "@/components/account-select";
import { Button } from "@/components/ui/button";
import { useModalFormAction } from "@/components/use-modal-form-action";
import type { PaymentSource } from "@/lib/accounts-shared";
import { payInstallment } from "@/app/(app)/presupuestos/actions";

export function PayForm({
  planId,
  installment,
  monthKey,
  currency,
  sources,
  defaultAccountId,
  income = false,
}: {
  /** Ingreso fijo: se registra la entrada en una cuenta (no tarjeta de crédito). */
  income?: boolean;
  planId: string;
  installment: number;
  monthKey: string;
  currency: string;
  sources: PaymentSource[];
  defaultAccountId: string | null;
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    payInstallment,
    income ? "Ingreso registrado" : "Pago registrado",
  );

  if (!sources.some((s) => s.currency === currency)) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
        Primero agrega una cuenta o tarjeta en{" "}
        <Link
          href="/tarjetas"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Tarjetas y cuentas
        </Link>{" "}
        para saber de dónde sale el pago.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="month" value={monthKey} />
      <input type="hidden" name="installment" value={installment} />
      <AccountSelect
        label={income ? "¿A qué cuenta entró?" : "¿Con qué pagas?"}
        name="accountId"
        sources={sources}
        currency={currency}
        excludeTypes={income ? ["credit"] : undefined}
        defaultValue={defaultAccountId}
        hint={
          income
            ? "Se suma al saldo de esa cuenta."
            : "Con tarjeta de crédito el pago aumenta su deuda; con una cuenta, baja su saldo."
        }
        error={state.fieldErrors?.accountId}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {income ? "Registrar ingreso" : "Confirmar pago"}
      </Button>
    </form>
  );
}
