import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { budgets, categories, transactions } from "@/lib/db/schema";
import {
  addMonths,
  firstDayOf,
  formatYearMonth,
  parseDate,
  parseYearMonth,
  todayIn,
} from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import {
  accountBalances,
  availableBalance,
  primaryAccount,
  toPaymentSources,
} from "./accounts";
import { buildAgenda } from "./agenda";
import { pendingLoanActions } from "./loans";

/**
 * Inicio: agenda de pagos del mes, saldo y lo que quedaría después de pagar.
 * Resuelve al usuario aquí dentro: nunca acepta un userId desde fuera.
 */
export async function getDashboard(monthParam?: string) {
  const user = await getCurrentUser();
  const today = todayIn();
  const current = parseDate(today);
  const ym = parseYearMonth(monthParam) ?? {
    year: current.year,
    month: current.month,
  };
  const start = firstDayOf(ym);
  const end = firstDayOf(addMonths(ym, 1));

  const [
    accounts,
    agendaData,
    monthTotals,
    budgetRows,
    recent,
    primary,
    loanActions,
  ] = await Promise.all([
    accountBalances(user.id),
    buildAgenda(user.id, ym, today),

    db
      .select({
        kind: transactions.kind,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(
          Number,
        ),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          inArray(transactions.kind, ["income", "expense"]),
          gte(transactions.occurredOn, start),
          lt(transactions.occurredOn, end),
        ),
      )
      .groupBy(transactions.kind),

    db
      .select({
        id: budgets.id,
        category: categories.name,
        amount: budgets.amount,
        spent: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(
          Number,
        ),
      })
      .from(budgets)
      .innerJoin(categories, eq(categories.id, budgets.categoryId))
      .leftJoin(
        transactions,
        and(
          eq(transactions.categoryId, budgets.categoryId),
          eq(transactions.userId, user.id),
          eq(transactions.kind, "expense"),
          gte(transactions.occurredOn, start),
          lt(transactions.occurredOn, end),
        ),
      )
      .where(and(eq(budgets.userId, user.id), eq(budgets.month, start)))
      .groupBy(budgets.id, categories.name)
      .orderBy(categories.name),

    db.query.transactions.findMany({
      where: eq(transactions.userId, user.id),
      with: {
        category: { columns: { name: true } },
        account: { columns: { name: true, currency: true } },
      },
      orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
      limit: 6,
    }),

    primaryAccount(user.id, user.currency),
    pendingLoanActions(user.id),
  ]);
  const agenda = agendaData.items;

  const mine = agenda.filter((i) => i.currency === user.currency);
  const outgoing = mine.filter((i) => i.direction === "out");
  const pendingItems = outgoing.filter(
    (i) => i.status !== "paid" && i.status !== "clear",
  );
  const toCollect = mine
    .filter((i) => i.direction === "in" && i.status !== "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const pending = pendingItems.reduce((sum, i) => sum + i.amount, 0);
  const available = availableBalance(accounts, user.currency);

  return {
    user,
    today,
    month: ym,
    monthKey: formatYearMonth(ym),
    prevMonth: formatYearMonth(addMonths(ym, -1)),
    nextMonth: formatYearMonth(addMonths(ym, 1)),
    isCurrentMonth: ym.year === current.year && ym.month === current.month,
    hasAccount: accounts.length > 0,
    available,
    agenda,
    pending,
    pendingCount: pendingItems.length,
    overdueCount: pendingItems.filter((i) => i.status === "overdue").length,
    paid: outgoing
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amount, 0),
    /** Lo que me deben pagar este mes (préstamos que hice). */
    toCollect,
    markers: agendaData.markers,
    loanActions,
    /** Lo que quedaría después de pagar todo lo pendiente del mes. */
    afterPayments: available - pending,
    income: monthTotals.find((t) => t.kind === "income")?.total ?? 0,
    expense: monthTotals.find((t) => t.kind === "expense")?.total ?? 0,
    budgets: budgetRows,
    recent,
    sources: toPaymentSources(accounts),
    /** Deuda total de cada tarjeta de crédito (para el formulario de pago). */
    cardDebt: Object.fromEntries(
      accounts
        .filter((a) => a.type === "credit")
        .map((a) => [a.id, Math.max(0, -a.balance)]),
    ) as Record<string, number>,
    defaultSourceId: primary?.id ?? null,
    /** Cuenta principal (la primera que no es tarjeta de crédito) con su saldo de hoy. */
    mainAccount: accounts.find((a) => a.id === primary?.id) ?? null,
    /** Cuentas en la moneda principal (sin tarjetas de crédito) que suman el disponible. */
    cashAccounts: accounts.filter(
      (a) => a.currency === user.currency && a.type !== "credit",
    ).length,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
