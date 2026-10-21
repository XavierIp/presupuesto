import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recoveryCode } from "@/lib/db/schema";

// Recuperación de contraseña sin servicios externos (sin correo ni SMS):
// - Código de recuperación: lo guarda el usuario; con correo + código cambia su contraseña.
// - Enlace de un solo uso: lo genera un administrador y lo entrega por el canal que prefiera.
// Ambos terminan en el restablecimiento de Better Auth (token de un solo uso, mínimo 8 caracteres).

/** Sin 0/O ni 1/I/L para que no se confundan al copiarlo a mano. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "K7QM-2XPA-9RTW-H4NC": 16 caracteres (~79 bits), imposible de adivinar. */
function newCode() {
  const chars = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return chars.join("").match(/.{4}/g)!.join("-");
}

function normalize(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Crea (o reemplaza) el código del usuario y lo devuelve en claro una sola vez. */
export async function issueRecoveryCode(userId: string) {
  const code = newCode();
  const codeHash = await hashPassword(normalize(code));
  await db
    .insert(recoveryCode)
    .values({ userId, codeHash })
    .onConflictDoUpdate({ target: recoveryCode.userId, set: { codeHash, createdAt: new Date() } });
  return code;
}

export async function recoveryCodeInfo(userId: string) {
  const [row] = await db
    .select({ createdAt: recoveryCode.createdAt })
    .from(recoveryCode)
    .where(eq(recoveryCode.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function checkRecoveryCode(userId: string, code: string) {
  const [row] = await db
    .select({ codeHash: recoveryCode.codeHash })
    .from(recoveryCode)
    .where(eq(recoveryCode.userId, userId))
    .limit(1);
  if (!row) return false;
  return verifyPassword({ hash: row.codeHash, password: normalize(code) });
}

/**
 * Token de restablecimiento en el mismo formato que usa Better Auth (`reset-password:<token>`),
 * de un solo uso y con vencimiento. Se canjea con `auth.api.resetPassword`.
 */
export async function createResetToken(userId: string, expiresInSeconds = 3600) {
  const token = randomBytes(24).toString("base64url");
  const ctx = await auth.$context;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Administradores: correos en la variable de entorno ADMIN_EMAILS, separados por coma. */
export function isAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
