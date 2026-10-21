"use server";

import { eq, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { DNI_SCHEMA } from "@/lib/dni";
import { createResetToken, isAdmin, issueRecoveryCode } from "@/lib/recovery";
import { getCurrentUser } from "@/lib/session";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Para cuentas creadas antes de exigir el DNI. */
export async function completeDni(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (user.dni) return { ok: true };

  const parsed = DNI_SCHEMA.safeParse(String(formData.get("dni") ?? "").trim());
  if (!parsed.success) return { ok: false, fieldErrors: { dni: parsed.error.issues[0].message } };

  const [taken] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.dni, parsed.data))
    .limit(1);
  if (taken) return { ok: false, fieldErrors: { dni: "Ya existe una cuenta con ese DNI." } };

  // Pasa por Better Auth para que también se actualice la cookie de sesión.
  await auth.api.updateUser({ body: { dni: parsed.data }, headers: await headers() });
  refresh();
  return { ok: true };
}

/* ───────────── Recuperación de contraseña ───────────── */

/** Crea (o renueva) el código de recuperación del usuario y lo devuelve una sola vez. */
export async function createMyRecoveryCode(): Promise<{ code: string }> {
  const user = await getCurrentUser();
  // Sin refresh(): el aviso que lo muestra debe seguir visible hasta que el usuario lo guarde.
  return { code: await issueRecoveryCode(user.id) };
}

export type ResetLinkState = FormState & { url?: string; name?: string; expiresAt?: string };

/**
 * Solo administradores: genera un enlace de un solo uso (1 hora) para que otra persona
 * elija una nueva contraseña. El administrador nunca la conoce.
 */
export async function createResetLink(
  _prev: ResetLinkState,
  formData: FormData,
): Promise<ResetLinkState> {
  const me = await getCurrentUser();
  if (!isAdmin(me.email)) return { ok: false, error: "Solo un administrador puede hacer esto." };

  const query = String(formData.get("who") ?? "").trim().toLowerCase();
  if (!query) return { ok: false, fieldErrors: { who: "Escribe su correo o su DNI." } };
  const [target] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(or(eq(userTable.email, query), eq(userTable.dni, query)))
    .limit(1);
  if (!target) return { ok: false, fieldErrors: { who: "No hay ninguna cuenta con ese correo o DNI." } };

  const { token, expiresAt } = await createResetToken(target.id);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return {
    ok: true,
    name: target.name,
    url: `${origin}/restablecer?token=${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}
