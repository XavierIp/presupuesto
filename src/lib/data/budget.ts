import "server-only";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  budgets,
  categories,
  recurringPayments,
  transactions,
} from "@/lib/db/schema";
import {
  addMonths,
  firstDayOf,
  formatYearMonth,
  lastDueDate,
  occurrencesInMonth,
  parseDate,
  parseYearMonth,
  todayIn,
  totalInstallments,
} from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { accountBalances, toPaymentSources } from "./accounts";

/**
 * Pantalla de Presupuesto: planificación del mes (presupuesto por categoría) y gestión
 * de pagos programados. La agenda de pagos y el calendario viven en Inicio.
 */
export async function getBudgetPage(monthParam?: string) {
  const user = await getCurrentUser();
  const today = todayIn();
  const current = parseDate(today);
  const ym = parseYearMonth(monthParam) ?? {
    year: current.year,
    month: current.month,
  };
  const start = firstDayOf(ym);
  const end = firstDayOf(addMonths(ym, 1));

  const [accounts, plans, expenseRow, budgetRows, expenseCategories] =
    await Promise.all([
      accountBalances(user.id),

      db.query.recurringPayments.findMany({
        where: eq(recurringPayments.userId, user.id),
        with: {
          category: { columns: { name: true } },
          records: { columns: { id: true } },
        },
        orderBy: [
          asc(recurringPayments.dayOfMonth),
          asc(recurringPayments.name),
        ],
      }),

      db
        .select({
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(
            Number,
          ),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            eq(transactions.kind, "expense"),
            gte(transactions.occurredOn, start),
            lt(transactions.occurredOn, end),
          ),
        ),

      db
        .select({
          id: budgets.id,
          categoryId: budgets.categoryId,
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

      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(
          and(eq(categories.userId, user.id), eq(categories.kind, "expense")),
        )
        .orderBy(categories.name),
    ]);

  const budgeted = budgetRows.reduce((sum, b) => sum + b.amount, 0);
  const budgetSpent = budgetRows.reduce((sum, b) => sum + b.spent, 0);
  const fixedThisMonth = plans
    .filter((p) => p.currency === user.currency)
    .reduce((sum, p) => sum + p.amount * occurrencesInMonth(p, ym).length, 0);

  return {
    user,
    today,
    month: ym,
    monthKey: formatYearMonth(ym),
    prevMonth: formatYearMonth(addMonths(ym, -1)),
    nextMonth: formatYearMonth(addMonths(ym, 1)),
    isCurrentMonth: ym.year === current.year && ym.month === current.month,
    budgeted,
    budgetSpent,
    expense: expenseRow[0]?.total ?? 0,
    fixedThisMonth,
    fixedCount: plans.reduce((n, p) => n + occurrencesInMonth(p, ym).length, 0),
    budgets: budgetRows,
    expenseCategories,
    sources: toPaymentSources(accounts),
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      category: plan.category?.name ?? null,
      frequency: plan.frequency,
      startDate: plan.startDate,
      dayOfMonth: plan.dayOfMonth,
      totalInstallments: totalInstallments(plan),
      paidCount: plan.records.length,
      lastDueDate: lastDueDate(plan),
    })),
  };
}

export type BudgetPageData = Awaited<ReturnType<typeof getBudgetPage>>;
