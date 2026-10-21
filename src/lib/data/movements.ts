import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or, type SQL } from "drizzle-orm";
import { firstStatementMonth } from "@/lib/card-billing";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import {
  addMonths,
  daysInMonth,
  firstDayOf,
  formatYearMonth,
  parseDate,
  parseYearMonth,
  todayIn,
} from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { accountBalances, toPaymentSources } from "./accounts";

export type MovementKindFilter = "income" | "expense" | "transfer";

/** Movimientos del mes con filtros opcionales por tipo y cuenta. */
export async function getMovements(params: {
  mes?: string;
  tipo?: string;
  cuenta?: string;
}) {
  const user = await getCurrentUser();
  const today = todayIn();
  const current = parseDate(today);
  const ym = parseYearMonth(params.mes) ?? {
    year: current.year,
    month: current.month,
  };
  const start = firstDayOf(ym);
  const end = firstDayOf(addMonths(ym, 1));
  const kind =
    (["income", "expense", "transfer", "loan"] as const).find(
      (k) => k === params.tipo,
    ) ?? null;

  const accounts = await accountBalances(user.id);
  const accountId = accounts.some((a) => a.id === params.cuenta)
    ? params.cuenta!
    : null;

  const filters: SQL[] = [
    eq(transactions.userId, user.id),
    gte(transactions.occurredOn, start),
    lt(transactions.occurredOn, end),
  ];
  if (kind === "loan") {
    filters.push(inArray(transactions.kind, ["loan_out", "loan_in"]));
  } else if (kind) {
    filters.push(eq(transactions.kind, kind));
  }
  if (accountId) {
    filters.push(
      or(
        eq(transactions.accountId, accountId),
        eq(transactions.toAccountId, accountId),
      )!,
    );
  }

  const [rows, categoryRows] = await Promise.all([
    db.query.transactions.findMany({
      where: and(...filters),
      with: {
        category: { columns: { name: true } },
        account: {
          columns: {
            id: true,
            name: true,
            type: true,
            last4: true,
            currency: true,
            statementDay: true,
            paymentDueDay: true,
          },
        },
        toAccount: { columns: { name: true, type: true, last4: true } },
      },
      orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
    }),
    db
      .select({
        id: categories.id,
        name: categories.name,
        kind: categories.kind,
      })
      .from(categories)
      .where(eq(categories.userId, user.id))
      .orderBy(asc(categories.name)),
  ]);

  const movements = rows.map((t) => ({
    id: t.id,
    kind: t.kind,
    amount: t.amount,
    description: t.description,
    occurredOn: t.occurredOn,
    category: t.category?.name ?? null,
    account: t.account,
    toAccount: t.toAccount,
    installments: t.installments,
    installmentAmount: t.installmentAmount,
    loanId: t.loanId,
    installmentProgress: installmentProgress(t, today),
  }));

  // Agrupa por día, en el orden en que llegan (más reciente primero).
  const days: { date: string; items: typeof movements }[] = [];
  for (const m of movements) {
    const last = days.at(-1);
    if (last?.date === m.occurredOn) last.items.push(m);
    else days.push({ date: m.occurredOn, items: [m] });
  }

  const sum = (k: string) =>
    movements
      .filter((m) => m.kind === k && m.account.currency === user.currency)
      .reduce((total, m) => total + m.amount, 0);

  return {
    user,
    today,
    month: ym,
    monthKey: formatYearMonth(ym),
    prevMonth: formatYearMonth(addMonths(ym, -1)),
    nextMonth: formatYearMonth(addMonths(ym, 1)),
    isCurrentMonth: ym.year === current.year && ym.month === current.month,
    filters: { kind, accountId },
    days,
    count: movements.length,
    income: sum("income"),
    expense: sum("expense"),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      last4: a.last4,
    })),
    sources: toPaymentSources(accounts),
    incomeCategories: categoryRows.filter((c) => c.kind === "income"),
    expenseCategories: categoryRows.filter((c) => c.kind === "expense"),
  };
}

/** Para compras en cuotas: cuántas cuotas ya se facturaron a la fecha de hoy. */
function installmentProgress(
  t: {
    occurredOn: string;
    installments: number | null;
    account: {
      type: string;
      statementDay: number | null;
      paymentDueDay: number | null;
    };
  },
  today: string,
) {
  if (!t.installments || t.installments < 2 || t.account.type !== "credit")
    return null;
  if (!t.account.statementDay || !t.account.paymentDueDay)
    return { billed: null, total: t.installments };
  const card = {
    statementDay: t.account.statementDay,
    dueDay: t.account.paymentDueDay,
  };
  // Cuota i se factura en el corte (primer corte + i meses); cuenta como cobrada si ese corte ya pasó.
  const first = firstStatementMonth(card, t.occurredOn);
  let billed = 0;
  for (let i = 0; i < t.installments; i++) {
    const ym = addMonths(first, i);
    const statement = `${formatYearMonth(ym)}-${String(Math.min(card.statementDay, daysInMonth(ym))).padStart(2, "0")}`;
    if (statement > today) break;
    billed++;
  }
  return { billed, total: t.installments };
}

export type MovementsData = Awaited<ReturnType<typeof getMovements>>;
