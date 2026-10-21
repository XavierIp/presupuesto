"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FormState } from "@/app/(app)/actions";
import { cn } from "@/lib/cn";
import { deleteBudget, deletePlan } from "./actions";

function useServerAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<FormState>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "No se pudo completar la acción.");
    });
  }
  return { pending, run };
}

/** Borrar en dos pasos: el primer clic pide confirmación durante 3 s. */
export function DeleteButton({
  kind,
  id,
  name,
}: {
  kind: "plan" | "budget";
  id: string;
  name: string;
}) {
  const { pending, run } = useServerAction();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  function onClick() {
    if (!confirming) return setConfirming(true);
    setConfirming(false);
    run(
      () => (kind === "plan" ? deletePlan(id) : deleteBudget(id)),
      kind === "plan" ? "Pago programado eliminado" : "Presupuesto eliminado",
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      aria-label={confirming ? `Confirmar eliminar ${name}` : `Eliminar ${name}`}
      className={cn(
        "pressable inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium disabled:opacity-60",
        confirming
          ? "bg-expense/10 text-expense"
          : "text-muted-foreground hover:bg-muted hover:text-expense",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
      {confirming && "¿Eliminar?"}
    </button>
  );
}
