"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { centsToInput, currencySymbol } from "@/lib/money";
import { saveBudget } from "./actions";
import { useModalFormAction } from "@/components/use-modal-form-action";

export function BudgetForm({
  monthKey,
  currency,
  categories,
  defaults,
}: {
  monthKey: string;
  currency: string;
  categories: { id: string; name: string }[];
  defaults?: { categoryId: string; amount: number };
}) {
  const { state, formAction, pending, formRef } = useModalFormAction(
    saveBudget,
    "Presupuesto guardado",
  );

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="month" value={monthKey} />
      <SelectField
        label="Categoría"
        name="categoryId"
        defaultValue={defaults?.categoryId ?? ""}
        required
      >
        <option value="" disabled>
          Elige una categoría
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {state.fieldErrors?.categoryId && (
        <p className="-mt-2 text-[13px] text-expense">{state.fieldErrors.categoryId}</p>
      )}
      <Field
        label={`Monto para el mes (${currencySymbol(currency)})`}
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={defaults ? centsToInput(defaults.amount) : ""}
        hint="Si la categoría ya tiene presupuesto este mes, se reemplaza."
        error={state.fieldErrors?.amount}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar presupuesto
      </Button>
    </form>
  );
}
