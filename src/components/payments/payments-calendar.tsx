"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  HandCoins,
  ReceiptText,
  Scissors,
} from "lucide-react";
import type {
  AgendaItem,
  CalendarMarker,
  PaymentStatus,
} from "@/lib/data/agenda";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import {
  daysInMonth,
  firstDayOf,
  formatDate,
  formatYearMonth,
  parseDate,
  type YearMonth,
} from "@/lib/schedule";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CHIP: Record<PaymentStatus, string> = {
  paid: "bg-muted text-muted-foreground line-through",
  overdue: "bg-expense/10 text-expense",
  today: "bg-warning/15 text-warning",
  upcoming: "bg-primary/10 text-primary",
  clear: "border border-dashed text-muted-foreground",
};

const DOT: Record<PaymentStatus, string> = {
  paid: "bg-muted-foreground",
  overdue: "bg-expense",
  today: "bg-warning",
  upcoming: "bg-primary",
  clear: "border border-muted-foreground",
};

const STATUS_TEXT: Record<PaymentStatus, string> = {
  paid: "Pagado",
  overdue: "Vencido",
  today: "Vence hoy",
  upcoming: "Por pagar",
  clear: "Nada que pagar",
};

const BADGE: Record<PaymentStatus, string> = {
  ...CHIP,
  paid: "bg-income/10 text-income",
};

/** Lo que me pagan a mí va siempre en verde. */
const INCOMING = "bg-income/10 text-income";

/** Movimiento registrado en el mes (para el detalle de cada día). */
export type DayMovement = {
  id: string;
  kind: string;
  amount: number;
  installments: number | null;
  description: string | null;
  occurredOn: string;
  account: string;
  currency: string;
};

/**
 * Calendario del mes (lunes a domingo): pagos, cobros y días de corte de las tarjetas.
 * Al tocar un día se muestra su detalle: qué compras forman el pago de una tarjeta,
 * de qué es cada cuota y qué movimientos registraste ese día.
 */
