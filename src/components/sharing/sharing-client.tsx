"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  endAccess,
  lookupOwner,
  requestAccess,
  respondAccess,
  switchAccounts,
} from "@/app/(app)/compartir-actions";
import type { FormState } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { cleanDni } from "@/lib/dni";

/**
 * Selector de cuentas: "Mis cuentas" o las de alguien que me dio acceso.
 * Es un <select> nativo: en el móvil abre el selector del sistema.
 */
export function AccountSwitcher({
  value,
  options,
  className,
}: {
  /** Id de la persona cuyas cuentas veo, o "" si son las mías. */
  value: string;
  options: { id: string; name: string }[];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const acting = value !== "";
  return (
    <label
      className={cn(
        "relative flex h-10 min-w-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors duration-150",
        acting
          ? "border-savings/50 bg-savings/10 text-savings"
          : "bg-card text-foreground hover:bg-muted",
        className,
      )}
    >
      <span className="sr-only">Cuentas que estás viendo</span>
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
      )}
      <span className="truncate">
        {acting
          ? firstName(options.find((o) => o.id === value)?.name ?? "")
          : "Mis cuentas"}
      </span>
      <ChevronsUpDown
        className="ml-auto size-4 shrink-0 opacity-60"
        aria-hidden
      />
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => switchTo(next));
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">Mis cuentas</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            Cuentas de {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Botón del aviso superior para dejar de ver las cuentas de otra persona. */
export function BackToMine() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => switchTo(""))}
      className="pressable inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-savings px-3 text-sm font-medium text-background disabled:opacity-70"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      Volver a mis cuentas
    </button>
  );
}

/** Abrir las cuentas de alguien (desde Más). */
export function OpenAccounts({ ownerId }: { ownerId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => switchTo(ownerId))}
      className="h-10 px-3"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ArrowLeftRight className="size-4" aria-hidden />
      )}
      Abrir sus cuentas
    </Button>
  );
}

function useAction(success: string) {
  const [pending, startTransition] = useTransition();
  return {
    pending,
    run: (action: () => Promise<FormState>) =>
      startTransition(async () => {
        const result = await action();
        if (result.ok) toast.success(success);
        else toast.error(result.error ?? "No se pudo completar.");
      }),
  };
}

/** Aceptar o rechazar que alguien lleve mis cuentas. */
export function RespondAccess({ id }: { id: string }) {
  const accept = useAction("Listo: ya puede llevar tus cuentas");
  const reject = useAction("Solicitud rechazada");
  const busy = accept.pending || reject.pending;
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => reject.run(() => respondAccess(id, false))}
        className="h-10 px-3"
      >
        {reject.pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <X className="size-4" aria-hidden />
        )}
        Rechazar
      </Button>
      <Button
        type="button"
        disabled={busy}
        onClick={() => accept.run(() => respondAccess(id, true))}
        className="h-10 px-3"
      >
        {accept.pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        Aceptar
      </Button>
    </div>
  );
}

/** Quitar el acceso, dejar de llevar las cuentas o cancelar la solicitud (pide confirmar). */
export function EndAccess({
  id,
  label,
  confirm,
  success,
}: {
  id: string;
  label: string;
  confirm: string;
  success: string;
}) {
  const { pending, run } = useAction(success);
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          setTimeout(() => setConfirming(false), 3000);
          return;
        }
        run(() => endAccess(id));
      }}
      className={cn(
        "pressable inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-60",
        confirming
          ? "bg-expense/10 text-expense"
          : "text-muted-foreground hover:bg-muted hover:text-expense",
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {confirming ? confirm : label}
    </button>
  );
}

/** Pedir llevar las cuentas de alguien por su DNI. */
export function RequestAccessForm() {
  const [dni, setDni] = useState("");
  const [found, setFound] = useState<{ name?: string; error?: string } | null>(
    null,
  );
  const [searching, startSearch] = useTransition();
  const [state, setState] = useState<FormState>({ ok: false });
  const [sending, startSend] = useTransition();

  function search() {
    startSearch(async () => {
      const result = await lookupOwner(dni);
      setFound(result.ok ? { name: result.name } : { error: result.error });
    });
  }

  return (
    <form
      className="grid gap-3"
      noValidate
      action={(formData) =>
        startSend(async () => {
          const result = await requestAccess(state, formData);
          setState(result);
          if (result.ok) {
            toast.success("Solicitud enviada");
            setDni("");
            setFound(null);
          }
        })
      }
    >
      <div className="flex items-start gap-2">
        <Field
          label="DNI de la persona"
          name="dni"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          placeholder="8 dígitos"
          value={dni}
          onChange={(e) => {
            setDni(cleanDni(e.target.value));
            setFound(null);
          }}
          error={state.fieldErrors?.dni ?? found?.error}
          className="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={search}
          disabled={dni.length !== 8 || searching}
          aria-label="Buscar por DNI"
          className="mt-[26px] h-11 px-3"
        >
          {searching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
        </Button>
      </div>
      {found?.name && (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          Le pedirás acceso a{" "}
          <span className="font-semibold">{found.name}</span>. Tendrá que
          aceptarlo desde su cuenta.
        </p>
      )}
      <Button type="submit" disabled={!found?.name || sending}>
        {sending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Enviar solicitud
      </Button>
    </form>
  );
}

/** Cambia de cuentas; si sale bien, la acción redirige a Inicio. */
async function switchTo(ownerId: string) {
  const result = await switchAccounts(ownerId);
  if (result && !result.ok) toast.error(result.error);
}

function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}
