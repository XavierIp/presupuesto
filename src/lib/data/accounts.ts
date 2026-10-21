import "server-only";
import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialAccounts, transactions } from "@/lib/db/schema";
import type { PaymentSource } from "@/lib/accounts-shared";

// Uso interno de la capa de datos: quien llama ya resolvió al usuario con getCurrentUser().

/**
 * Saldo = saldo inicial + entradas (ingresos, préstamos recibidos/cobrados) − salidas
 * (gastos, préstamos dados/pagados, transferencias salientes) + transferencias entrantes.
 * Una compra en cuotas resta el total a pagar (cuota × N), que incluye intereses, como en el banco.
 */
const balanceExpr = sql<number>`${financialAccounts.openingBalance} + coalesce(sum(case
    when ${transactions.accountId} = ${financialAccounts.id} and ${transactions.kind} in ('income', 'loan_in') then ${transactions.amount}
    when ${transactions.accountId} = ${financialAccounts.id} and ${transactions.installments} > 1 and ${transactions.installmentAmount} is not null
      then -(${transactions.installments} * ${transactions.installmentAmount})
    when ${transactions.accountId} = ${financialAccounts.id} then -${transactions.amount}
    when ${transactions.toAccountId} = ${financialAccounts.id} then ${transactions.amount}
    else 0 end), 0)`.mapWith(Number);

export async function accountBalances(userId: string) {
  return db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      type: financialAccounts.type,
      currency: financialAccounts.currency,
      last4: financialAccounts.last4,
      creditLimit: financialAccounts.creditLimit,
      statementDay: financialAccounts.statementDay,
      paymentDueDay: financialAccounts.paymentDueDay,
      openingBalance: financialAccounts.openingBalance,
      balance: balanceExpr,
    })
    .from(financialAccounts)
    .leftJoin(
      transactions,
      or(
        eq(transactions.accountId, financialAccounts.id),
        eq(transactions.toAccountId, financialAccounts.id),
      ),
    )
    .where(and(eq(financialAccounts.userId, userId), isNull(financialAccounts.archivedAt)))
    .groupBy(financialAccounts.id)
    .orderBy(asc(financialAccounts.createdAt));
}

/** Saldo disponible: cuentas en la moneda principal, sin contar la deuda de tarjetas de crédito. */
export function availableBalance(
  accounts: Awaited<ReturnType<typeof accountBalances>>,
  currency: string,
) {
  return accounts
    .filter((a) => a.currency === currency && a.type !== "credit")
    .reduce((sum, a) => sum + a.balance, 0);
}

/** Cuenta principal: la primera cuenta (no de crédito) en la moneda del usuario. */
export async function primaryAccount(userId: string, currency: string) {
  const [account] = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.userId, userId),
        eq(financialAccounts.currency, currency),
        ne(financialAccounts.type, "credit"),
        isNull(financialAccounts.archivedAt),
      ),
    )
    .orderBy(asc(financialAccounts.createdAt))
    .limit(1);
  return account ?? null;
}

export function toPaymentSources(accounts: Awaited<ReturnType<typeof accountBalances>>) {
  return accounts.map(
    (a): PaymentSource => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      last4: a.last4,
      statementDay: a.statementDay,
      paymentDueDay: a.paymentDueDay,
      available:
        a.type !== "credit" ? a.balance : a.creditLimit === null ? null : a.creditLimit + a.balance,
    }),
  );
}

/** Cuenta activa del usuario, o null si no existe, es de otro usuario o está archivada. */
export async function ownActiveAccount(userId: string, accountId: string | null | undefined) {
  if (!accountId) return null;
  const [account] = await db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      type: financialAccounts.type,
      currency: financialAccounts.currency,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.userId, userId),
        isNull(financialAccounts.archivedAt),
      ),
    )
    .limit(1);
  return account ?? null;
}

/** Cuenta sugerida para mover efectivo: la primera que no es tarjeta de crédito, en esa moneda. */
export function defaultCashSource(sources: PaymentSource[], currency: string) {
  return sources.find((s) => s.type !== "credit" && s.currency === currency)?.id ?? null;
}
