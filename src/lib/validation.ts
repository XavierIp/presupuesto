import { z } from "zod";
import type { FormState } from "@/app/(app)/actions";
import { parseMoney } from "@/lib/money";
import { parseDate } from "@/lib/schedule";

/** Texto de monto → centavos. Rechaza vacío y, salvo `allowNegative`, valores ≤ 0. */
export const money = (label: string, { allowNegative = false, allowZero = false } = {}) =>
  z.string().transform((value, ctx) => {
    const cents = parseMoney(value);
    if (cents === null || value.trim() === "") {
      ctx.addIssue({ code: "custom", message: `Escribe ${label}.` });
      return z.NEVER;
    }
    if (!allowNegative && (allowZero ? cents < 0 : cents <= 0)) {
      ctx.addIssue({
        code: "custom",
        message: allowZero ? "El monto no puede ser negativo." : "El monto debe ser mayor que 0.",
      });
      return z.NEVER;
    }
    return cents;
  });

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.")
  .refine((value) => {
    const { year, month, day } = parseDate(value);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Fecha no válida.");

/** Día del mes opcional (1–31); vacío = null. */
export const optionalDay = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      ctx.addIssue({ code: "custom", message: "Escribe un día entre 1 y 31." });
      return z.NEVER;
    }
    return n;
  });

export function fieldErrors(error: z.ZodError): FormState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors: errors };
}
