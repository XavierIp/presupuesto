import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { getLoansPage, type LoanSummary } from "@/lib/data/loans";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/schedule";
import { LoanForm } from "./forms";
import { RespondRows } from "./respond-rows";
import { LOAN_STATUS } from "./labels";

export const metadata: Metadata = { title: "Préstamos" };

export default function PrestamosPage() {
  return (
    <Suspense fallback={<LoansSkeleton />}>
      <LoansView />
    </Suspense>
  );
}

async function LoansView() {
  const data = await getLoansPage();
  const { currency } = data.user;

  return (
    <>
      <PageHeader
        title="Préstamos"
        description="Quién te debe, a quién le debes y cuándo toca pagar."
        actions={
          <Modal
            title="Prestar dinero"
            description="A otro usuario por su DNI, o a alguien que no usa la app."
            trigger={{
              label: (
                <>
                  <Plus className="size-4" aria-hidden />
                  Prestar
                </>
              ),
            }}
          >
            <LoanForm
              currency={currency}
              sources={data.sources}
              today={data.today}
            />
          </Modal>
        }
      />

      <div className="grid gap-8">
        {data.actions.length > 0 && <PendingActions data={data} />}

        {/* Lo que me deben y lo que debo, lado a lado */}
        <section
          aria-label="Resumen"
          className="grid grid-cols-2 gap-3 sm:gap-4"
        >
          <Stat
            href="#me-deben"
            icon={ArrowDownLeft}
            label="Me deben"
            value={formatMoney(data.owedToMe, currency)}
            count={activeCount(data.lent)}
            tone="income"
          />
          <Stat
            href="#debo"
            icon={ArrowUpRight}
            label="Debo"
            value={formatMoney(data.iOwe, currency)}
            count={activeCount(data.borrowed)}
            tone="expense"
          />
        </section>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
          <LoanList
            id="me-deben"
            title="Me deben"
            hint="Lo que prestaste"
            empty="Nadie te debe. Toca «Prestar» para registrar un préstamo."
            loans={data.lent}
          />
          <LoanList
            id="debo"
            title="Debo"
            hint="Lo que te prestaron"
            empty="No debes nada. Cuando alguien te preste por tu DNI, aparecerá aquí."
            loans={data.borrowed}
          />
        </div>

        {data.closed.length > 0 && <History loans={data.closed} />}
      </div>
    </>
  );
}

type Data = Awaited<ReturnType<typeof getLoansPage>>;

const activeCount = (loans: LoanSummary[]) =>
  loans.filter((l) => l.status === "active").length;

function PendingActions({ data }: { data: Data }) {
  return (
    <section aria-labelledby="pendientes" className="grid gap-3">
      <h2
        id="pendientes"
        className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em]"
      >
        <Bell className="size-5 text-warning" strokeWidth={1.75} aria-hidden />
        Por responder
      </h2>
      <ul className="divide-y rounded-xl border border-warning/40 bg-card">
        {data.actions.map((loan) => (
          <RespondRows
            key={loan.id}
            loan={loan}
            sources={data.sources}
            defaultCashId={data.defaultCashId}
          />
        ))}
      </ul>
    </section>
  );
}

function LoanList({
  id,
  title,
  hint,
  empty,
  loans,
}: {
  id: string;
  title: string;
  hint: string;
  empty: string;
  loans: LoanSummary[];
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 content-start gap-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={`${id}-title`}
          className="text-[22px] font-semibold tracking-[-0.01em]"
        >
          {title}
        </h2>
        <p className="text-[13px] text-muted-foreground">{hint}</p>
      </div>
      {loans.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-3">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Préstamos cerrados, plegados para no estorbar. Cada uno se puede quitar desde su detalle. */
function History({ loans }: { loans: LoanSummary[] }) {
  return (
    <details className="group grid gap-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border bg-card px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="grid gap-0.5">
          <span className="font-semibold">Historial</span>
          <span className="text-[13px] text-muted-foreground">
            {loans.length === 1
              ? "1 préstamo cerrado"
              : `${loans.length} préstamos cerrados`}{" "}
            · ábrelo para verlos o quitarlos
          </span>
        </span>
        <ChevronRight
          className="size-5 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <ul className="mt-4 grid gap-3 opacity-80 lg:grid-cols-2">
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} />
        ))}
      </ul>
    </details>
  );
}

