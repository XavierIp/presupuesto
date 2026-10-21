import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Banknote,
  CreditCard,
  PencilLine,
  PiggyBank,
  Plus,
  Wallet,
} from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounts-shared";
import {
  getAccountsPage,
  type AccountsPageData,
} from "@/lib/data/accounts-page";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/schedule";
import { AccountForm } from "./account-form";
import { archiveAccount } from "./actions";
import { PayCardForm } from "./pay-card-form";

export const metadata: Metadata = { title: "Tarjetas y cuentas" };

export default function TarjetasPage() {
  return (
    <Suspense fallback={<AccountsSkeleton />}>
      <AccountsView />
    </Suspense>
  );
}

async function AccountsView() {
  const data = await getAccountsPage();
  const { currency } = data.user;

  return (
    <>
      <PageHeader
        title="Tarjetas y cuentas"
        description="De aquí sale y entra tu dinero: eliges una al pagar una cuota o la tarjeta."
        actions={
          <Modal
            title="Nueva cuenta o tarjeta"
            trigger={{
              label: (
                <>
                  <Plus className="size-4" aria-hidden />
                  Nueva cuenta
                </>
              ),
            }}
          >
            <AccountForm currency={currency} />
          </Modal>
        }
      />

      <div className="grid gap-10">
        <section
          aria-label="Resumen"
          className="stagger grid gap-4 sm:grid-cols-3"
        >
          <Stat
            index={0}
            label="Disponible en cuentas"
            value={formatMoney(data.available, currency)}
          />
          <Stat
            index={1}
            label="Deuda en tarjetas"
            value={formatMoney(data.creditDebt, currency)}
            tone={data.creditDebt > 0 ? "expense" : undefined}
            muted={!data.hasCredit}
          />
          <Stat
            index={2}
            label="Crédito disponible"
            value={formatMoney(data.creditAvailable, currency)}
            muted={!data.hasCredit}
          />
        </section>

        {data.accounts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aún no tienes cuentas. Agrega tu efectivo, tu tarjeta de débito o tu
            tarjeta de crédito con{" "}
            <strong className="font-medium text-foreground">
              Nueva cuenta
            </strong>
            .
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.accounts.map((account) => (
              <AccountItem key={account.id} account={account} data={data} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

type Account = AccountsPageData["accounts"][number];

const ICONS = {
  cash: Banknote,
  savings: PiggyBank,
  debit: Wallet,
  credit: CreditCard,
};

function AccountItem({
  account,
  data,
}: {
  account: Account;
  data: AccountsPageData;
}) {
  const isCard = account.type === "debit" || account.type === "credit";
  const isCredit = account.type === "credit";
  const Icon = ICONS[account.type];

  return (
    <li className="grid content-start gap-3 rounded-xl border bg-card p-3">
      {isCard ? (
        <div
          data-type={account.type}
          className="bank-card grid aspect-[1.7] content-between rounded-lg p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{account.name}</p>
              <p className="text-[13px] text-white/85">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </p>
            </div>
            <Icon
              className="size-6 shrink-0 text-white/85"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="grid gap-1">
            <p className="text-[13px] text-white/85">
              {isCredit ? "Deuda" : "Saldo"}
            </p>
            <p className="text-[26px] leading-none font-bold tracking-[-0.02em] tabular-nums">
              {formatMoney(
                isCredit ? account.debt : account.balance,
                account.currency,
              )}
            </p>
            <p className="mt-2 font-mono text-sm tracking-[0.2em] text-white/85">
              •••• {account.last4 ?? "····"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg bg-muted p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{account.name}</p>
              <p className="text-[13px] text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </p>
            </div>
            <Icon
              className="size-6 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <p className="text-[26px] leading-none font-bold tracking-[-0.02em] tabular-nums">
            {formatMoney(account.balance, account.currency)}
          </p>
        </div>
      )}

      {isCredit && <CreditDetails account={account} />}

      <div className="flex items-center justify-between gap-1 px-1">
        <div className="flex items-center gap-1">
          <Modal
            title={`Editar ${account.name}`}
            trigger={{
              variant: "ghost",
              className: "h-10 px-2.5",
              ariaLabel: `Editar ${account.name}`,
              label: (
                <>
                  <PencilLine className="size-4" aria-hidden />
                  Editar
                </>
              ),
            }}
          >
            <AccountForm currency={account.currency} account={account} />
          </Modal>
          {isCredit && (
            <Modal
              title={`Pagar ${account.name}`}
              description={`Deuda actual: ${formatMoney(account.debt, account.currency)}`}
              trigger={{
                variant: "ghost",
                className: "h-10 px-2.5",
                ariaLabel: `Pagar tarjeta ${account.name}`,
                label: (
                  <>
                    <Wallet className="size-4" aria-hidden />
                    Pagar tarjeta
                  </>
                ),
              }}
            >
              <PayCardForm
                cardId={account.id}
                currency={account.currency}
                debt={account.debt}
                sources={data.sources}
              />
            </Modal>
          )}
        </div>
        <ConfirmActionButton
          action={archiveAccount.bind(null, account.id)}
          label={`Archivar ${account.name}`}
          confirmLabel={`Confirmar archivar ${account.name}`}
          successMessage="Cuenta archivada"
        />
      </div>
    </li>
  );
}

function CreditDetails({ account }: { account: Account }) {
  const limit = account.creditLimit;
  const ratio = limit ? Math.min(account.debt / limit, 1) : null;
  const tone =
    ratio === null
      ? ""
      : ratio >= 0.9
        ? "bg-expense"
        : ratio >= 0.7
          ? "bg-warning"
          : "bg-primary";

  return (
    <div className="grid gap-2 px-1 text-[13px]">
      {limit !== null && ratio !== null ? (
        <>
          <div className="flex justify-between gap-2 text-muted-foreground tabular-nums">
            <span className="whitespace-nowrap">
              Usado {Math.round(ratio * 100)} %
            </span>
            <span>
              Disponible{" "}
              <span className="font-medium text-foreground">
                {formatMoney(account.availableCredit ?? 0, account.currency)}
              </span>{" "}
              de {formatMoney(limit, account.currency)}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Uso de ${account.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
          >
            <div
              className={cn("progress-fill h-full rounded-full", tone)}
              style={{ "--progress": ratio } as React.CSSProperties}
            />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Sin límite registrado.</p>
      )}
      {account.statement ? (
        <div className="grid gap-1 rounded-lg bg-muted px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-foreground">
              Pago del{" "}
              {formatDate(account.statement.dueDate, { withYear: false })}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formatMoney(
                Math.max(account.statement.billed - account.statement.paid, 0),
                account.currency,
              )}
            </span>
          </div>
          <p className="text-muted-foreground">
            {account.statement.billed <= 0
              ? "Sin consumos por pagar."
              : account.statement.paid >= account.statement.billed
                ? `Pagado (${formatMoney(account.statement.billed, account.currency)}).`
                : [
                    `Estado de cuenta ${formatMoney(account.statement.billed, account.currency)}`,
                    account.statement.paid > 0
                      ? `abonado ${formatMoney(account.statement.paid, account.currency)}`
                      : null,
                    account.statement.previous > 0
                      ? "incluye saldo anterior"
                      : null,
                    account.statement.estimated
                      ? `estimado hasta el corte del ${formatDate(account.statement.statementDate, { withYear: false })}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Agrega día de corte y de pago para ver tu pago del mes y sus cuotas en
          el calendario.
        </p>
      )}
      {account.pendingInstallments.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none font-medium text-primary [&::-webkit-details-marker]:hidden">
            Cuotas por pagar ({account.pendingInstallments.length}) ·{" "}
            {formatMoney(
              account.pendingInstallments.reduce(
                (sum, c) => sum + c.remaining,
                0,
              ),
              account.currency,
            )}
          </summary>
          <ul className="mt-2 grid gap-2">
            {account.pendingInstallments.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-foreground">
                    {c.description ?? "Compra en cuotas"}
                  </span>
                  <span className="text-muted-foreground">
                    {c.billed} de {c.total} cobradas ·{" "}
                    {formatMoney(c.each, account.currency)} c/u
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(c.remaining, account.currency)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({
  index,
  label,
  value,
  tone,
  muted,
}: {
  index: number;
  label: string;
  value: string;
  tone?: "expense";
  muted?: boolean;
}) {
  return (
    <article
      style={{ "--i": index } as React.CSSProperties}
      className="grid gap-2 rounded-xl border bg-card p-5"
    >
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums",
          tone === "expense" && "text-expense",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </article>
  );
}

function AccountsSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-10"
      aria-busy="true"
      aria-label="Cargando cuentas"
    >
      <span className="h-9 w-64 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="h-[92px] rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="h-72 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
