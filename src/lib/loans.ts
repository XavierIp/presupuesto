// Lógica de préstamos. Funciones puras; los montos están en centavos y las fechas en "YYYY-MM-DD".

import {
  addMonths,
  daysInMonth,
  formatYearMonth,
  parseDate,
  type YearMonth,
} from "./schedule";

export type LoanTerms = {
  type: "fixed" | "open";
  /** Interés total en puntos básicos (500 = 5 %). */
  interestRate: number;
  installments: number | null;
  firstDueOn: string | null;
  payDay: number | null;
  /** Cuenta libre: fecha de la primera entrega. No hay vencimientos en o antes de esa fecha. */
  startsOn?: string | null;
};

/** Total a devolver: lo prestado (aceptado) más el interés. */
export function totalOwed(lent: number, interestRate: number) {
  return Math.round(lent * (1 + interestRate / 10_000));
}

export type LoanInstallment = { number: number; dueOn: string; amount: number };

/** Cronograma de cuotas mensuales del préstamo con condiciones. La última absorbe el redondeo. */
export function loanSchedule(
  total: number,
  installments: number,
  firstDueOn: string,
): LoanInstallment[] {
  const first = parseDate(firstDueOn);
  const each = Math.floor(total / installments);
  return Array.from({ length: installments }, (_, i) => {
    const ym = addMonths(first, i);
    const day = Math.min(first.day, daysInMonth(ym));
    return {
      number: i + 1,
      dueOn: `${formatYearMonth(ym)}-${String(day).padStart(2, "0")}`,
      amount: i === installments - 1 ? total - each * (installments - 1) : each,
    };
  });
}

/**
 * Estado de cada cuota según lo abonado: los abonos cubren las cuotas en orden.
 * `remaining` es lo que falta de esa cuota.
 */
export function installmentStatus(schedule: LoanInstallment[], paid: number) {
  let cumulative = 0;
  return schedule.map((cuota) => {
    const before = cumulative;
    cumulative += cuota.amount;
    const covered = Math.min(Math.max(paid - before, 0), cuota.amount);
    return {
      ...cuota,
      remaining: cuota.amount - covered,
      paid: covered >= cuota.amount,
    };
  });
}

/** Lo que vence en el mes `ym` para un préstamo, o null si ese mes no hay pago. */
export function loanDueInMonth(
  terms: LoanTerms,
  ym: YearMonth,
  { owed, paid }: { owed: number; paid: number },
): { dueOn: string; amount: number; remaining: number; label: string } | null {
  if (terms.type === "fixed") {
    if (!terms.installments || !terms.firstDueOn) return null;
    const schedule = installmentStatus(
      loanSchedule(owed, terms.installments, terms.firstDueOn),
      paid,
    );
    const prefix = formatYearMonth(ym);
    const cuota = schedule.find((c) => c.dueOn.startsWith(prefix));
    if (!cuota) return null;
    return {
      dueOn: cuota.dueOn,
      amount: cuota.amount,
      remaining: cuota.remaining,
      label:
        terms.installments === 1
          ? "Pago único"
          : `Cuota ${cuota.number} de ${terms.installments}`,
    };
  }
  // Cuenta libre: cada mes, en el día de pago, vence todo el saldo pendiente.
  if (!terms.payDay) return null;
  const balance = Math.max(owed - paid, 0);
  if (owed <= 0) return null;
  const day = Math.min(terms.payDay, daysInMonth(ym));
  const dueOn = `${formatYearMonth(ym)}-${String(day).padStart(2, "0")}`;
  // El primer pago es el día de pago siguiente a la primera entrega (antes no había deuda).
  if (terms.startsOn && dueOn <= terms.startsOn) return null;
  return {
    dueOn,
    amount: balance,
    remaining: balance,
    label: "Saldo de la cuenta libre",
  };
}

/** "Xavier Ibarra Prieto" → "Xavier I. P." (para confirmar a quién se presta sin exponer el nombre). */
export function maskName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first, ...rest.map((part) => `${part[0]?.toUpperCase()}.`)].join(" ");
}

/** Próximo día de pago de una cuenta libre: el primero después de la primera entrega y desde hoy. */
export function openNextDue(payDay: number, startsOn: string, today: string) {
  const from = today > startsOn ? today : startsOn;
  const start = parseDate(from);
  for (let i = 0; i < 2; i++) {
    const ym = addMonths(start, i);
    const dueOn = `${formatYearMonth(ym)}-${String(Math.min(payDay, daysInMonth(ym))).padStart(2, "0")}`;
    if (dueOn > startsOn && dueOn >= today) return dueOn;
  }
  return null;
}

/** Porcentaje escrito por el usuario ("5", "2.5") → puntos básicos. */
export function percentToBasisPoints(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
