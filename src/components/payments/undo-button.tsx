"use client";

import { useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { undoPayment } from "@/app/(app)/presupuestos/actions";

/** Deshace el pago de una cuota (borra el gasto que generó). */
export function UndoButton({
  recordId,
  name,
}: {
  recordId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Deshacer pago de ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await undoPayment(recordId);
          if (result.ok) toast.success("Pago deshecho");
          else toast.error(result.error ?? "No se pudo deshacer el pago.");
        })
      }
      className="pressable inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Undo2 className="size-4" aria-hidden />
      )}
    </button>
  );
}
