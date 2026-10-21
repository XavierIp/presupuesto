import { Modal } from "@/components/ui/modal";
import type { PaymentSource } from "@/lib/accounts-shared";
import type { LoanSummary } from "@/lib/data/loans";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/schedule";
import { RespondEntryForm, RespondLoanForm, RespondPaymentForm } from "./forms";
import { describeTerms, pendingTitle } from "./labels";

/** Filas de "Por responder" de un préstamo: lo que creó la otra persona y espera mi respuesta. */
export function RespondRows({
  loan,
  sources,
  defaultCashId,
}: {
  loan: LoanSummary;
  sources: PaymentSource[];
  defaultCashId: string | null;
}) {
  const myAccount =
    (loan.role === "lender" ? loan.lenderAccountId : loan.borrowerAccountId) ??
    defaultCashId;
  const money = (cents: number) => formatMoney(cents, loan.currency);
  const trigger = (label: string) => ({
    variant: "primary" as const,
    className: "h-10 px-3",
    label,
  });

  return (
    <>
      {loan.myActions.acceptLoan && (
        <Row
          title={
            loan.type === "open"
              ? `${loan.counterpart} te abrió una cuenta libre`
              : `${loan.counterpart} te quiere prestar ${money(loan.principal)}`
          }
          detail={describeTerms(loan)}
        >
          <Modal
            title={loan.type === "open" ? "Cuenta libre" : "Préstamo recibido"}
            description={describeTerms(loan)}
            trigger={trigger("Responder")}
          >
            <RespondLoanForm
              loanId={loan.id}
              currency={loan.currency}
              sources={sources}
              amount={loan.principal}
              defaultAccountId={defaultCashId}
            />
          </Modal>
        </Row>
      )}
      {loan.myActions.respondEntries.map((entry) => (
        <Row
          key={entry.id}
          title={pendingTitle(
            "entry",
            loan.role,
            loan.counterpart,
            money(entry.amount),
          )}
          detail={entry.note ?? "Cuenta libre"}
        >
          <Modal
            title={pendingTitle(
              "entry",
              loan.role,
              loan.counterpart,
              money(entry.amount),
            )}
            description={entry.note ?? undefined}
            trigger={trigger("Responder")}
          >
            <RespondEntryForm
              entryId={entry.id}
              amount={entry.amount}
              role={loan.role}
              currency={loan.currency}
              sources={sources}
              defaultAccountId={myAccount}
            />
          </Modal>
        </Row>
      ))}
      {loan.myActions.respondPayments.map((payment) => (
        <Row
          key={payment.id}
          title={pendingTitle(
            "payment",
            loan.role,
            loan.counterpart,
            money(payment.amount),
          )}
          detail={`El ${formatDate(payment.paidOn)}${payment.note ? ` · ${payment.note}` : ""}`}
        >
          <Modal
            title="Confirmar abono"
            description={pendingTitle(
              "payment",
              loan.role,
              loan.counterpart,
              money(payment.amount),
            )}
            trigger={trigger("Revisar")}
          >
            <RespondPaymentForm
              paymentId={payment.id}
              role={loan.role}
              currency={loan.currency}
              sources={sources}
              defaultAccountId={myAccount}
            />
          </Modal>
        </Row>
      ))}
    </>
  );
}

function Row({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-[13px] text-muted-foreground">{detail}</p>
      </div>
      {children}
    </li>
  );
}
