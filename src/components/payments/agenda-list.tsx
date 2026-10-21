import Link from "next/link";
import { Check, CreditCard, HandCoins } from "lucide-react";
import { PaymentForm } from "@/app/(app)/prestamos/forms";
import { PayCardForm } from "@/app/(app)/tarjetas/pay-card-form";
import { Modal } from "@/components/ui/modal";
import type { PaymentSource } from "@/lib/accounts-shared";
import type { AgendaItem, PaymentStatus } from "@/lib/data/agenda";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { daysBetween, formatDate, parseDate } from "@/lib/schedule";
import { PayForm } from "./pay-form";
import { UndoButton } from "./undo-button";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: "bg-income/10 text-income",
  overdue: "bg-expense/10 text-expense",
  today: "bg-warning/15 text-warning",
  upcoming: "bg-muted text-muted-foreground",
  clear: "bg-muted text-muted-foreground",
};

function statusLabel(item: AgendaItem, today: string) {
  if (item.status === "clear") return "Nada que pagar";
  if (item.status === "paid") {
    if (item.direction === "in") return "Cobrado";
    return item.paidOn
      ? `Pagado el ${formatDate(item.paidOn, { withYear: false })}`
      : "Pagado";
  }
  if (item.status === "today")
    return item.direction === "in" ? "Te pagan hoy" : "Vence hoy";
  const days = daysBetween(today, item.dueOn);
  if (item.status === "overdue")
    return `Vencido hace ${-days} día${days === -1 ? "" : "s"}`;
  return days === 1 ? "Mañana" : `En ${days} días`;
}

/** Lista de pagos y cobros del mes con su acción (pagar, deshacer, registrar cobro). */
export function AgendaList({
  items,
  today,
  monthKey,
  sources,
  defaultSourceId,
  cardDebt,
}: {
  items: AgendaItem[];
  today: string;
  monthKey: string;
  sources: PaymentSource[];
  defaultSourceId: string | null;
  cardDebt: Record<string, number>;
}) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((item) => {
        const { day } = parseDate(item.dueOn);
        const weekday = formatDate(item.dueOn, {
          withYear: false,
          weekday: true,
        })
          .split(" ")[0]
          .replace(",", "");
        const done = item.status === "paid" || item.status === "clear";
        const incoming = item.direction === "in";
        const Icon =
          item.kind === "card"
            ? CreditCard
            : item.kind === "loan"
              ? HandCoins
              : null;
        return (
          <li
            key={item.key}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3"
          >
            <div
              className={cn(
                "flex size-12 flex-col items-center justify-center rounded-lg leading-none",
                done
                  ? "bg-muted text-muted-foreground"
                  : incoming
                    ? "bg-income/10 text-income"
                    : "bg-primary/10 text-primary",
              )}
            >
              <span className="text-lg font-semibold tabular-nums">{day}</span>
              <span className="text-[11px] font-medium uppercase">
                {weekday}
              </span>
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  "flex items-center gap-1.5 font-medium",
                  done && "text-muted-foreground",
                )}
              >
                {Icon && (
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                {item.kind === "loan" ? (
                  <Link
                    href={`/prestamos/${item.loanId}`}
                    className="truncate underline-offset-4 hover:underline"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span className="truncate">{item.name}</span>
                )}
              </p>
              {item.detail && (
                <p className="truncate text-[13px] text-muted-foreground">
                  {item.detail}
                </p>
              )}
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  incoming && !done && "text-income",
                )}
              >
                {item.status === "clear"
                  ? formatMoney(0, item.currency)
                  : formatMoney(
                      incoming ? item.amount : -item.amount,
                      item.currency,
                      { signed: true },
                    )}
              </p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
                  incoming && !done && item.status === "upcoming"
                    ? "bg-income/10 text-income"
                    : STATUS_STYLES[item.status],
                )}
              >
                {statusLabel(item, today)}
              </span>
            </div>
            <div className="col-span-3 flex items-center justify-between gap-2 pl-[3.75rem] empty:hidden">
              {item.kind === "card" &&
              item.paid > 0 &&
              item.status !== "paid" ? (
                <p className="text-[12px] text-muted-foreground tabular-nums">
                  Abonado {formatMoney(item.paid, item.currency)} de{" "}
                  {formatMoney(item.billed, item.currency)}
                </p>
              ) : (
                <span />
              )}
              <PaymentAction
                item={item}
                monthKey={monthKey}
                sources={sources}
                defaultSourceId={defaultSourceId}
                cardDebt={cardDebt}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PaymentAction({
  item,
  monthKey,
  sources,
  defaultSourceId,
  cardDebt,
}: {
  item: AgendaItem;
  monthKey: string;
  sources: PaymentSource[];
  defaultSourceId: string | null;
  cardDebt: Record<string, number>;
}) {
  if (item.kind === "plan" && item.recordId) {
    return <UndoButton recordId={item.recordId} name={item.name} />;
  }
  if (item.status === "paid" || item.status === "clear") return null;

  const incoming = item.direction === "in";
  const trigger = {
    variant: "secondary" as const,
    className: "h-10 px-3",
    ariaLabel: `${incoming ? "Registrar cobro de" : "Pagar"} ${item.name}`,
    label: (
      <>
        <Check className="size-4" aria-hidden />
        {incoming ? "Registrar cobro" : "Pagar"}
      </>
    ),
  };

  if (item.kind === "card") {
    return (
      <Modal
        title={`Pagar ${item.name}`}
        description={`Vence el ${formatDate(item.dueOn)} · estado de cuenta ${formatMoney(item.billed, item.currency)}`}
        trigger={trigger}
      >
        <PayCardForm
          cardId={item.cardId}
          currency={item.currency}
          debt={cardDebt[item.cardId] ?? item.amount}
          defaultAmount={item.amount}
          defaultFromId={defaultSourceId}
          sources={sources}
        />
      </Modal>
    );
  }

  if (item.kind === "loan") {
    return (
      <Modal
        title={incoming ? `Cobro: ${item.name}` : `Pagar: ${item.name}`}
        description={`${item.detail ?? ""} · ${formatMoney(item.amount, item.currency)}`}
        trigger={trigger}
      >
        <PaymentForm
          loanId={item.loanId}
          role={item.role}
          currency={item.currency}
          sources={sources}
          defaultAmount={item.amount}
          defaultAccountId={item.accountId ?? defaultSourceId}
          external={item.external}
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={`Pagar ${item.name}`}
      description={`${item.detail ?? ""} · ${formatMoney(item.amount, item.currency)}`}
      trigger={trigger}
    >
      <PayForm
        planId={item.planId}
        installment={item.installment}
        monthKey={monthKey}
        currency={item.currency}
        sources={sources}
        defaultAccountId={item.accountId ?? defaultSourceId}
      />
    </Modal>
  );
}
