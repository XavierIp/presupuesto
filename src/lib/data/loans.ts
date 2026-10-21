import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { loans } from "@/lib/db/schema";
import {
  installmentStatus,
  loanDueInMonth,
  loanSchedule,
  maskName,
  totalOwed,
} from "@/lib/loans";
import { todayIn, type YearMonth } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { accountBalances, defaultCashSource, toPaymentSources } from "./accounts";

// Las funciones sin getCurrentUser() son internas: quien llama ya resolvió al usuario.

type LoanRow = Awaited<ReturnType<typeof loadLoans>>[number];

async function loadLoans(where: ReturnType<typeof and>) {
  return db.query.loans.findMany({
    where,
    with: {
      lender: { columns: { id: true, name: true } },
      borrower: { columns: { id: true, name: true } },
      entries: { orderBy: (e, { desc }) => desc(e.createdAt) },
      payments: { orderBy: (p, { desc }) => desc(p.createdAt) },
    },
    orderBy: desc(loans.createdAt),
  });
}

/** Totales y estado derivado de un préstamo, desde el punto de vista de `userId`. */
function summarize(loan: LoanRow, userId: string, today: string) {
  const role =
    loan.lenderId === userId ? ("lender" as const) : ("borrower" as const);
  const lent = loan.entries
    .filter((e) => e.status === "accepted")
    .reduce((sum, e) => sum + e.amount, 0);
  const owed = totalOwed(lent, loan.interestRate);
  const paid = loan.payments
    .filter((p) => p.status === "accepted")
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = loan.payments.filter((p) => p.status === "pending");
  const pendingEntries = loan.entries.filter((e) => e.status === "pending");

  // El nombre completo de la otra persona solo se muestra cuando aceptó el trato.
  const counterpartRaw =
    role === "lender"
      ? (loan.borrower?.name ?? loan.borrowerName ?? "—")
      : loan.lender.name;
  const counterpart =
    role === "lender" && loan.borrowerId && loan.status === "pending"
      ? maskName(counterpartRaw)
      : counterpartRaw;

  const schedule =
    loan.type === "fixed" && loan.installments && loan.firstDueOn && owed > 0
      ? installmentStatus(
          loanSchedule(owed, loan.installments, loan.firstDueOn),
          paid,
        )
      : [];
  const nextDue = schedule.find((c) => !c.paid) ?? null;

  // Lo que espera una respuesta mía.
  const myActions = {
    acceptLoan: role === "borrower" && loan.status === "pending",
    acceptEntries:
      role === "lender" && loan.status === "active" ? pendingEntries : [],
    confirmPayments: role === "lender" ? pendingPayments : [],
  };

  return {
    id: loan.id,
    type: loan.type,
    status: loan.status,
    role,
    counterpart,
    isExternal: !loan.borrowerId,
    currency: loan.currency,
    note: loan.note,
    interestRate: loan.interestRate,
    installments: loan.installments,
    firstDueOn: loan.firstDueOn,
    payDay: loan.payDay,
    creditLimit: loan.creditLimit,
    lenderAccountId: loan.lenderAccountId,
    borrowerAccountId: loan.borrowerAccountId,
    lentOn: loan.lentOn,
    principal: loan.principal,
    lent,
    owed,
    paid,
    balance: Math.max(owed - paid, 0),
    pendingRequested:
      loan.type === "open" ? pendingEntries.reduce((sum, e) => sum + e.amount, 0) : 0,
    schedule,
    nextDue,
    overdue: Boolean(nextDue && nextDue.dueOn < today),
    entries: loan.entries,
    payments: loan.payments,
    myActions,
    actionCount:
      (myActions.acceptLoan ? 1 : 0) +
      myActions.acceptEntries.length +
      myActions.confirmPayments.length,
  };
}

export type LoanSummary = ReturnType<typeof summarize>;

