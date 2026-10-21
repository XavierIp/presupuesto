import { CreditCard, HandCoins, Scissors } from "lucide-react";
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

/** Lo que me pagan a mí va siempre en verde. */
const INCOMING = "bg-income/10 text-income";

/** Calendario del mes (lunes a domingo): pagos, cobros y días de corte de las tarjetas. */
export function PaymentsCalendar({
  month,
  today,
  items,
  markers = [],
}: {
  month: YearMonth;
  today: string;
  items: AgendaItem[];
  markers?: CalendarMarker[];
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

  return (
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
          {cells.map((day, i) => {
            const date = day
              ? `${prefix}-${String(day).padStart(2, "0")}`
              : null;
            const dayItems = day ? (byDay.get(day) ?? []) : [];
            const dayMarkers = day ? (markersByDay.get(day) ?? []) : [];
            const isToday = date === today;
            return (
              <li
                key={i}
                className={cn(
                  "min-h-20 min-w-0 overflow-hidden border-r border-b p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                  !day && "bg-muted/40",
                )}
              >
                {day && (
                  <>
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-medium tabular-nums",
                        isToday
                          ? "bg-primary text-on-primary"
                          : "text-muted-foreground",
                      )}
                      aria-label={isToday ? `Hoy, ${day}` : undefined}
                    >
                      {day}
                    </span>
                    <ul className="mt-1 grid gap-1">
                      {dayMarkers.map((m) => (
                        <li
                          key={m.label}
                          title={m.label}
                          className="flex items-center gap-1 truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]"
                        >
                          <Scissors className="size-3 shrink-0" aria-hidden />
                          <span className="hidden truncate sm:inline">
                            {m.label}
                          </span>
                        </li>
                      ))}
                      {dayItems.map((p) => {
                        const incoming = p.direction === "in";
                        const tone =
                          incoming && p.status !== "paid"
                            ? INCOMING
                            : CHIP[p.status];
                        const amount =
                          p.status === "clear"
                            ? "S/ 0"
                            : `${incoming ? "+" : ""}${formatMoney(p.amount, p.currency)}`;
                        return (
                          <li
                            key={p.key}
                            title={`${p.name} · ${p.status === "clear" ? "sin consumos" : formatMoney(p.amount, p.currency)}`}
                            className={cn(
                              "rounded px-1 py-0.5 text-[11px] leading-tight font-medium",
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
                              <span className="flex items-center gap-1 truncate">
                                {p.kind === "card" && (
                                  <CreditCard
                                    className="size-3 shrink-0"
                                    aria-hidden
                                  />
                                )}
                                {p.kind === "loan" && (
                                  <HandCoins
                                    className="size-3 shrink-0"
                                    aria-hidden
                                  />
                                )}
                                <span className="truncate">{p.name}</span>
                              </span>
                              <span className="block truncate tabular-nums opacity-80">
                                {amount}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
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
  );
}

/** 83000 → "830", 120000 → "1.2k" (solo para celdas pequeñas en móvil). */
function compact(cents: number) {
  const value = cents / 100;
  return value >= 1000
    ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
    : `${Math.round(value)}`;
}
