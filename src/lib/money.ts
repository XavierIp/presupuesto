import { z } from "zod";

const CURRENCY_CODES = ["PEN", "USD", "MXN", "COP", "ARS", "CLP", "DOP", "GTQ", "EUR"] as const;

export const CURRENCIES = {
  codes: CURRENCY_CODES,
  schema: z.enum(CURRENCY_CODES),
  labels: {
    PEN: "Sol peruano (PEN)",
    USD: "Dólar estadounidense (USD)",
    MXN: "Peso mexicano (MXN)",
    COP: "Peso colombiano (COP)",
    ARS: "Peso argentino (ARS)",
    CLP: "Peso chileno (CLP)",
    DOP: "Peso dominicano (DOP)",
    GTQ: "Quetzal (GTQ)",
    EUR: "Euro (EUR)",
  } satisfies Record<(typeof CURRENCY_CODES)[number], string>,
};

export type Currency = (typeof CURRENCY_CODES)[number];

// Formato regional de cada moneda (p. ej. MXN → "$1,234.50", EUR → "1234,50 €").
const LOCALES: Record<string, string> = {
  USD: "es-US",
  MXN: "es-MX",
  COP: "es-CO",
  ARS: "es-AR",
  CLP: "es-CL",
  PEN: "es-PE",
  DOP: "es-DO",
  GTQ: "es-GT",
  EUR: "es-ES",
};

/** Formatea centavos como moneda. Usa siempre esto, nunca "$" + n. */
export function formatMoney(
  cents: number,
  currency: string,
  { signed = false }: { signed?: boolean } = {},
) {
  const formatted = new Intl.NumberFormat(LOCALES[currency] ?? "es", {
    style: "currency",
    currency,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(cents / 100);
  // Usa el signo menos tipográfico (−) en lugar del guion.
  return formatted.replace("-", "−");
}

/** Convierte un texto ingresado por el usuario ("1.234,50" o "1234.50") a centavos. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[^\d.,-]/g, "");
  const lastSep = Math.max(clean.lastIndexOf("."), clean.lastIndexOf(","));
  const normalized =
    lastSep === -1
      ? clean
      : clean.slice(0, lastSep).replace(/[.,]/g, "") + "." + clean.slice(lastSep + 1);
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Símbolo de la moneda para etiquetas ("S/", "$", "€"). */
export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(LOCALES[currency] ?? "es", { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

/** Centavos → texto editable para un input ("1234.50"). */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}
