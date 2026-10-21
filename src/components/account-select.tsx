"use client";

import { SelectField } from "@/components/ui/field";
import { ACCOUNT_TYPE_LABELS, type AccountType, type PaymentSource } from "@/lib/accounts-shared";
import { formatMoney } from "@/lib/money";

/** Texto de una opción: "BCP Débito · •••• 1234 — S/ 4,170.00". */
export function sourceLabel(source: PaymentSource) {
  const parts = [source.name];
  if (source.last4) parts.push(`•••• ${source.last4}`);
  else parts.push(ACCOUNT_TYPE_LABELS[source.type]);
  const amount =
    source.available === null
      ? "sin límite registrado"
      : source.type === "credit"
        ? `${formatMoney(source.available, source.currency)} disponible`
        : formatMoney(source.available, source.currency);
  return `${parts.join(" · ")} — ${amount}`;
}

/**
 * Selector de "¿con qué pagas / con qué prestas?".
 * Agrupa cuentas y tarjetas de crédito; se reutiliza en pagos, préstamos y pagos de tarjeta.
 */
export function AccountSelect({
  label,
  name,
  sources,
  currency,
  defaultValue,
  exclude = [],
  excludeTypes = [],
  noneLabel,
  hint,
  error,
  onChange,
}: {
  label: string;
  name: string;
  sources: PaymentSource[];
  /** Solo muestra cuentas en esta moneda. */
  currency?: string;
  defaultValue?: string | null;
  exclude?: string[];
  excludeTypes?: AccountType[];
  /** Si se indica, agrega una opción vacía con este texto. */
  noneLabel?: string;
  hint?: string;
  error?: string;
  /** Se llama con la cuenta elegida (o null si se elige la opción vacía). */
  onChange?: (source: PaymentSource | null) => void;
}) {
  const options = sources.filter(
    (s) =>
      (!currency || s.currency === currency) &&
      !exclude.includes(s.id) &&
      !excludeTypes.includes(s.type),
  );
  const accounts = options.filter((s) => s.type !== "credit");
  const cards = options.filter((s) => s.type === "credit");
  const fallback = defaultValue && options.some((o) => o.id === defaultValue) ? defaultValue : "";

  return (
    <div className="grid gap-1.5">
      <SelectField
        label={label}
        name={name}
        defaultValue={fallback || (noneLabel ? "" : (accounts[0]?.id ?? cards[0]?.id ?? ""))}
        hint={error ? undefined : hint}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange?.(options.find((o) => o.id === e.target.value) ?? null)}
      >
        {noneLabel && <option value="">{noneLabel}</option>}
        {accounts.length > 0 && (
          <optgroup label="Cuentas">
            {accounts.map((s) => (
              <option key={s.id} value={s.id}>
                {sourceLabel(s)}
              </option>
            ))}
          </optgroup>
        )}
        {cards.length > 0 && (
          <optgroup label="Tarjetas de crédito">
            {cards.map((s) => (
              <option key={s.id} value={s.id}>
                {sourceLabel(s)}
              </option>
            ))}
          </optgroup>
        )}
      </SelectField>
      {error && <p className="text-[13px] text-expense">{error}</p>}
    </div>
  );
}
