import "server-only";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import {
  billDates,
  billedInstallments,
  cardBill,
  chargeForStatement,
  statementDateIn,
  type CardCharge,
} from "@/lib/card-billing";
import { db } from "@/lib/db";
import { financialAccounts, transactions } from "@/lib/db/schema";
import { addMonths, dateIn, firstDayOf, type YearMonth } from "@/lib/schedule";

// Uso interno de la capa de datos: quien llama ya resolvió al usuario con getCurrentUser().

const LOOKBACK = 12;

/**
 * Estado de cada tarjeta de crédito para el pago que vence en `dueMonth`, como lo haría el banco:
 * compras del periodo + cuotas que tocan + lo no pagado antes, menos lo abonado.
 * Las tarjetas sin día de corte o de pago devuelven `bill: null`.
 */
export async function cardStatements(
  userId: string,
  dueMonth: YearMonth,
  today: string,
) {
  const cards = await db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      last4: financialAccounts.last4,
      currency: financialAccounts.currency,
      statementDay: financialAccounts.statementDay,
      paymentDueDay: financialAccounts.paymentDueDay,
      openingBalance: financialAccounts.openingBalance,
      createdAt: financialAccounts.createdAt,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.userId, userId),
        eq(financialAccounts.type, "credit"),
        isNull(financialAccounts.archivedAt),
      ),
    );
  if (cards.length === 0) return [];

  const cardIds = cards.map((c) => c.id);
  // Las cuotas pueden venir de compras de hasta 5 años atrás.
  const since = firstDayOf(addMonths(dueMonth, -(LOOKBACK + 60)));
  const [charges, payments] = await Promise.all([
    db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        description: transactions.description,
        occurredOn: transactions.occurredOn,
        amount: transactions.amount,
        installments: transactions.installments,
        installmentAmount: transactions.installmentAmount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.kind, "expense"),
          inArray(transactions.accountId, cardIds),
          gte(transactions.occurredOn, since),
        ),
      ),
    db
      .select({
        toAccountId: transactions.toAccountId,
        occurredOn: transactions.occurredOn,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.kind, "transfer"),
          inArray(transactions.toAccountId, cardIds),
          gte(
            transactions.occurredOn,
            firstDayOf(addMonths(dueMonth, -(LOOKBACK + 2))),
          ),
        ),
      ),
  ]);

  return cards.map((card) => {
    const own = charges.filter((c) => c.accountId === card.id);
    const installmentPurchases = own.filter((c) => (c.installments ?? 1) > 1);
    const cycle =
      card.statementDay && card.paymentDueDay
        ? { statementDay: card.statementDay, dueDay: card.paymentDueDay }
        : null;

    // La deuda que tenía la tarjeta al registrarla se cobra en el primer pago.
    const openingDebt = Math.max(0, -card.openingBalance);
    const billable: (CardCharge & { description?: string | null })[] = [...own];
    if (openingDebt > 0) {
      billable.push({
        description: "Deuda que tenía la tarjeta al registrarla",
        occurredOn: dateIn(card.createdAt),
        amount: openingDebt,
        installments: null,
        installmentAmount: null,
      });
    }
    // Qué compras y cuotas forman el estado de cuenta de este mes.
    const statementMonth = cycle
      ? billDates(cycle, dueMonth).statementMonth
      : null;
    const lines =
      cycle && statementMonth
        ? billable
            .map((c) => {
              const { amount, installment } = chargeForStatement(
                cycle,
                c,
                statementMonth,
              );
              return {
                description: c.description || "Compra",
                occurredOn: c.occurredOn,
                amount,
                installment,
                installments: c.installments,
              };
            })
            .filter((l) => l.amount > 0)
            .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
        : [];

    return {
      ...card,
      cycle,
      bill: cycle
        ? cardBill(
            cycle,
            dueMonth,
            billable,
            payments.filter((p) => p.toAccountId === card.id),
            LOOKBACK,
          )
        : null,
      statementDate: cycle ? statementDateIn(cycle, dueMonth) : null,
      /** Compras y cuotas que entran en el pago de este mes. */
      lines,
      /** Compras en cuotas que aún tienen cuotas por cobrar. */
      pendingInstallments: installmentPurchases
        .map((c) => {
          const total = c.installments ?? 1;
          const each = c.installmentAmount ?? Math.round(c.amount / total);
          const billed = cycle ? billedInstallments(cycle, c, today) : 0;
          return {
            id: c.id,
            description: c.description,
            occurredOn: c.occurredOn,
            total,
            each,
            billed,
            remaining: (total - billed) * each,
          };
        })
        .filter((c) => c.billed < c.total),
    };
  });
}

export type CardStatement = Awaited<ReturnType<typeof cardStatements>>[number];
