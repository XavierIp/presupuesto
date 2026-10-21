// Facturación de tarjetas de crédito. Funciones puras sobre fechas "YYYY-MM-DD".
//
// Cada mes la tarjeta "corta" el día `statementDay` y el pago vence el día `dueDay`.
// - Compra en 1 cuota: se factura completa en el primer corte en o después de la compra.
// - Compra en N cuotas: desde ese primer corte, se factura una cuota por mes durante N meses.

import {
  addMonths,
  daysInMonth,
  formatYearMonth,
  parseDate,
  type YearMonth,
} from "./schedule";

export type CardCycle = { statementDay: number; dueDay: number };

export type CardCharge = {
  occurredOn: string;
  amount: number;
  installments: number | null;
  installmentAmount: number | null;
};

const monthIndex = ({ year, month }: YearMonth) => year * 12 + month;

function dayIn(ym: YearMonth, day: number) {
  return `${formatYearMonth(ym)}-${String(Math.min(day, daysInMonth(ym))).padStart(2, "0")}`;
}

/** Mes de corte cuyo pago vence en `dueMonth`. */
function statementMonthFor(card: CardCycle, dueMonth: YearMonth) {
  // Si el pago es después del corte en el mismo mes (corte 5, pago 25), es el mismo mes;
  // si no (corte 20, pago 5), el corte fue el mes anterior.
  return card.dueDay > card.statementDay ? dueMonth : addMonths(dueMonth, -1);
}

/** Fechas del estado de cuenta cuyo pago vence en `dueMonth`. */
export function billDates(card: CardCycle, dueMonth: YearMonth) {
  const statementMonth = statementMonthFor(card, dueMonth);
  return {
    statementMonth,
    previousStatement: dayIn(addMonths(statementMonth, -1), card.statementDay),
    statementDate: dayIn(statementMonth, card.statementDay),
    nextStatement: dayIn(addMonths(statementMonth, 1), card.statementDay),
    dueDate: dayIn(dueMonth, card.dueDay),
  };
}

/** Mes del primer corte que incluye una compra hecha en `date`. */
export function firstStatementMonth(card: CardCycle, date: string): YearMonth {
  const { year, month } = parseDate(date);
  const ym = { year, month };
  return date <= dayIn(ym, card.statementDay) ? ym : addMonths(ym, 1);
}

/** Cuota que una compra factura en un mes de corte (0 si no factura nada ese mes). */
export function chargeForStatement(
  card: CardCycle,
  charge: CardCharge,
  statementMonth: YearMonth,
) {
  const first = firstStatementMonth(card, charge.occurredOn);
  const index = monthIndex(statementMonth) - monthIndex(first);
  const n = charge.installments ?? 1;
  if (index < 0 || index >= n) return { amount: 0, installment: null };
  if (n === 1) return { amount: charge.amount, installment: null };
  return {
    amount: charge.installmentAmount ?? Math.round(charge.amount / n),
    installment: index + 1,
  };
}

/** Total a pagar en el mes `dueMonth` y cuántas compras/cuotas lo forman. */
export function billAmount(
  card: CardCycle,
  dueMonth: YearMonth,
  charges: CardCharge[],
) {
  const { statementMonth } = billDates(card, dueMonth);
  let total = 0;
  let items = 0;
  for (const charge of charges) {
    const { amount } = chargeForStatement(card, charge, statementMonth);
    if (amount > 0) {
      total += amount;
      items += 1;
    }
  }
  return { total, items };
}

export type CardPayment = { occurredOn: string; amount: number };

/**
 * Estado de cuenta "real" del pago que vence en `dueMonth`:
 * lo no pagado (o pagado de más) en meses anteriores se arrastra al siguiente pago.
 * `lookback` limita cuántos meses hacia atrás se revisan.
 */
export function cardBill(
  card: CardCycle,
  dueMonth: YearMonth,
  charges: CardCharge[],
  payments: CardPayment[],
  lookback = 12,
) {
  const paidIn = (dates: ReturnType<typeof billDates>) =>
    payments
      .filter(
        (p) =>
          p.occurredOn > dates.statementDate &&
          p.occurredOn <= dates.nextStatement,
      )
      .reduce((sum, p) => sum + p.amount, 0);

  let carried = 0;
  for (let k = lookback; k >= 1; k--) {
    const month = addMonths(dueMonth, -k);
    carried +=
      billAmount(card, month, charges).total - paidIn(billDates(card, month));
  }

  const dates = billDates(card, dueMonth);
  const { total: newCharges, items } = billAmount(card, dueMonth, charges);
  return {
    dates,
    /** Saldo arrastrado de meses anteriores (negativo = saldo a favor). */
    previous: carried,
    newCharges,
    items,
    /** Total a pagar en este vencimiento. */
    billed: Math.max(0, carried + newCharges),
    /** Pagado después del corte de este estado de cuenta. */
    paid: paidIn(dates),
  };
}

/** Cuántas cuotas de una compra ya se facturaron (su corte es hoy o ya pasó). */
export function billedInstallments(
  card: CardCycle,
  charge: CardCharge,
  today: string,
) {
  const n = charge.installments ?? 1;
  const first = firstStatementMonth(card, charge.occurredOn);
  let billed = 0;
  for (let i = 0; i < n; i++) {
    if (dayIn(addMonths(first, i), card.statementDay) > today) break;
    billed++;
  }
  return billed;
}

/** Fecha de corte de la tarjeta en un mes. */
export function statementDateIn(card: CardCycle, ym: YearMonth) {
  return dayIn(ym, card.statementDay);
}
