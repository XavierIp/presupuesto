import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  HandCoins,
  Plus,
  Send,
} from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Modal } from "@/components/ui/modal";
import { getLoanDetail } from "@/lib/data/loans";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { dateIn, formatDate } from "@/lib/schedule";
import { cancelLoan } from "../actions";
import {
  GiveMoneyForm,
  PaymentForm,
  RequestMoneyForm,
  RespondLoanForm,
  RespondPaymentForm,
  RespondRequestForm,
} from "../forms";
import { describeTerms, LOAN_STATUS } from "../labels";

export const metadata: Metadata = { title: "Préstamo" };

export default function LoanPage({ params }: PageProps<"/prestamos/[id]">) {
  return (
    <Suspense
      fallback={
        <div
          className="h-96 animate-pulse rounded-xl bg-muted"
          aria-busy="true"
        />
      }
    >
      <LoanView params={params} />
    </Suspense>
  );
}

const REQUEST_TONE = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-income/10 text-income",
  rejected: "bg-muted text-muted-foreground line-through",
};
const REQUEST_LABEL = {
  pending: "Pendiente",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

async function LoanView({
  params,
}: Pick<PageProps<"/prestamos/[id]">, "params">) {
  const { id } = await params;
  const data = await getLoanDetail(id);
  if (!data) notFound();
  const { loan, sources } = data;
  const isLender = loan.role === "lender";
  const active = loan.status === "active";
  const status = LOAN_STATUS[loan.status];
  const ratio = loan.owed > 0 ? Math.min(loan.paid / loan.owed, 1) : 0;
  const available =
    loan.creditLimit !== null
      ? Math.max(loan.creditLimit - loan.lent - loan.pendingRequested, 0)
      : null;

  // Historial: entregas y abonos mezclados por fecha.
  const history = [
    ...loan.entries.map((e) => ({
      key: `e-${e.id}`,
      kind: "entry" as const,
      date: e.disbursedOn ?? dateIn(e.createdAt),
      amount: e.amount,
      note: e.note,
      status: e.status,
      requestedByMe: e.requestedBy === data.user.id,
    })),
    ...loan.payments.map((p) => ({
      key: `p-${p.id}`,
      kind: "payment" as const,
      date: p.paidOn,
      amount: p.amount,
      note: p.note,
      status: p.status,
      requestedByMe: p.createdBy === data.user.id,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid gap-8">
      <Link
        href="/prestamos"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Préstamos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            {isLender ? "Le prestaste a" : "Te prestó"} ·{" "}
            {loan.type === "open" ? "Cuenta libre" : "Con condiciones"}
          </p>
          <h1 className="flex items-center gap-2 text-[30px] leading-tight font-semibold tracking-[-0.02em]">
            <HandCoins
              className="size-7 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            {loan.counterpart}
          </h1>
          <p className="text-sm text-muted-foreground">{describeTerms(loan)}</p>
          {loan.note && <p className="text-sm">“{loan.note}”</p>}
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[13px] font-medium",
            status.tone,
          )}
        >
          {status.label}
        </span>
      </header>

      {/* Acciones según el rol y el estado */}
      <div className="flex flex-wrap gap-2">
        {loan.myActions.acceptLoan && (
          <Modal
            title="Responder"
            description={describeTerms(loan)}
            trigger={{ label: "Aceptar o rechazar" }}
          >
            <RespondLoanForm
              loanId={loan.id}
              currency={loan.currency}
              sources={sources}
              amount={loan.principal}
              defaultAccountId={data.defaultCashId}
            />
          </Modal>
        )}
        {isLender && loan.status === "pending" && (
          <ConfirmActionButton
            action={cancelLoan.bind(null, loan.id)}
            icon="trash"
            label="Cancelar préstamo"
            confirmLabel="Confirmar cancelar préstamo"
            successMessage="Préstamo cancelado"
          />
        )}
        {active && !isLender && loan.type === "open" && (
          <Modal
            title="Pedir dinero"
            description={`A ${loan.counterpart}. Lo aceptará y se sumará a tu cuenta libre.`}
            trigger={{
              label: (
                <>
                  <Send className="size-4" aria-hidden />
                  Pedir dinero
                </>
              ),
            }}
          >
            <RequestMoneyForm
              loanId={loan.id}
              currency={loan.currency}
              available={available}
            />
          </Modal>
        )}
        {active && isLender && loan.type === "open" && (
          <Modal
            title="Entregar dinero"
            description={`Se suma a lo que te debe ${loan.counterpart}.`}
            trigger={{
              variant: "secondary",
              label: (
                <>
                  <Plus className="size-4" aria-hidden />
                  Entregar dinero
                </>
              ),
            }}
          >
            <GiveMoneyForm
              loanId={loan.id}
              currency={loan.currency}
              sources={sources}
              defaultAccountId={loan.lenderAccountId ?? data.defaultCashId}
            />
          </Modal>
        )}
        {active && loan.balance > 0 && (
          <Modal
            title={isLender ? "Registrar cobro" : "Registrar pago"}
            description={`Saldo pendiente: ${formatMoney(loan.balance, loan.currency)}`}
            trigger={{
              variant: isLender ? "secondary" : "primary",
              label: (
                <>
                  <Check className="size-4" aria-hidden />
                  {isLender ? "Registrar cobro" : "Pagar"}
                </>
              ),
            }}
          >
            <PaymentForm
              loanId={loan.id}
              role={loan.role}
              currency={loan.currency}
              sources={sources}
              defaultAmount={loan.nextDue?.remaining ?? loan.balance}
              defaultAccountId={
                (isLender ? loan.lenderAccountId : loan.borrowerAccountId) ?? data.defaultCashId
              }
            />
          </Modal>
        )}
      </div>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={loan.type === "open" ? "Total entregado" : "Prestado"}
          value={formatMoney(
            loan.status === "pending" ? loan.principal : loan.lent,
            loan.currency,
          )}
        />
        <Stat
          label={`Total a devolver${loan.interestRate ? " (con interés)" : ""}`}
          value={formatMoney(loan.owed, loan.currency)}
        />
        <Stat
          label={isLender ? "Te falta cobrar" : "Te falta pagar"}
          value={formatMoney(loan.balance, loan.currency)}
          tone={
            loan.balance > 0 ? (isLender ? "income" : "expense") : undefined
          }
        />
      </section>

      {loan.owed > 0 && (
        <div className="grid gap-1.5">
          <div className="flex justify-between text-[13px] text-muted-foreground tabular-nums">
            <span>Pagado {formatMoney(loan.paid, loan.currency)}</span>
            <span>{Math.round(ratio * 100)} %</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
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
        </div>
      )}

      {/* Pedidos y abonos pendientes de mi respuesta */}
      {(loan.myActions.acceptEntries.length > 0 ||
        loan.myActions.confirmPayments.length > 0) && (
        <section className="grid gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">
            Por responder
          </h2>
          <ul className="divide-y rounded-xl border border-warning/40 bg-card">
            {loan.myActions.acceptEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    Te pide {formatMoney(entry.amount, loan.currency)}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {entry.note ?? "Sin nota"}
                  </p>
                </div>
                <Modal
                  title={`Pedido de ${loan.counterpart}`}
                  trigger={{ className: "h-10 px-3", label: "Responder" }}
                >
                  <RespondRequestForm
                    entryId={entry.id}
                    currency={loan.currency}
                    sources={sources}
                    defaultAccountId={loan.lenderAccountId ?? data.defaultCashId}
                  />
                </Modal>
              </li>
            ))}
            {loan.myActions.confirmPayments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    Dice que te pagó{" "}
                    {formatMoney(payment.amount, loan.currency)}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    El {formatDate(payment.paidOn)}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>
                <Modal
                  title="Confirmar abono"
                  trigger={{ className: "h-10 px-3", label: "Revisar" }}
                >
                  <RespondPaymentForm
                    paymentId={payment.id}
                    currency={loan.currency}
                    sources={sources}
                    defaultAccountId={loan.lenderAccountId ?? data.defaultCashId}
                  />
                </Modal>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loan.schedule.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">
            Cronograma
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {loan.schedule.map((cuota) => {
              const overdue = !cuota.paid && cuota.dueOn < data.today;
              return (
                <li
                  key={cuota.number}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      Cuota {cuota.number} de {loan.schedule.length}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {formatDate(cuota.dueOn, { weekday: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {formatMoney(cuota.amount, loan.currency)}
                    </p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium",
                        cuota.paid
                          ? "bg-income/10 text-income"
                          : overdue
                            ? "bg-expense/10 text-expense"
                            : cuota.remaining < cuota.amount
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {cuota.paid
                        ? "Pagada"
                        : overdue
                          ? `Vencida · faltan ${formatMoney(cuota.remaining, loan.currency)}`
                          : cuota.remaining < cuota.amount
                            ? `Faltan ${formatMoney(cuota.remaining, loan.currency)}`
                            : "Pendiente"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">
          Historial
        </h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aún no hay movimientos.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((h) => {
              const isEntry = h.kind === "entry";
              const Icon = isEntry ? ArrowUpRight : ArrowDownLeft;
              const title = isEntry
                ? h.requestedByMe && !isLender
                  ? "Pediste"
                  : isLender
                    ? h.requestedByMe
                      ? "Entregaste"
                      : "Te pidió"
                    : "Te entregó"
                : h.requestedByMe
                  ? isLender
                    ? "Registraste un cobro"
                    : "Pagaste"
                  : isLender
                    ? "Te pagó"
                    : "Registró tu pago";
              return (
                <li key={h.key} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                      isEntry
                        ? "bg-savings/10 text-savings"
                        : "bg-income/10 text-income",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {formatDate(h.date)}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(h.amount, loan.currency)}
                    </p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium",
                        REQUEST_TONE[h.status],
                      )}
                    >
                      {h.status === "pending" && !isEntry
                        ? "Por confirmar"
                        : REQUEST_LABEL[h.status]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <article className="grid gap-2 rounded-xl border bg-card p-5">
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
