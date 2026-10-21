// Cálculo de fechas de pagos programados. Funciones puras sobre fechas "YYYY-MM-DD".

export type Frequency = "monthly" | "yearly" | "once";

export type SchedulePlan = {
  frequency: Frequency;
  /** Fecha del primer pago. */
  startDate: string;
  /** Día de pago; si el mes es más corto se usa su último día (p. ej. 31 → 28 de febrero). */
  dayOfMonth: number;
  /** Total de cuotas; nulo = sin fin. */
  installments: number | null;
};

export type Occurrence = { installment: number; dueOn: string };

/** Mes calendario, `month` de 1 a 12. */
export type YearMonth = { year: number; month: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function daysInMonth({ year, month }: YearMonth) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseDate(date: string): YearMonth & { day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function formatYearMonth({ year, month }: YearMonth) {
  return `${year}-${pad(month)}`;
}

/** "2026-10" → { year: 2026, month: 10 }. Devuelve null si el texto no es válido. */
export function parseYearMonth(value: string | undefined | null): YearMonth | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function firstDayOf(ym: YearMonth) {
  return `${formatYearMonth(ym)}-01`;
}

function dueDateIn(ym: YearMonth, dayOfMonth: number) {
  return `${formatYearMonth(ym)}-${pad(Math.min(dayOfMonth, daysInMonth(ym)))}`;
}

function monthIndex({ year, month }: YearMonth) {
  return year * 12 + month;
}

/** Cuota que cae en un mes dado, o null si ese mes no hay pago. */
export function occurrenceInMonth(plan: SchedulePlan, ym: YearMonth): Occurrence | null {
  const start = parseDate(plan.startDate);
  let index: number;

  if (plan.frequency === "monthly") {
    index = monthIndex(ym) - monthIndex(start);
  } else if (plan.frequency === "yearly") {
    if (ym.month !== start.month) return null;
    index = ym.year - start.year;
  } else {
    index = monthIndex(ym) === monthIndex(start) ? 0 : -1;
  }

  if (index < 0) return null;
  if (plan.installments !== null && index >= plan.installments) return null;
  return { installment: index + 1, dueOn: dueDateIn(ym, plan.dayOfMonth) };
}

/** Fecha de la última cuota, o null si el plan no tiene fin. */
export function lastDueDate(plan: SchedulePlan): string | null {
  const start = parseDate(plan.startDate);
  if (plan.frequency === "once") return dueDateIn(start, plan.dayOfMonth);
  if (plan.installments === null) return null;
  const monthsPerStep = plan.frequency === "monthly" ? 1 : 12;
  return dueDateIn(addMonths(start, (plan.installments - 1) * monthsPerStep), plan.dayOfMonth);
}

/** Número total de cuotas del plan (1 para pago único, null si no tiene fin). */
export function totalInstallments(plan: SchedulePlan) {
  return plan.frequency === "once" ? 1 : plan.installments;
}

/** Fecha "YYYY-MM-DD" de un instante, en la zona horaria de la app. */
export function dateIn(date: Date, timeZone = process.env.APP_TIME_ZONE ?? "America/Lima") {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

/** Fecha de hoy "YYYY-MM-DD" en la zona horaria de la app. */
export function todayIn(timeZone?: string) {
  return dateIn(new Date(), timeZone);
}

/** "2026-10-14" → "14 oct 2026" (o "14 oct" con `withYear: false`). */
export function formatDate(date: string, { withYear = true, weekday = false } = {}) {
  const { year, month, day } = parseDate(date);
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    weekday: weekday ? "short" : undefined,
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(/\./g, "");
}

/** "octubre de 2026" */
export function formatMonth({ year, month }: YearMonth) {
  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** Días entre dos fechas "YYYY-MM-DD" (b − a). */
export function daysBetween(a: string, b: string) {
  const toUtc = (d: string) => {
    const { year, month, day } = parseDate(d);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}