/** Una persona, cuánto falta y cuándo es el próximo pago. */
function LoanCard({ loan }: { loan: LoanSummary }) {
  const ratio = loan.owed > 0 ? Math.min(loan.paid / loan.owed, 1) : 0;
  const status = LOAN_STATUS[loan.status];
  const lender = loan.role === "lender";
  const open = loan.status === "active" || loan.status === "pending";
  const kind =
    loan.type === "open"
      ? "Cuenta libre"
      : loan.installments && loan.installments > 1
        ? `En ${loan.installments} cuotas`
        : "Pago único";
  const amount =
    loan.status === "pending"
      ? loan.principal
      : open
        ? loan.balance
        : loan.lent || loan.principal;

  return (
    <li>
      <Link
        href={`/prestamos/${loan.id}`}
        className="pressable grid gap-3 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/40 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                lender
                  ? "bg-income/10 text-income"
                  : "bg-expense/10 text-expense",
              )}
              aria-hidden
            >
              {initials(loan.counterpart)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{loan.counterpart}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {kind}
                {loan.isExternal && " · no usa la app"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[20px] leading-tight font-semibold tracking-[-0.01em] tabular-nums">
              {formatMoney(amount, loan.currency)}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {open
                ? lender
                  ? "te debe"
                  : "debes"
                : lender
                  ? "prestaste"
                  : "te prestó"}
            </p>
          </div>
        </div>

        {loan.status === "active" && loan.owed > 0 && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Avance del pago"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
          >
            <div
              className="progress-fill h-full rounded-full bg-income"
              style={{ "--progress": ratio } as React.CSSProperties}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-[13px]">
          {loan.status !== "active" ? (
            <span
              className={cn("rounded-full px-2 py-0.5 font-medium", status.tone)}
            >
              {status.label}
            </span>
          ) : loan.nextDue ? (
            <span
              className={cn(
                "text-muted-foreground",
                loan.overdue && "font-medium text-expense",
              )}
            >
              {loan.overdue ? "Vencido desde el" : "Próximo pago:"}{" "}
              {formatDate(loan.nextDue.dueOn, { withYear: false })} ·{" "}
              <span className="tabular-nums">
                {formatMoney(loan.nextDue.remaining, loan.currency)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Pagado {formatMoney(loan.paid, loan.currency)} de{" "}
              {formatMoney(loan.owed, loan.currency)}
            </span>
          )}
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </div>

        {loan.pendingRequested > 0 && (
          <p className="text-[13px] font-medium text-warning">
            Pedido por confirmar:{" "}
            {formatMoney(loan.pendingRequested, loan.currency)}
          </p>
        )}
      </Link>
    </li>
  );
}

/** "Denis Adeyaneira" → "DA" */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function Stat({
  href,
  icon: Icon,
  label,
  value,
  count,
  tone,
}: {
  href: string;
  icon: typeof ArrowUpRight;
  label: string;
  value: string;
  count: number;
  tone: "income" | "expense";
}) {
  return (
    <a
      href={href}
      className="pressable grid min-w-0 gap-2 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/40 sm:p-5"
    >
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        <Icon
          className={cn(
            "size-4",
            tone === "income" ? "text-income" : "text-expense",
          )}
          aria-hidden
        />
        {label}
      </p>
      <p
        className={cn(
          "truncate text-[22px] leading-none font-bold tracking-[-0.02em] tabular-nums sm:text-[28px]",
          tone === "income" ? "text-income" : "text-expense",
        )}
      >
        {value}
      </p>
      <p className="text-[12px] text-muted-foreground">
        {count === 0
          ? "Ningún préstamo activo"
          : `${count} préstamo${count === 1 ? "" : "s"} activo${count === 1 ? "" : "s"}`}
      </p>
    </a>
  );
}

function LoansSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-8"
      aria-busy="true"
      aria-label="Cargando préstamos"
    >
      <span className="h-9 w-56 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <span className="h-[92px] rounded-xl bg-muted" />
        <span className="h-[92px] rounded-xl bg-muted" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <span className="h-32 rounded-xl bg-muted" />
        <span className="h-32 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
