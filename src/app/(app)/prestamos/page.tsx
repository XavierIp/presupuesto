import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  HandCoins,
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
        description="Lo que prestas y lo que te prestan, con sus cuotas y abonos."
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

      <div className="grid gap-10">
        {data.actions.length > 0 && <PendingActions data={data} />}

        <section
          aria-label="Resumen"
          className="stagger grid gap-4 sm:grid-cols-2"
        >
          <Stat
            index={0}
            icon={ArrowUpRight}
            label="Me deben"
            value={formatMoney(data.owedToMe, currency)}
            tone="income"
          />
          <Stat
            index={1}
            icon={ArrowDownLeft}
            label="Debo"
            value={formatMoney(data.iOwe, currency)}
            tone={data.iOwe > 0 ? "expense" : undefined}
          />
        </section>

        <LoanList
          title="Presté"
          empty="Aún no has prestado dinero."
          loans={data.lent}
        />
        <LoanList
          title="Me prestaron"
          empty="Nadie te ha prestado dinero."
          loans={data.borrowed}
        />
        {data.closed.length > 0 && <History loans={data.closed} />}
      </div>
    </>
  );
}

type Data = Awaited<ReturnType<typeof getLoansPage>>;

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
  title,
  empty,
  loans,
}: {
  title: string;
  empty: string;
  loans: LoanSummary[];
}) {
  return (
    <section className="grid gap-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h2>
      {loans.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
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
      <ul className="mt-4 grid gap-3 opacity-80 sm:grid-cols-2">
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} />
        ))}
      </ul>
    </details>
  );
}

function LoanCard({ loan }: { loan: LoanSummary }) {
  const ratio = loan.owed > 0 ? Math.min(loan.paid / loan.owed, 1) : 0;
  const status = LOAN_STATUS[loan.status];
  return (
    <li>
      <Link
        href={`/prestamos/${loan.id}`}
        className="grid gap-3 rounded-xl border bg-card p-5 transition-colors duration-150 hover:border-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-semibold">
              <HandCoins
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">{loan.counterpart}</span>
            </p>
            <p className="text-[13px] text-muted-foreground">
              {loan.type === "open" ? "Cuenta libre" : "Con condiciones"}
              {loan.isExternal && " · externo"}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
              status.tone,
            )}
          >
            {status.label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted-foreground">
              {loan.status === "active" || loan.status === "pending"
                ? loan.role === "lender"
                  ? "Te debe"
                  : "Debes"
                : loan.role === "lender"
                  ? "Prestaste"
                  : "Te prestó"}
            </p>
            <p className="text-[22px] font-semibold tracking-[-0.01em] tabular-nums">
              {formatMoney(
                loan.status === "pending"
                  ? loan.principal
                  : loan.status === "active"
                    ? loan.balance
                    : loan.lent || loan.principal,
                loan.currency,
              )}
            </p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </div>
        {loan.owed > 0 && (
          <div className="grid gap-1.5">
            <div className="flex justify-between text-[13px] text-muted-foreground tabular-nums">
              <span>
                Pagado {formatMoney(loan.paid, loan.currency)} de{" "}
                {formatMoney(loan.owed, loan.currency)}
              </span>
              {loan.nextDue && (
                <span className={cn(loan.overdue && "text-expense")}>
                  {loan.overdue ? "Vencido" : "Próximo"}{" "}
                  {formatDate(loan.nextDue.dueOn, { withYear: false })}
                </span>
              )}
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div
                className="progress-fill h-full rounded-full bg-income"
                style={{ "--progress": ratio } as React.CSSProperties}
              />
            </div>
          </div>
        )}
        {loan.pendingRequested > 0 && (
          <p className="text-[13px] font-medium text-warning">
            Pedido pendiente:{" "}
            {formatMoney(loan.pendingRequested, loan.currency)}
          </p>
        )}
      </Link>
    </li>
  );
}

function Stat({
  index,
  icon: Icon,
  label,
  value,
  tone,
}: {
  index: number;
  icon: typeof ArrowUpRight;
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <article
      style={{ "--i": index } as React.CSSProperties}
      className="grid gap-2 rounded-xl border bg-card p-5"
    >
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          "text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
    </article>
  );
}

function LoansSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-10"
      aria-busy="true"
      aria-label="Cargando préstamos"
    >
      <span className="h-9 w-56 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <span className="h-[92px] rounded-xl bg-muted" />
        <span className="h-[92px] rounded-xl bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <span className="h-44 rounded-xl bg-muted" />
        <span className="h-44 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
