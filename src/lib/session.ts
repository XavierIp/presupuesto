import "server-only";
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountDelegations, user as users } from "@/lib/db/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  currency: string;
  /** Nulo solo en cuentas creadas antes de exigir el DNI. */
  dni: string | null;
  /**
   * Si estás llevando las cuentas de otra persona: tú (quien inició sesión).
   * Nulo cuando ves tus propias cuentas.
   */
  actor: { id: string; name: string } | null;
};

/** Cookie con el id de la persona cuyas cuentas estoy llevando. */
export const ACTING_COOKIE = "acting_as";

/**
 * Quien inició sesión, siempre. Úsalo para lo personal: contraseña, código de recuperación,
 * DNI, acceso compartido y administración.
 */
export async function getSessionUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id, name, email, currency, dni } = session.user;
  return {
    id,
    name,
    email,
    currency: currency ?? "PEN",
    dni: dni ?? null,
    actor: null,
  };
}

/**
 * Capa de acceso a datos: único punto para leer al usuario cuyas cuentas se muestran.
 * Normalmente es quien inició sesión; si eligió llevar las cuentas de otra persona y ese
 * acceso sigue aceptado, es esa persona (con `actor` = quien inició sesión).
 * Lee la petición, así que quien lo llame debe estar dentro de un <Suspense>.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const me = await getSessionUser();
  const ownerId = (await cookies()).get(ACTING_COOKIE)?.value;
  if (!ownerId || ownerId === me.id) return me;
  return (await actingAs(me, ownerId)) ?? me;
}

/** La persona `ownerId` si `me` tiene acceso aceptado a sus cuentas; si no, null. */
export async function actingAs(
  me: { id: string; name: string },
  ownerId: string,
): Promise<CurrentUser | null> {
  const [owner] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      currency: users.currency,
      dni: users.dni,
    })
    .from(accountDelegations)
    .innerJoin(users, eq(users.id, accountDelegations.ownerId))
    .where(
      and(
        eq(accountDelegations.ownerId, ownerId),
        eq(accountDelegations.managerId, me.id),
        eq(accountDelegations.status, "accepted"),
      ),
    )
    .limit(1);
  if (!owner) return null;
  return { ...owner, actor: { id: me.id, name: me.name } };
}
