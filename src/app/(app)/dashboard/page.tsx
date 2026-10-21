import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Banknote,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { AgendaList } from "@/components/payments/agenda-list";
import { PaymentsCalendar } from "@/components/payments/payments-calendar";
import { buttonClasses } from "@/components/ui/button";
import { getDashboard, type DashboardData } from "@/lib/data/dashboard";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMonth } from "@/lib/schedule";

export const metadata: Metadata = { title: "Inicio" };

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({
  searchParams,
}: Pick<PageProps<"/dashboard">, "searchParams">) {
  const { mes } = await searchParams;
  const data = await getDashboard(typeof mes === "string" ? mes : undefined);
  const { currency } = data.user;
  const monthName = formatMonth(data.month);
  const firstName = data.user.name.split(" ")[0];

  return (
    <div className="grid gap-8">
      <section className="stagger grid gap-4">
        <div
          style={{ "--i": 0 } as React.CSSProperties}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div className="grid w-full gap-3">
            <p className="text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              Hola, {firstName}
            </p>
            {data.mainAccount && (
              <MainAccountCard
                account={data.mainAccount}
                total={data.cashAccounts > 1 ? data.available : null}
                count={data.cashAccounts}
                currency={currency}
              />
            )}
          </div>
        </div>

        {data.loanActions > 0 && (
          <Link
            href="/prestamos"
            style={{ "--i": 1 } as React.CSSProperties}
            className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 px-5 py-4 transition-colors duration-150 hover:bg-warning/10"
          >
            <span className="flex items-center gap-3">
              <HandCoins
                className="size-5 text-warning"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="font-medium">
                Tienes {data.loanActions}{" "}
                {data.loanActions === 1
                  ? "solicitud de préstamo"
                  : "solicitudes de préstamos"}{" "}
                por responder
              </span>
            </span>
            <ChevronRight
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          </Link>
        )}

        {!data.hasAccount && (
          <div
            style={{ "--i": 1 } as React.CSSProperties}
            className="grid justify-items-start gap-3 rounded-xl border bg-card p-6"
          >
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">
              Empieza aquí
            </h2>
            <p className="max-w-prose text-muted-foreground">
              Agrega tus cuentas y tarjetas con su saldo de hoy. Después
              registra tus pagos fijos en Presupuesto y aquí verás qué pagas
              cada día y cuánto te queda.
            </p>
            <Link href="/tarjetas" className={buttonClasses()}>
              <Wallet className="size-4" aria-hidden />
              Agregar cuentas y tarjetas
            </Link>
          </div>
        )}
      </section>

      {/* Mes: centrado, con sus ingresos y gastos */}
      <section aria-label="Resumen del mes" className="grid gap-4">
        <nav
          aria-label="Cambiar de mes"
          className="flex items-center justify-center gap-1"
        >
          <MonthLink
            href={`/dashboard?mes=${data.prevMonth}`}
            label="Mes anterior"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </MonthLink>
          <p className="min-w-[10.5rem] text-center text-[17px] font-semibold first-letter:uppercase">
            {monthName}
          </p>
          <MonthLink
            href={`/dashboard?mes=${data.nextMonth}`}
            label="Mes siguiente"
          >
            <ChevronRight className="size-5" aria-hidden />
          </MonthLink>
        </nav>
        {!data.isCurrentMonth && (
          <Link
            href="/dashboard"
            className="-mt-2 justify-self-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Volver a hoy
          </Link>
        )}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat
            icon={ArrowDownLeft}
            label="Ingresos"
            value={formatMoney(data.income, currency)}
            tone="income"
            note={
              data.toCollect > 0
                ? `+ ${formatMoney(data.toCollect, currency)} que te pagan`
                : undefined
            }
          />
          <Stat
            icon={ArrowUpRight}
            label="Gastos"
            value={formatMoney(data.expense, currency)}
            tone="expense"
          />
        </div>
      </section>

      <section aria-labelledby="agenda-title" className="grid gap-4">
        <h2
          id="agenda-title"
          className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em]"
        >
          <CalendarClock
            className="size-5 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          Mis pagos
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat
            label={`Por pagar · ${data.pendingCount}`}
            value={formatMoney(data.pending, currency)}
            note={
              data.overdueCount > 0
                ? `${data.overdueCount} vencido${data.overdueCount === 1 ? "" : "s"}`
                : data.paid > 0
                  ? `${formatMoney(data.paid, currency)} ya pagado`
                  : undefined
            }
            noteTone={data.overdueCount > 0 ? "expense" : undefined}
          />
          <Stat
            label="Te quedaría"
            value={formatMoney(data.afterPayments, currency)}
            tone={data.afterPayments < 0 ? "expense" : undefined}
            note={
              data.afterPayments < 0
                ? "No alcanza para los pagos"
                : "después de pagar todo"
            }
            noteTone={data.afterPayments < 0 ? "expense" : undefined}
          />
        </div>
        {data.agenda.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No hay pagos este mes. Agrega cuotas o servicios en{" "}
            <Link
              href="/presupuestos"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Presupuesto
            </Link>
            ; los pagos de tus tarjetas aparecen solos cuando registras compras
            con ellas (y tienen día de corte y de pago).
          </p>
        ) : (
          <AgendaList
            items={data.agenda}
            today={data.today}
            monthKey={data.monthKey}
            sources={data.sources}
            defaultSourceId={data.defaultSourceId}
            cardDebt={data.cardDebt}
          />
        )}
      </section>

      <section aria-labelledby="calendar-title" className="grid gap-4">
        <div className="grid gap-1">
          <h2
            id="calendar-title"
            className="text-[22px] font-semibold tracking-[-0.01em]"
          >
            Calendario
          </h2>
          <p className="text-sm text-muted-foreground">
            Toca un día para ver qué pagas, de qué es cada pago y qué
            registraste.
          </p>
        </div>
        <PaymentsCalendar
          month={data.month}
          today={data.today}
          items={data.agenda}
          markers={data.markers}
          movements={data.monthMovements}
        />
      </section>

      <RecentSection data={data} />
    </div>
  );
}

