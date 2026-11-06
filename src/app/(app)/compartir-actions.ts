"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/(app)/actions";
import { db } from "@/lib/db";
import { accountDelegations, user as users } from "@/lib/db/schema";
import { DNI_SCHEMA } from "@/lib/dni";
import { maskName } from "@/lib/loans";
import { ACTING_COOKIE, actingAs, getSessionUser } from "@/lib/session";

// Acceso compartido. Todo usa a quien inició sesión (nunca a la persona cuyas cuentas se llevan):
// nadie puede pedir, aceptar ni dar acceso en nombre de otra persona.

/** Busca por DNI y devuelve solo el nombre enmascarado, para confirmar a quién se le pide. */
export async function lookupOwner(
  dni: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const me = await getSessionUser();
  const parsed = DNI_SCHEMA.safeParse(dni.trim());
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const [found] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.dni, parsed.data))
    .limit(1);
  if (!found) return { ok: false, error: "No hay ninguna cuenta con ese DNI." };
  if (found.id === me.id) return { ok: false, error: "Ese es tu propio DNI." };
  return { ok: true, name: maskName(found.name) };
}

/** Pido llevar las cuentas de alguien (por su DNI). Esa persona tiene que aceptar. */
export async function requestAccess(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getSessionUser();
  const parsed = DNI_SCHEMA.safeParse(String(formData.get("dni") ?? "").trim());
  if (!parsed.success)
    return { ok: false, fieldErrors: { dni: parsed.error.issues[0].message } };
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.dni, parsed.data))
    .limit(1);
  if (!target)
    return {
      ok: false,
      fieldErrors: { dni: "No hay ninguna cuenta con ese DNI." },
    };
  if (target.id === me.id)
    return { ok: false, fieldErrors: { dni: "Ese es tu propio DNI." } };

  const [existing] = await db
    .select()
    .from(accountDelegations)
    .where(
      and(
        eq(accountDelegations.ownerId, target.id),
        eq(accountDelegations.managerId, me.id),
      ),
    )
    .limit(1);
  if (existing?.status === "accepted")
    return { ok: false, fieldErrors: { dni: "Ya llevas sus cuentas." } };
  if (existing?.status === "pending")
    return { ok: false, fieldErrors: { dni: "Ya le enviaste la solicitud." } };

  if (existing) {
    await db
      .update(accountDelegations)
      .set({ status: "pending", respondedAt: null })
      .where(eq(accountDelegations.id, existing.id));
  } else {
    await db
      .insert(accountDelegations)
      .values({ ownerId: target.id, managerId: me.id });
  }
  refresh();
  return { ok: true };
}

/** La dueña de las cuentas acepta o rechaza la solicitud. */
export async function respondAccess(
  id: string,
  accept: boolean,
): Promise<FormState> {
  const me = await getSessionUser();
  const [row] = await db
    .update(accountDelegations)
    .set({ status: accept ? "accepted" : "rejected", respondedAt: new Date() })
    .where(
      and(
        eq(accountDelegations.id, id),
        eq(accountDelegations.ownerId, me.id),
        eq(accountDelegations.status, "pending"),
      ),
    )
    .returning({ id: accountDelegations.id });
  if (!row) return { ok: false, error: "Esta solicitud ya no está pendiente." };
  refresh();
  return { ok: true };
}

/**
 * Termina un acceso: la dueña lo quita, o quien las lleva deja de llevarlas
 * (o cancela su solicitud). Desde ese momento ya no puede ver ni tocar sus cuentas.
 */
export async function endAccess(id: string): Promise<FormState> {
  const me = await getSessionUser();
  const [row] = await db
    .select()
    .from(accountDelegations)
    .where(eq(accountDelegations.id, id))
    .limit(1);
  if (!row || (row.ownerId !== me.id && row.managerId !== me.id))
    return { ok: false, error: "No encontramos ese acceso." };
  await db
    .update(accountDelegations)
    .set({ status: "rejected", respondedAt: new Date() })
    .where(eq(accountDelegations.id, row.id));

  // Si yo estaba viendo sus cuentas, vuelvo a las mías.
  const store = await cookies();
  if (
    row.managerId === me.id &&
    store.get(ACTING_COOKIE)?.value === row.ownerId
  )
    store.delete(ACTING_COOKIE);
  refresh();
  return { ok: true };
}

/** Cambia entre mis cuentas ("") y las de alguien que me dio acceso. */
export async function switchAccounts(ownerId: string) {
  const me = await getSessionUser();
  const store = await cookies();
  if (!ownerId || ownerId === me.id) {
    store.delete(ACTING_COOKIE);
  } else {
    if (!(await actingAs(me, ownerId)))
      return { ok: false, error: "Ya no tienes acceso a esas cuentas." };
    store.set(ACTING_COOKIE, ownerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect("/dashboard");
}