/** Pantalla de préstamos: lo que presté y lo que me prestaron. */
export async function getLoansPage() {
  const user = await getCurrentUser();
  const today = todayIn();
  const [rows, accounts] = await Promise.all([
    loadLoans(or(eq(loans.lenderId, user.id), eq(loans.borrowerId, user.id))),
    accountBalances(user.id),
  ]);
  const all = rows.map((l) => summarize(l, user.id, today));
  const open = (l: LoanSummary) =>
    l.status === "active" || l.status === "pending";
  const lent = all.filter((l) => l.role === "lender");
  const borrowed = all.filter((l) => l.role === "borrower");
  const sum = (list: LoanSummary[]) =>
    list
      .filter((l) => l.status === "active" && l.currency === user.currency)
      .reduce((total, l) => total + l.balance, 0);

  return {
    user,
    today,
    lent: lent.filter(open),
    borrowed: borrowed.filter(open),
    closed: all.filter((l) => !open(l)),
    owedToMe: sum(lent),
    iOwe: sum(borrowed),
    actions: all.filter((l) => l.actionCount > 0),
    sources: toPaymentSources(accounts),
    defaultCashId: defaultCashSource(toPaymentSources(accounts), user.currency),
    hasDni: Boolean(user.dni),
  };
}

/** Detalle de un préstamo, solo si el usuario es una de las partes. */
export async function getLoanDetail(loanId: string) {
  const user = await getCurrentUser();
  const today = todayIn();
  const [rows, accounts] = await Promise.all([
    loadLoans(
      and(
        eq(loans.id, loanId),
        or(eq(loans.lenderId, user.id), eq(loans.borrowerId, user.id)),
      ),
    ),
    accountBalances(user.id),
  ]);
  if (!rows[0]) return null;
  return {
    user,
    today,
    loan: summarize(rows[0], user.id, today),
    sources: toPaymentSources(accounts),
    defaultCashId: defaultCashSource(toPaymentSources(accounts), rows[0].currency),
  };
}

/** Cuántas cosas de préstamos esperan respuesta del usuario (para el aviso en Inicio). */
export async function pendingLoanActions(userId: string) {
  const rows = await loadLoans(
    and(
      or(eq(loans.lenderId, userId), eq(loans.borrowerId, userId)),
      inArray(loans.status, ["pending", "active"]),
    ),
  );
  const today = todayIn();
  return rows
    .map((l) => summarize(l, userId, today))
    .reduce((n, l) => n + l.actionCount, 0);
}

export type LoanAgendaItem = {
  loanId: string;
  role: "lender" | "borrower";
  name: string;
  detail: string;
  dueOn: string;
  amount: number;
  remaining: number;
  currency: string;
  /** Cuenta sugerida para pagar (deudor) o recibir (prestamista). */
  accountId: string | null;
};

/** Pagos de préstamos que vencen en el mes: los que debo pagar y los que me deben pagar. */
export async function loanAgenda(
  userId: string,
  ym: YearMonth,
): Promise<LoanAgendaItem[]> {
  const rows = await loadLoans(
    and(
      or(eq(loans.lenderId, userId), eq(loans.borrowerId, userId)),
      eq(loans.status, "active"),
    ),
  );
  const today = todayIn();
  const items: LoanAgendaItem[] = [];
  for (const row of rows) {
    const loan = summarize(row, userId, today);
    const due = loanDueInMonth(loan, ym, { owed: loan.owed, paid: loan.paid });
    if (!due) continue;
    items.push({
      loanId: loan.id,
      role: loan.role,
      name:
        loan.role === "lender"
          ? `Te paga ${loan.counterpart}`
          : `Préstamo de ${loan.counterpart}`,
      detail: due.label,
      dueOn: due.dueOn,
      amount: due.amount,
      remaining: due.remaining,
      currency: loan.currency,
      accountId:
        loan.role === "lender" ? loan.lenderAccountId : loan.borrowerAccountId,
    });
  }
  return items;
}
