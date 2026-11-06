import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { accountDelegations, user as users } from "@/lib/db/schema";

// Uso interno: quien llama ya resolvió al usuario con getSessionUser().

const owner = alias(users, "owner");
const manager = alias(users, "manager");

/**
 * Acceso compartido de `userId` (quien inició sesión):
 * - `managing`: cuentas de otras personas que llevo (o pedí llevar).
 * - `managers`: quién lleva mis cuentas (o lo pidió).
 */
export async function getSharing(userId: string) {
  const [managing, managers] = await Promise.all([
    db
      .select({
        id: accountDelegations.id,
        status: accountDelegations.status,
        personId: owner.id,
        name: owner.name,
      })
      .from(accountDelegations)
      .innerJoin(owner, eq(owner.id, accountDelegations.ownerId))
      .where(
        and(
          eq(accountDelegations.managerId, userId),
          ne(accountDelegations.status, "rejected"),
        ),
      )
      .orderBy(owner.name),
    db
      .select({
        id: accountDelegations.id,
        status: accountDelegations.status,
        personId: manager.id,
        name: manager.name,
      })
      .from(accountDelegations)
      .innerJoin(manager, eq(manager.id, accountDelegations.managerId))
      .where(
        and(
          eq(accountDelegations.ownerId, userId),
          ne(accountDelegations.status, "rejected"),
        ),
      )
      .orderBy(manager.name),
  ]);
  return { managing, managers };
}

export type Sharing = Awaited<ReturnType<typeof getSharing>>;
