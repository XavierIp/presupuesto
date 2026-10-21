import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recurringPayments } from "@/lib/db/schema";
import {
  occurrenceInMonth,
  totalInstallments,
  type YearMonth,
} from "@/lib/schedule";
import { cardStatements } from "./cards";
import { loanAgenda } from "./loans";

// Uso interno de la capa de datos: quien llama ya resolvió al usuario con getCurrentUser().

/** `clear`: no hay nada que pagar (p. ej. tarjeta sin consumos ese mes). */
export type PaymentStatus = "paid" | "overdue" | "today" | "upcoming" | "clear";

type Base = {
  key: string;
  name: string;
  detail: string | null;
  /** Lo que falta (o lo que se pagó, si ya está pagado). */
  amount: number;
  currency: string;
  dueOn: string;
  status: PaymentStatus;
  paidOn: string | null;
  /** `out`: lo pago yo. `in`: me lo pagan a mí (préstamos que hice). */
  direction: "out" | "in";
};

export type AgendaItem =
  | (Base & {
      kind: "plan";
      planId: string;
      recordId: string | null;
      accountId: string | null;
    })
  | (Base & {
      kind: "card";
      cardId: string;
      /** Total del estado de cuenta (incluye lo arrastrado de meses anteriores). */
      billed: number;
      previous: number;
      paid: number;
      statementDate: string;
      /** El corte aún no llega: el monto puede subir con nuevas compras. */
      estimated: boolean;
    })
  | (Base & {
      kind: "loan";
      loanId: string;
      role: "lender" | "borrower";
      accountId: string | null;
    });

/** Marcas informativas del calendario (no son pagos): días de corte de las tarjetas. */
export type CalendarMarker = { date: string; label: string };

function statusFor(dueOn: string, today: string, paid: boolean): PaymentStatus {
  if (paid) return "paid";
  if (dueOn < today) return "overdue";
  return dueOn === today ? "today" : "upcoming";
}

function installmentLabel(
  installment: number,
  total: number | null,
  frequency: string,
) {
  if (frequency === "once") return "Pago único";
  if (total === null) return frequency === "monthly" ? "Mensual" : "Anual";
  return `Cuota ${installment} de ${total}`;
}

/** Todo lo que vence en el mes `ym`: pagos programados, tarjetas de crédito y préstamos. */
export async function buildAgenda(
  userId: string,
  ym: YearMonth,
  today: string,
): Promise<{ items: AgendaItem[]; markers: CalendarMarker[] }> {
  const [plans, cards, loans] = await Promise.all([
    db.query.recurringPayments.findMany({
      where: eq(recurringPayments.userId, userId),
      with: {
        category: { columns: { name: true } },
        records: { columns: { id: true, installment: true, paidOn: true } },
      },
      orderBy: asc(recurringPayments.name),
    }),
    cardStatements(userId, ym, today),
    loanAgenda(userId, ym),
  ]);

  const items: AgendaItem[] = [];
  const markers: CalendarMarker[] = [];

  for (const plan of plans) {
    const occurrence = occurrenceInMonth(plan, ym);
    if (!occurrence) continue;
    const record = plan.records.find(
      (r) => r.installment === occurrence.installment,
    );
    items.push({
      kind: "plan",
      key: `plan:${plan.id}`,
      planId: plan.id,
      recordId: record?.id ?? null,
      accountId: plan.accountId,
      name: plan.name,
      detail: [
        installmentLabel(
          occurrence.installment,
          totalInstallments(plan),
          plan.frequency,
        ),
        plan.category?.name,
      ]
        .filter(Boolean)
        .join(" · "),
      amount: plan.amount,
      currency: plan.currency,
      dueOn: occurrence.dueOn,
      status: statusFor(occurrence.dueOn, today, Boolean(record)),
      paidOn: record?.paidOn ?? null,
      direction: "out",
    });
  }

  for (const card of cards) {
    if (!card.bill || !card.statementDate) continue;
    const { bill } = card;
    markers.push({ date: card.statementDate, label: `Corte ${card.name}` });

    // El día de pago aparece siempre, aunque no haya nada que pagar ese mes.
    const nothingDue = bill.billed <= 0;
    const isPaid = !nothingDue && bill.paid >= bill.billed;
    const estimated = bill.dates.statementDate >= today;
    items.push({
      kind: "card",
      key: `card:${card.id}`,
      cardId: card.id,
      name: `Tarjeta ${card.name}`,
      detail: nothingDue
        ? "Sin consumos por pagar"
        : [
            card.last4 ? `•••• ${card.last4}` : null,
            bill.previous > 0 ? "incluye saldo anterior" : null,
            estimated ? "estimado hasta el corte" : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      amount: nothingDue ? 0 : isPaid ? bill.billed : bill.billed - bill.paid,
      billed: bill.billed,
      previous: bill.previous,
      paid: bill.paid,
      currency: card.currency,
      dueOn: bill.dates.dueDate,
      statementDate: bill.dates.statementDate,
      estimated,
      status: nothingDue
        ? "clear"
        : statusFor(bill.dates.dueDate, today, isPaid),
      paidOn: null,
      direction: "out",
    });
  }

  for (const loan of loans) {
    const paid = loan.remaining <= 0;
    items.push({
      kind: "loan",
      key: `loan:${loan.loanId}`,
      loanId: loan.loanId,
      role: loan.role,
      accountId: loan.accountId,
      name: loan.name,
      detail: loan.detail,
      amount: paid ? loan.amount : loan.remaining,
      currency: loan.currency,
      dueOn: loan.dueOn,
      status: statusFor(loan.dueOn, today, paid),
      paidOn: null,
      direction: loan.role === "lender" ? "in" : "out",
    });
  }

  items.sort(
    (a, b) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name),
  );
  return { items, markers };
}