const ACCOUNT_LABEL = {
  cash: "Efectivo",
  debit: "Débito",
  savings: "Ahorro",
  credit: "Crédito",
};
const ACCOUNT_ICON = {
  cash: Banknote,
  debit: Wallet,
  savings: PiggyBank,
  credit: Wallet,
};

/** Cuenta principal como tarjeta, con su saldo disponible de hoy. */
function MainAccountCard({
  account,
  total,
  count,
  currency,
}: {
  account: NonNullable<DashboardData["mainAccount"]>;
  total: number | null;
  count: number;
  currency: string;
}) {
  const Icon = ACCOUNT_ICON[account.type];
  return (
    <div className="grid gap-2 sm:max-w-sm">
      <Link
        href="/tarjetas"
        data-type={account.type}
        aria-label={`${account.name}: saldo disponible hoy ${formatMoney(account.balance, account.currency)}`}
        className="bank-card pressable grid aspect-[1.7] content-between rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{account.name}</p>
            <p className="text-[13px] text-white/85">
              Cuenta principal · {ACCOUNT_LABEL[account.type]}
            </p>
          </div>
          <Icon
            className="size-6 shrink-0 text-white/85"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <div className="grid gap-1">
          <p className="text-[13px] text-white/85">Saldo disponible hoy</p>
          <p className="text-[34px] leading-none font-bold tracking-[-0.03em] tabular-nums">
            {formatMoney(account.balance, account.currency)}
          </p>
          {account.last4 && (
            <p className="mt-2 font-mono text-sm tracking-[0.2em] text-white/85">
              •••• {account.last4}
            </p>
          )}
        </div>
      </Link>
      {total !== null && (
        <p className="text-sm text-muted-foreground">
          Total en tus {count} cuentas:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </p>
      )}
    </div>
  );
}

function RecentSection({ data }: { data: DashboardData }) {
  return (
    <section className="grid content-start gap-4">
      <SectionTitle title="Últimos movimientos" href="/movimientos" />
      {data.recent.length === 0 ? (
        <EmptyCard text="Todavía no hay movimientos registrados." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.recent.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {t.description || t.category?.name || "Movimiento"}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {t.account.name} ·{" "}
                  {formatDate(t.occurredOn, { withYear: false })}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  t.kind === "income" && "text-income",
                  t.kind === "expense" && "text-expense",
                )}
              >
                {t.kind === "transfer"
                  ? formatMoney(t.amount, t.account.currency)
                  : formatMoney(
                      (t.kind === "income" || t.kind === "loan_in" ? 1 : -1) *
                        t.amount,
                      t.account.currency,
                      { signed: true },
                    )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  tone,
  noteTone,
}: {
  icon?: typeof ArrowUpRight;
  label: string;
  value: string;
  note?: string;
  tone?: "income" | "expense";
  noteTone?: "expense";
}) {
  return (
    <article className="grid min-w-0 content-start gap-2 rounded-xl border bg-card p-4 sm:p-5">
      <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-muted-foreground first-letter:uppercase">
        {Icon && (
          <Icon
            className={cn(
              "size-4 shrink-0",
              tone === "income" && "text-income",
              tone === "expense" && "text-expense",
            )}
            aria-hidden
          />
        )}
        {label}
      </p>
      <p
        className={cn(
          "truncate text-[21px] leading-none font-bold tracking-[-0.02em] tabular-nums sm:text-[26px]",
          tone === "expense" && !Icon && "text-expense",
        )}
      >
        {value}
      </p>
      {note && (
        <p
          className={cn(
            "text-[12px] sm:text-[13px]",
            noteTone === "expense" ? "text-expense" : "text-muted-foreground",
          )}
        >
          {note}
        </p>
      )}
    </article>
  );
}

function MonthLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="pressable inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h2>
      <Link
        href={href}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Ver todo
      </Link>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-10"
      aria-busy="true"
      aria-label="Cargando inicio"
    >
      <div className="grid gap-3">
        <span className="h-3 w-40 rounded bg-muted" />
        <span className="h-12 w-64 rounded-lg bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 2 }, (_, i) => (
          <span key={i} className="h-[106px] rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6">
        <span className="h-72 rounded-xl bg-muted" />
        <span className="h-72 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
