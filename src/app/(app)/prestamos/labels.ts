import type { LoanSummary } from "@/lib/data/loans";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/schedule";

/** "4 cuotas desde el 15 nov 2026 · 10 % de interés" */
export function describeTerms(loan: LoanSummary) {
  const rate = loan.interestRate
    ? ` · ${loan.interestRate / 100} % de interés`
    : "";
  if (loan.type === "open") {
    return (
      [
        `${loan.role === "lender" ? "Te paga" : "Pagas"} cada día ${loan.payDay}`,
        loan.creditLimit
          ? `límite ${formatMoney(loan.creditLimit, loan.currency)}`
          : "sin límite",
      ].join(" · ") + rate
    );
  }
  const n = loan.installments ?? 1;
  const first = loan.firstDueOn ? formatDate(loan.firstDueOn) : "—";
  return `${n === 1 ? `Un pago el ${first}` : `${n} cuotas desde el ${first}`}${rate}`;
}

export const LOAN_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Esperando respuesta", tone: "bg-warning/15 text-warning" },
  active: { label: "Activo", tone: "bg-primary/10 text-primary" },
  paid: { label: "Pagado", tone: "bg-income/10 text-income" },
  rejected: { label: "Rechazado", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cerrado", tone: "bg-muted text-muted-foreground" },
};

/** Texto de algo pendiente creado por la otra persona, visto desde mi rol. */
export function pendingTitle(
  kind: "entry" | "payment",
  myRole: "lender" | "borrower",
  counterpart: string,
  amount: string,
  paidWithCard = false,
) {
  if (kind === "entry") {
    if (myRole === "lender") return `${counterpart} te pide ${amount}`;
    return paidWithCard
      ? `${counterpart} registró una compra para ti por ${amount} (con su tarjeta)`
      : `${counterpart} te quiere entregar ${amount}`;
  }
  return myRole === "lender"
    ? `${counterpart} dice que te pagó ${amount}`
    : `${counterpart} registró que le pagaste ${amount}`;
}

export const REQUEST_STATUS = {
  pending: { label: "Pendiente", tone: "bg-warning/15 text-warning" },
  accepted: { label: "Aceptado", tone: "bg-income/10 text-income" },
  rejected: {
    label: "Rechazado",
    tone: "bg-muted text-muted-foreground line-through",
  },
} as const;
