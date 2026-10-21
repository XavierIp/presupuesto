import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  HandCoins,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Modal } from "@/components/ui/modal";
import { getMovements, type MovementsData } from "@/lib/data/movements";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMonth } from "@/lib/schedule";
import { deleteMovement } from "./actions";
import { MovementFilters } from "./filters";
import { MovementForm } from "./movement-form";

export const metadata: Metadata = { title: "Movimientos" };

export default function MovimientosPage({
  searchParams,
}: PageProps<"/movimientos">) {
  return (
    <Suspense fallback={<MovementsSkeleton />}>
      <MovementsView searchParams={searchParams} />
    </Suspense>
  );
}

async function MovementsView({
  searchParams,
}: Pick<PageProps<"/movimientos">, "searchParams">) {
  const params = await searchParams;
  const pick = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : undefined;
  const data = await getMovements({
    mes: pick("mes"),
    tipo: pick("tipo"),
    cuenta: pick("cuenta"),
  });
  const { currency } = data.user;
  const monthName = formatMonth(data.month);
  const query = (mes: string) => {
    const q = new URLSearchParams({ mes });
    if (data.filters.kind) q.set("tipo", data.filters.kind);
    if (data.filters.accountId) q.set("cuenta", data.filters.accountId);
    return `/movimientos?${q}`;
  };

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">
            Movimientos
          </h1>
          <nav aria-label="Cambiar de mes" className="flex items-center gap-1">
            <MonthLink href={query(data.prevMonth)} label="Mes anterior">
              <ChevronLeft className="size-5" aria-hidden />
            </MonthLink>
            <p className="min-w-[10.5rem] text-center font-medium first-letter:uppercase">
              {monthName}
            </p>
            <MonthLink href={query(data.nextMonth)} label="Mes siguiente">
              <ChevronRight className="size-5" aria-hidden />
            </MonthLink>
          </nav>
        </div>
        <Modal
          title="Nuevo movimiento"
          description="Gasto, ingreso o transferencia entre tus cuentas."
          trigger={{
            label: (
              <>
                <Plus className="size-4" aria-hidden />
                Nuevo movimiento
              </>
            ),
          }}
        >
          <MovementForm
            currency={currency}
            today={data.today}
            sources={data.sources}
            incomeCategories={data.incomeCategories}
            expenseCategories={data.expenseCategories}
          />
        </Modal>
      </header>

      <section
        aria-label="Resumen"
        className="stagger grid gap-4 sm:grid-cols-3"
      >
        <Stat
          index={0}
          label="Ingresos"
          value={formatMoney(data.income, currency, { signed: true })}
          tone="income"
        />
        <Stat
          index={1}
          label="Gastos"
          value={formatMoney(-data.expense, currency, { signed: true })}
          tone="expense"
        />
        <Stat
          index={2}
          label="Balance del mes"
          value={formatMoney(data.income - data.expense, currency, {
            signed: true,
          })}
        />
      </section>

      <MovementFilters accounts={data.accounts} />

      {data.days.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {data.filters.kind || data.filters.accountId
            ? "No hay movimientos con estos filtros en este mes."
            : "Aún no hay movimientos este mes. Registra uno con Nuevo movimiento."}
        </p>
      ) : (
        <div className="grid gap-6">
          {data.days.map((day) => (
            <section
              key={day.date}
              aria-label={formatDate(day.date)}
              className="grid gap-2"
            >
              <h2 className="text-[13px] font-medium text-muted-foreground first-letter:uppercase">
                {day.date === data.today ? "Hoy · " : ""}
                {formatDate(day.date, { weekday: true })}
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {day.items.map((m) => (
                  <MovementRow key={m.id} movement={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type Movement = MovementsData["days"][number]["items"][number];

const KIND_ICON = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
  loan_out: HandCoins,
  loan_in: HandCoins,
};
const KIND_TONE = {
  income: "bg-income/10 text-income",
  expense: "bg-expense/10 text-expense",
  transfer: "bg-muted text-muted-foreground",
  loan_out: "bg-savings/10 text-savings",
  loan_in: "bg-savings/10 text-savings",
};
const KIND_LABEL = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  loan_out: "Préstamo (salida)",
  loan_in: "Préstamo (entrada)",
};
/** Signo con que el movimiento afecta a la cuenta de origen (0 = transferencia, sin signo). */
const KIND_SIGN = { income: 1, loan_in: 1, expense: -1, loan_out: -1, transfer: 0 };

function accountLabel(a: { name: string; last4: string | null }) {
  return a.last4 ? `${a.name} •••• ${a.last4}` : a.name;
}

function MovementRow({ movement: m }: { movement: Movement }) {
  const Icon = KIND_ICON[m.kind];
  const title = m.description || m.category || KIND_LABEL[m.kind];
  const sign = KIND_SIGN[m.kind];
  const where =
    m.kind === "transfer" && m.toAccount
      ? `${accountLabel(m.account)} → ${accountLabel(m.toAccount)}`
      : accountLabel(m.account);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
          KIND_TONE[m.kind],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {[m.description && m.category, where].filter(Boolean).join(" · ")}
        </p>
        {m.installments && m.installments > 1 && (
          <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">
            {m.installments} cuotas de{" "}
            {formatMoney(m.installmentAmount ?? 0, m.account.currency)}
            {m.installmentProgress?.billed != null &&
              ` · ${m.installmentProgress.billed} de ${m.installments} cobradas`}
          </p>
        )}
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          m.kind === "income" && "text-income",
          m.kind === "expense" && "text-expense",
        )}
      >
        {sign === 0
          ? formatMoney(m.amount, m.account.currency)
          : formatMoney(sign * m.amount, m.account.currency, { signed: true })}
      </p>
      {m.loanId ? (
        <Link
          href={`/prestamos/${m.loanId}`}
          aria-label={`Ver préstamo de ${title}`}
          className="pressable inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <ConfirmActionButton
          action={deleteMovement.bind(null, m.id)}
          icon="trash"
          label={`Eliminar ${title}`}
          confirmLabel={`Confirmar eliminar ${title}`}
          successMessage="Movimiento eliminado"
        />
      )}
    </li>
  );
}

function Stat({
  index,
  label,
  value,
  tone,
}: {
  index: number;
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <article
      style={{ "--i": index } as React.CSSProperties}
      className="grid gap-2 rounded-xl border bg-card p-5"
    >
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-[26px] leading-none font-bold tracking-[-0.02em] tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
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

function MovementsSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-8"
      aria-busy="true"
      aria-label="Cargando movimientos"
    >
      <span className="h-16 w-64 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="h-[92px] rounded-xl bg-muted" />
        ))}
      </div>
      <span className="h-80 rounded-xl bg-muted" />
    </div>
  );
}
