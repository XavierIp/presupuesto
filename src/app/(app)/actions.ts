"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { DNI_SCHEMA } from "@/lib/dni";
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
