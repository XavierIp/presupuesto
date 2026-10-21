"use server";

import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { checkRecoveryCode, createResetToken, issueRecoveryCode } from "@/lib/recovery";

export type RecoverState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Código nuevo: el usado ya no sirve. Se muestra una sola vez. */
  newCode?: string;
};

/** Restablece la contraseña con correo + código de recuperación (sin correo electrónico). */
export async function recoverWithCode(_prev: RecoverState, formData: FormData): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const errors: Record<string, string> = {};
  if (!email) errors.email = "Escribe tu correo.";
  if (!code.trim()) errors.code = "Escribe tu código de recuperación.";
  if (password.length < 8) errors.password = "Usa al menos 8 caracteres.";
  else if (password !== confirm) errors.confirm = "Las contraseñas no coinciden.";
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

  const [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  // Mismo mensaje si el correo no existe o el código no coincide: no revela qué cuentas existen.
  if (!user || !(await checkRecoveryCode(user.id, code))) {
    return { ok: false, error: "El correo o el código de recuperación no son correctos." };
  }

  const { token } = await createResetToken(user.id, 5 * 60);
  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." };
    throw error;
  }
  // El código usado deja de servir: se entrega uno nuevo.
  return { ok: true, newCode: await issueRecoveryCode(user.id) };
}
