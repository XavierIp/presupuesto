import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  HandCoins,
  PencilLine,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Modal } from "@/components/ui/modal";
import { getLoanDetail } from "@/lib/data/loans";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { dateIn, formatDate } from "@/lib/schedule";
import { cancelEntry, cancelLoan, cancelPayment } from "../actions";
import {
  CloseLoanForm,
  DeadlineForm,
  EntryForm,
  PaymentForm,
  RespondLoanForm,
} from "../forms";
import { describeTerms, LOAN_STATUS, REQUEST_STATUS } from "../labels";
import { RespondRows } from "../respond-rows";

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

async function LoanView({
  params,
}: Pick<PageProps<"/prestamos/[id]">, "params">) {
  const { id } = await params;
  const data = await getLoanDetail(id);
  if (!data) notFound();
  const { loan, sources, defaultCashId } = data;
  const isLender = loan.role === "lender";
  const active = loan.status === "active";
  const status = LOAN_STATUS[loan.status];
  const ratio = loan.owed > 0 ? Math.min(loan.paid / loan.owed, 1) : 0;
  const myAccount =
    (isLender ? loan.lenderAccountId : loan.borrowerAccountId) ?? defaultCashId;
  const available =
    loan.creditLimit !== null
      ? Math.max(loan.creditLimit - loan.lent - loan.pendingRequested, 0)
      : null;
  const money = (cents: number) => formatMoney(cents, loan.currency);
  const hasToRespond =
    loan.myActions.respondEntries.length > 0 ||
    loan.myActions.respondPayments.length > 0;

  // Historial: entregas, pedidos y abonos, del más reciente al más antiguo.
  const history = [
    ...loan.entries.map((e) => ({
      key: `e-${e.id}`,
      id: e.id,
      kind: "entry" as const,
      date: e.disbursedOn ?? dateIn(e.createdAt),
      amount: e.amount,
      note: e.note,
      accountId: e.accountId,
      installments: e.installments,
      installmentAmount: e.installmentAmount,
      paidWithCard: e.paidWithCard,
      status: e.status,
      mine: e.requestedBy === data.user.id,
    })),
    ...loan.payments.map((p) => ({
      key: `p-${p.id}`,
      id: p.id,
      kind: "payment" as const,
      date: p.paidOn,
      amount: p.amount,
      note: p.note,
      accountId: p.accountId,
      installments: null,
      installmentAmount: null,
      paidWithCard: false,
      status: p.status,
      mine: p.createdBy === data.user.id,
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
              paidWithCard={loan.entries.some(
                (e) => e.status === "pending" && e.paidWithCard,
              )}
              currency={loan.currency}
              sources={sources}
              amount={loan.principal}
              defaultAccountId={defaultCashId}
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
        {active && loan.type === "open" && (
          <Modal
            title={isLender ? "Entregar dinero" : "Pedir dinero"}
            description={
              isLender
                ? `${loan.counterpart} confirmará que lo recibió.`
                : `${loan.counterpart} lo aceptará y se sumará a tu cuenta libre.`
            }
            trigger={{
              variant: isLender ? "secondary" : "primary",
              label: (
                <>
                  {isLender ? (
                    <Plus className="size-4" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {isLender ? "Entregar dinero" : "Pedir dinero"}
                </>
              ),
            }}
          >
            <EntryForm
              loanId={loan.id}
              role={loan.role}
              currency={loan.currency}
              sources={sources}
              defaultAccountId={myAccount}
              available={available}
            />
          </Modal>
        )}
        {active && loan.balance > 0 && (
          <Modal
            title={isLender ? "Registrar cobro" : "Registrar pago"}
            description={`Saldo pendiente: ${money(loan.balance)}`}
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
              defaultAccountId={myAccount}
              external={loan.isExternal}
            />
          </Modal>
        )}
        {isLender && active && loan.type === "open" && (
          <Modal
            title="Fecha límite"
            description="Hasta qué día debe pagarte todo lo que le prestaste."
            trigger={{
              variant: "secondary",
              label: (
                <>
                  <CalendarClock className="size-4" aria-hidden />
                  {loan.dueOn
                    ? `Hasta el ${formatDate(loan.dueOn, { withYear: false })}`
                    : "Fecha límite"}
                </>
              ),
            }}
          >
            <DeadlineForm
              loanId={loan.id}
              dueOn={loan.dueOn}
              today={data.today}
            />
          </Modal>
        )}
        {isLender && active && (
          <Modal
            title="Eliminar préstamo"
            description={`Con ${loan.counterpart}`}
            trigger={{
              variant: "ghost",
              className: "text-expense hover:bg-expense/10",
              label: (
                <>
                  <Trash2 className="size-4" aria-hidden />
                  Eliminar préstamo
                </>
              ),
            }}
          >
            <CloseLoanForm
              loanId={loan.id}
              counterpart={loan.counterpart}
              balance={loan.balance}
              currency={loan.currency}
              sources={sources}
              defaultAccountId={myAccount}
            />
          </Modal>
        )}
      </div>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={loan.type === "open" ? "Total entregado" : "Prestado"}
          value={money(loan.status === "pending" ? loan.principal : loan.lent)}
        />
        <Stat
          label={`Total a devolver${loan.interestRate ? " (con interés)" : ""}`}
          value={money(loan.owed)}
        />
        <Stat
          label={isLender ? "Te falta cobrar" : "Te falta pagar"}
          value={money(loan.balance)}
          tone={
            loan.balance > 0 ? (isLender ? "income" : "expense") : undefined
          }
          note={
            loan.pendingPaid > 0
              ? `${money(loan.pendingPaid)} en abonos por confirmar`
              : undefined
          }
        />
      </section>

      {loan.owed > 0 && (
        <div className="grid gap-1.5">
          <div className="flex justify-between text-[13px] text-muted-foreground tabular-nums">
            <span>Pagado {money(loan.paid)}</span>
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

      {hasToRespond && (
        <section className="grid gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">
            Por responder
          </h2>
          <ul className="divide-y rounded-xl border border-warning/40 bg-card">
            <RespondRows
              loan={{
                ...loan,
                myActions: { ...loan.myActions, acceptLoan: false },
              }}
              sources={sources}
              defaultCashId={defaultCashId}
            />
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
              const partial = !cuota.paid && cuota.remaining < cuota.amount;
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
                      {money(cuota.amount)}
                    </p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium",
                        cuota.paid
                          ? "bg-income/10 text-income"
                          : overdue
                            ? "bg-expense/10 text-expense"
                            : partial
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {cuota.paid
                        ? "Pagada"
                        : overdue
                          ? `Vencida · faltan ${money(cuota.remaining)}`
                          : partial
                            ? `Faltan ${money(cuota.remaining)}`
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
              const editable = h.mine && h.status === "pending" && active;
              const requestStatus = REQUEST_STATUS[h.status];
              const title = historyTitle(
                h.kind,
                isLender,
                h.mine,
                h.paidWithCard,
              );
              return (
                <li key={h.key} className="grid gap-2 px-4 py-3">
                  <div className="flex items-center gap-3">
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
                        {isLender && h.installments
                          ? ` · en ${h.installments} cuotas`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {money(h.amount)}
                      </p>
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium",
                          requestStatus.tone,
                        )}
                      >
                        {h.status === "pending"
                          ? h.mine
                            ? "Esperando respuesta"
                            : "Por responder"
                          : requestStatus.label}
                      </span>
                    </div>
                  </div>
                  {editable && (
                    <div className="flex items-center justify-end gap-1">
                      <Modal
                        title="Editar"
                        description="Sigue pendiente hasta que la otra persona lo acepte."
                        trigger={{
                          variant: "ghost",
                          className: "h-10 px-3",
                          ariaLabel: `Editar ${title.toLowerCase()} de ${money(h.amount)}`,
                          label: (
                            <>
                              <PencilLine className="size-4" aria-hidden />
                              Editar
                            </>
                          ),
                        }}
                      >
                        {isEntry ? (
                          <EntryForm
                            loanId={loan.id}
                            role={loan.role}
                            currency={loan.currency}
                            sources={sources}
                            defaultAccountId={myAccount}
                            available={available}
                            edit={h}
                          />
                        ) : (
                          <PaymentForm
                            loanId={loan.id}
                            role={loan.role}
                            currency={loan.currency}
                            sources={sources}
                            defaultAccountId={myAccount}
                            edit={h}
                          />
                        )}
                      </Modal>
                      <ConfirmActionButton
                        action={(isEntry ? cancelEntry : cancelPayment).bind(
                          null,
                          h.id,
                        )}
                        icon="trash"
                        label={`Cancelar ${title.toLowerCase()} de ${money(h.amount)}`}
                        confirmLabel={`Confirmar cancelar ${title.toLowerCase()} de ${money(h.amount)}`}
                        successMessage="Cancelado"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function historyTitle(
  kind: "entry" | "payment",
  isLender: boolean,
  mine: boolean,
  paidWithCard = false,
) {
  if (kind === "entry" && paidWithCard) {
    return isLender
      ? "Le compraste con tu tarjeta"
      : "Te compró con su tarjeta";
  }
  if (kind === "entry") {
    if (isLender) return mine ? "Entregaste" : "Te pidió";
    return mine ? "Pediste" : "Te entregó";
  }
  if (isLender) return mine ? "Registraste un cobro" : "Te pagó";
  return mine ? "Pagaste" : "Registró tu pago";
}

function Stat({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
  note?: string;
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
      {note && <p className="text-[13px] text-warning">{note}</p>}
    </article>
  );
}
