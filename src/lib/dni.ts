import { z } from "zod";

/** DNI peruano: exactamente 8 dígitos. */
export const DNI_SCHEMA = z.string().regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos.");

/** Deja solo dígitos y corta a 8 (para usar mientras el usuario escribe). */
export function cleanDni(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}
