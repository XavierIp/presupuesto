"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";

const KINDS = [
  { value: "", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer", label: "Transferencias" },
  { value: "loan", label: "Préstamos" },
];

/** Filtros por tipo y cuenta; viven en la URL para poder compartir o volver atrás. */
export function MovementFilters({
  accounts,
}: {
  accounts: { id: string; name: string; last4: string | null }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const kind = params.get("tipo") ?? "";
  const account = params.get("cuenta") ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        pending && "opacity-70",
      )}
    >
      <div
        role="group"
        aria-label="Tipo"
        className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => update("tipo", k.value)}
            className={cn(
              "pressable h-9 cursor-pointer rounded-md px-3 text-sm font-medium",
              kind === k.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="filtro-cuenta">
        Cuenta
      </label>
      <select
        id="filtro-cuenta"
        value={account}
        onChange={(e) => update("cuenta", e.target.value)}
        className="h-11 max-w-full rounded-lg border bg-card px-3 text-base text-foreground"
      >
        <option value="">Todas las cuentas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.last4 ? ` · •••• ${a.last4}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