export function PaymentsCalendar({
  month,
  today,
  items,
  markers = [],
  movements = [],
}: {
  month: YearMonth;
  today: string;
  items: AgendaItem[];
  markers?: CalendarMarker[];
  movements?: DayMovement[];
}) {
  const total = daysInMonth(month);
  const firstWeekday =
    (new Date(`${firstDayOf(month)}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + total) / 7) * 7 },
    (_, i) => {
      const day = i - firstWeekday + 1;
      return day >= 1 && day <= total ? day : null;
    },
  );
  const prefix = formatYearMonth(month);
  const dateOf = (day: number) => `${prefix}-${String(day).padStart(2, "0")}`;
  const byDay = new Map<number, AgendaItem[]>();
  for (const p of items) {
    const { day } = parseDate(p.dueOn);
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const markersByDay = new Map<number, CalendarMarker[]>();
  for (const m of markers.filter((m) => m.date.startsWith(prefix))) {
    const { day } = parseDate(m.date);
    markersByDay.set(day, [...(markersByDay.get(day) ?? []), m]);
  }
  const movesByDay = new Map<number, DayMovement[]>();
  for (const m of movements) {
    const { day } = parseDate(m.occurredOn);
    movesByDay.set(day, [...(movesByDay.get(day) ?? []), m]);
  }

  // Día elegido al abrir: hoy si es este mes; si no, el primero con pagos.
  const initial = today.startsWith(prefix)
    ? parseDate(today).day
    : items[0]
      ? parseDate(items[0].dueOn).day
      : 1;
  const [selected, setSelected] = useState({ prefix, day: initial });
  const day = selected.prefix === prefix ? selected.day : initial;

  // En el móvil el detalle queda bajo el calendario: si no se ve, lo acercamos.
  const detailRef = useRef<HTMLDivElement>(null);
  function revealDetail() {
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (!el || el.getBoundingClientRect().top < window.innerHeight - 120)
        return;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <div className="grid gap-3">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/60">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[12px] font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <ol className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d)
                return (
                  <li
                    key={i}
                    className="min-h-16 border-r border-b bg-muted/40 sm:min-h-24 [&:nth-child(7n)]:border-r-0"
                  />
                );
              const dayItems = byDay.get(d) ?? [];
              const dayMarkers = markersByDay.get(d) ?? [];
              const hasMoves = (movesByDay.get(d) ?? []).length > 0;
              const isToday = dateOf(d) === today;
              const isSelected = d === day;
              return (
                <li
                  key={i}
                  className="min-w-0 border-r border-b [&:nth-child(7n)]:border-r-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelected({ prefix, day: d });
                      revealDetail();
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Ver el ${formatDate(dateOf(d), { withYear: false })}`}
                    className={cn(
                      "block size-full min-h-16 cursor-pointer overflow-hidden p-1 text-left transition-colors duration-150 hover:bg-muted/50 sm:min-h-24 sm:p-1.5",
                      isSelected &&
                        "bg-primary/5 ring-2 ring-primary ring-inset",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-medium tabular-nums",
                          isToday
                            ? "bg-primary text-on-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {d}
                      </span>
                      <span className="flex items-center gap-0.5 pr-0.5">
                        {dayMarkers.length > 0 && (
                          <Scissors
                            className="size-3 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                        {hasMoves && (
                          <span
                            className="size-1 rounded-full bg-muted-foreground/60"
                            aria-hidden
                          />
                        )}
                      </span>
                    </span>
                    <span className="mt-1 grid gap-1">
                      {dayItems.map((p) => {
                        const incoming = p.direction === "in";
                        const tone =
                          incoming && p.status !== "paid"
                            ? INCOMING
                            : CHIP[p.status];
                        return (
                          <span
                            key={p.key}
                            className={cn(
                              "block rounded px-1 py-0.5 text-[11px] leading-tight font-medium",
                              tone,
                            )}
                          >
                            {/* Móvil: punto + monto; escritorio: nombre y monto. */}
                            <span className="flex items-center gap-1 sm:hidden">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  incoming ? "bg-income" : DOT[p.status],
                                )}
                                aria-hidden
                              />
                              <span className="truncate tabular-nums">
                                {p.status === "clear" ? "0" : compact(p.amount)}
                              </span>
                            </span>
                            <span className="hidden sm:block">
                              <span className="block truncate">{p.name}</span>
                              <span className="block truncate tabular-nums opacity-80">
                                {p.status === "clear"
                                  ? formatMoney(0, p.currency)
                                  : `${incoming ? "+" : ""}${formatMoney(p.amount, p.currency)}`}
                              </span>
                            </span>
                          </span>
                        );
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground"
          aria-label="Leyenda"
        >
          {(
            [
              ["bg-primary", "Por pagar"],
              ["bg-warning", "Vence hoy"],
              ["bg-expense", "Vencido"],
              ["bg-muted-foreground", "Pagado"],
              ["bg-income", "Te pagan"],
            ] as const
          ).map(([dot, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", dot)} aria-hidden />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <Scissors className="size-3" aria-hidden />
            Corte de tarjeta
          </li>
        </ul>
      </div>

      <div ref={detailRef} className="scroll-mt-20 lg:sticky lg:top-6">
        <DayDetail
          date={dateOf(day)}
          today={today}
          items={byDay.get(day) ?? []}
          markers={markersByDay.get(day) ?? []}
          movements={movesByDay.get(day) ?? []}
        />
      </div>
    </div>
  );
}

/** Detalle del día elegido en el calendario. */
function DayDetail({
  date,
  today,
  items,
  markers,
  movements,
}: {
  date: string;
  today: string;
  items: AgendaItem[];
  markers: CalendarMarker[];
  movements: DayMovement[];
}) {
  const empty =
    items.length === 0 && markers.length === 0 && movements.length === 0;
  return (
    <section
      aria-live="polite"
      aria-label="Detalle del día"
      className="grid content-start gap-4 rounded-xl border bg-card p-4 sm:p-5"
    >
      <h3 className="font-semibold first-letter:uppercase">
        {longDate(date)}
        {date === today && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">
            Hoy
          </span>
        )}
      </h3>

      {empty && (
        <p className="text-sm text-muted-foreground">
          Nada programado ni registrado este día.
        </p>
      )}

      {markers.map((m) => (
        <p
          key={m.label}
          className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm"
        >
          <Scissors className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{m.label}.</span> Lo que compres con
            esta tarjeta desde mañana entra en el pago del mes siguiente.
          </span>
        </p>
      ))}

      {items.length > 0 && (
        <ul className="grid gap-3">
          {items.map((item) => (
            <DayItem key={item.key} item={item} />
          ))}
        </ul>
      )}

      {movements.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-[13px] font-medium text-muted-foreground">
            Movimientos registrados
          </h4>
          <ul className="divide-y rounded-lg border">
            {movements.map((m) => {
              const positive = m.kind === "income" || m.kind === "loan_in";
              const Icon = positive ? ArrowDownLeft : ArrowUpRight;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        positive ? "text-income" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {m.description || KIND[m.kind] || "Movimiento"}
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {m.account}
                        {m.installments && m.installments > 1
                          ? ` · ${m.installments} cuotas`
                          : ""}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      positive && "text-income",
                    )}
                  >
                    {m.kind === "transfer"
                      ? formatMoney(m.amount, m.currency)
                      : formatMoney(
                          positive ? m.amount : -m.amount,
                          m.currency,
                          {
                            signed: true,
                          },
                        )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const KIND: Record<string, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  loan_in: "Préstamo recibido",
  loan_out: "Préstamo entregado",
};

function DayItem({ item }: { item: AgendaItem }) {
  const incoming = item.direction === "in";
  const Icon =
    item.kind === "card"
      ? CreditCard
      : item.kind === "loan"
        ? HandCoins
        : ReceiptText;
  return (
    <li className="grid gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            {item.kind === "loan" ? (
              <Link
                href={`/prestamos/${item.loanId}`}
                className="block truncate font-medium underline-offset-4 hover:underline"
              >
                {item.name}
              </Link>
            ) : (
              <p className="truncate font-medium">{item.name}</p>
            )}
            {item.detail && (
              <p className="text-[13px] text-muted-foreground">{item.detail}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "font-semibold tabular-nums",
              incoming && item.status !== "paid" && "text-income",
            )}
          >
            {formatMoney(
              item.status === "clear"
                ? 0
                : incoming
                  ? item.amount
                  : -item.amount,
              item.currency,
              { signed: item.status !== "clear" },
            )}
          </p>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium",
              incoming && item.status !== "paid"
                ? INCOMING
                : BADGE[item.status],
            )}
          >
            {incoming && item.status !== "paid"
              ? "Te pagan"
              : STATUS_TEXT[item.status]}
          </span>
        </div>
      </div>

      {item.kind === "card" && item.status !== "clear" && (
        <div className="ml-6 grid gap-1.5 rounded-lg bg-muted/60 p-3 text-[13px]">
          <p className="text-muted-foreground">
            Estado de cuenta del corte del{" "}
            {formatDate(item.statementDate, { withYear: false })}
            {item.estimated ? " (aún puede subir)" : ""}:
          </p>
          <ul className="grid gap-1">
            {item.previous > 0 && (
              <Line
                label="Saldo anterior sin pagar"
                amount={item.previous}
                currency={item.currency}
              />
            )}
            {item.lines.map((l, i) => (
              <Line
                key={i}
                label={l.description}
                sub={[
                  formatDate(l.occurredOn, { withYear: false }),
                  l.installment
                    ? `cuota ${l.installment} de ${l.installments}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                amount={l.amount}
                currency={item.currency}
              />
            ))}
            {item.paid > 0 && (
              <Line
                label="Ya abonaste"
                amount={-item.paid}
                currency={item.currency}
              />
            )}
          </ul>
          <p className="flex justify-between border-t pt-1.5 font-medium">
            <span>{item.status === "paid" ? "Pagado" : "Te falta pagar"}</span>
            <span className="tabular-nums">
              {formatMoney(item.amount, item.currency)}
            </span>
          </p>
        </div>
      )}
    </li>
  );
}

function Line({
  label,
  sub,
  amount,
  currency,
}: {
  label: string;
  sub?: string;
  amount: number;
  currency: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sub && (
          <span className="block text-[12px] text-muted-foreground">{sub}</span>
        )}
      </span>
      <span className="shrink-0 tabular-nums">
        {formatMoney(amount, currency)}
      </span>
    </li>
  );
}

/** "sábado, 15 de noviembre" */
function longDate(date: string) {
  const { year, month, day } = parseDate(date);
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** 83000 → "830", 120000 → "1.2k" (solo para celdas pequeñas en móvil). */
function compact(cents: number) {
  const value = cents / 100;
  return value >= 1000
    ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
    : `${Math.round(value)}`;
}
