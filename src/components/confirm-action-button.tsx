"use client";

import { useEffect, useState, useTransition } from "react";
import { Archive, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FormState } from "@/app/(app)/actions";
import { cn } from "@/lib/cn";

/**
 * Acción destructiva en dos pasos: el primer clic pide confirmación durante 3 s.
 * `action` es una Server Action ya ligada a su id (p. ej. `archiveAccount.bind(null, id)`).
 */
export function ConfirmActionButton({
  action,
  label,
  confirmLabel,
  successMessage,
  icon = "archive",
}: {
  action: () => Promise<FormState>;
  label: string;
  confirmLabel: string;
  successMessage: string;
  icon?: "archive" | "trash";
}) {
  const Icon = icon === "trash" ? Trash2 : Archive;
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  function onClick() {
    if (!confirming) return setConfirming(true);
    setConfirming(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(successMessage);
      else toast.error(result.error ?? "No se pudo completar la acción.");
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      aria-label={confirming ? confirmLabel : label}
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
        <Icon className="size-4" aria-hidden />
      )}
      {confirming ? "¿Confirmar?" : null}
    </button>
  );
}
