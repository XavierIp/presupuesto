import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, PencilLine, Plus, Repeat } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { getBudgetPage, type BudgetPageData } from "@/lib/data/budget";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMonth } from "@/lib/schedule";
import { BudgetForm } from "./budget-form";
import { PlanForm } from "./plan-form";
import { DeleteButton } from "./row-actions";

export const metadata: Metadata = { title: "Presupuestos" };

export default function PresupuestosPage({
  searchParams,
}: PageProps<"/presupuestos">) {
  return (
    <Suspense fallback={<BudgetSkeleton />}>
      <BudgetView searchParams={searchParams} />
    </Suspense>
  );
}

async function BudgetView({
  searchParams,
}: Pick<PageProps<"/presupuestos">, "searchParams">) {
  const { mes } = await searchParams;
  const data = await getBudgetPage(typeof mes === "string" ? mes : undefined);
  const { currency } = data.user;
  const monthName = formatMonth(data.month);

  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">
            Presupuesto
          </h1>
          <nav aria-label="Cambiar de mes" className="flex items-center gap-1">
            <MonthLink
              href={`/presupuestos?mes=${data.prevMonth}`}
              label="Mes anterior"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </MonthLink>
            <p className="min-w-[10.5rem] text-center font-medium first-letter:uppercase">
              {monthName}
            </p>
            <MonthLink
              href={`/presupuestos?mes=${data.nextMonth}`}
              label="Mes siguiente"
            >
              <ChevronRight className="size-5" aria-hidden />
            </MonthLink>
            {!data.isCurrentMonth && (
              <Link
                href="/presupuestos"
                className="ml-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ir a hoy
              </Link>
            )}
          </nav>
        </div>
        <div className="flex flex-wrap gap-2">
          <Modal
            title="Presupuesto por categoría"
            description={`Cuánto planeas gastar en ${monthName}.`}
            trigger={{
              variant: "secondary",
              label: (
                <>
                  <PencilLine className="size-4" aria-hidden />
                  Presupuesto por categoría
                </>
              ),
            }}
          >
            <BudgetForm
              monthKey={data.monthKey}
              currency={currency}
              categories={data.expenseCategories}
            />
          </Modal>
          <Modal
            title="Nuevo pago programado"
            description="Cuotas, suscripciones, servicios o un pago único."
            trigger={{
              label: (
                <>
                  <Plus className="size-4" aria-hidden />
                  Pago programado
                </>
              ),
            }}
          >
            <PlanForm
              currency={currency}
              categories={data.expenseCategories}
              sources={data.sources}
              today={data.today}
            />
          </Modal>
        </div>
      </header>

      <Summary data={data} />
      <CategoryBudgets data={data} />
      <Plans data={data} />
    </div>
  );
}

/* ───────────── Resumen ───────────── */

function Summary({ data }: { data: BudgetPageData }) {
  const { currency } = data.user;
  const left = data.budgeted - data.budgetSpent;

  return (
    <section aria-label="Resumen" className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat index={0} label="Presupuestado" value={formatMoney(data.budgeted, currency)} />
      <Stat
        index={1}
        label="Gastado en esas categorías"
        value={formatMoney(data.budgetSpent, currency)}
        note={`Gasto total del mes: ${formatMoney(data.expense, currency)}`}
      />
      <Stat
        index={2}
        label={left < 0 ? "Te pasaste por" : "Te queda por gastar"}
        value={formatMoney(Math.abs(left), currency)}
        tone={left < 0 ? "expense" : "income"}
      />
      <Stat
        index={3}
        label={`Pagos fijos del mes · ${data.fixedCount}`}
        value={formatMoney(data.fixedThisMonth, currency)}
        note="Págalos desde Inicio"
        href="/dashboard"
      />
    </section>
  );
}

function Stat({
  index,
  label,
  value,
  note,
  tone,
  href,
}: {
  index: number;
  label: string;
  value: string;
  note?: string;
  tone?: "income" | "expense";
  href?: string;
}) {
  return (
    <article
      style={{ "--i": index } as React.CSSProperties}
      className="grid content-start gap-2 rounded-xl border bg-card p-5"
    >
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
      {note &&
        (href ? (
          <Link
            href={href}
            className="flex items-center gap-1 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
          >
            <CalendarClock className="size-3.5" aria-hidden />
            {note}
          </Link>
        ) : (
          <p className="text-[13px] text-muted-foreground">{note}</p>
        ))}
    </article>
  );
}

/* ───────────── Presupuesto por categoría ───────────── */

function CategoryBudgets({ data }: { data: BudgetPageData }) {
  const { currency } = data.user;
  return (
    <section className="grid gap-4">
      <SectionTitle icon={PencilLine} title="Presupuesto por categoría" />
      {data.budgets.length === 0 ? (
        <Empty>
          Aún no defines cuánto gastar por categoría este mes. Usa{" "}
          <strong className="font-medium text-foreground">
            Presupuesto por categoría
          </strong>
          .
        </Empty>
      ) : (
        <ul className="grid gap-4 rounded-xl border bg-card p-5">
          {data.budgets.map((b) => {
            const ratio = b.amount > 0 ? b.spent / b.amount : 0;
            const tone =
              ratio >= 1
                ? "bg-expense"
                : ratio >= 0.8
                  ? "bg-warning"
                  : "bg-primary";
            const left = b.amount - b.spent;
            return (
              <li key={b.id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.category}</p>
                    <p className="text-[13px] text-muted-foreground tabular-nums">
                      {formatMoney(b.spent, currency)} de{" "}
                      {formatMoney(b.amount, currency)} ·{" "}
                      <span className={cn(left < 0 && "text-expense")}>
                        {left < 0
                          ? `te pasaste por ${formatMoney(-left, currency)}`
                          : `quedan ${formatMoney(left, currency)}`}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Modal
                      title={`Presupuesto de ${b.category}`}
                      trigger={{
                        variant: "ghost",
                        className: "h-10 px-2.5",
                        ariaLabel: `Editar presupuesto de ${b.category}`,
                        label: <PencilLine className="size-4" aria-hidden />,
                      }}
                    >
                      <BudgetForm
                        monthKey={data.monthKey}
                        currency={currency}
                        categories={data.expenseCategories}
                        defaults={{
                          categoryId: b.categoryId,
                          amount: b.amount,
                        }}
                      />
                    </Modal>
                    <DeleteButton
                      kind="budget"
                      id={b.id}
                      name={`presupuesto de ${b.category}`}
                    />
                  </div>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`Gastado en ${b.category}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
                >
                  <div
                    className={cn("progress-fill h-full rounded-full", tone)}
                    style={
                      {
                        "--progress": Math.min(ratio, 1),
                      } as React.CSSProperties
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────────── Pagos programados ───────────── */

function Plans({ data }: { data: BudgetPageData }) {
  return (
    <section className="grid gap-4">
      <SectionTitle icon={Repeat} title="Mis pagos programados" />
      {data.plans.length === 0 ? (
        <Empty>
          Agrega tu cuota del auto, tu plan de teléfono o cualquier pago fijo con{" "}
          <strong className="font-medium text-foreground">Pago programado</strong>. Los verás en el
          calendario de Inicio.
        </Empty>
      ) : (
        <PlanList data={data} />
      )}
    </section>
  );
}

function PlanList({ data }: { data: BudgetPageData }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.plans.map((plan) => {
        const ratio = plan.totalInstallments
          ? plan.paidCount / plan.totalInstallments
          : null;
        return (
          <li
            key={plan.id}
            className="grid gap-3 rounded-xl border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{plan.name}</p>
                <p className="text-[13px] text-muted-foreground">
                  {describeFrequency(plan)}
                  {plan.category && ` · ${plan.category}`}
                </p>
              </div>
              <DeleteButton kind="plan" id={plan.id} name={plan.name} />
            </div>
            <p className="text-[22px] font-semibold tracking-[-0.01em] tabular-nums">
              {formatMoney(plan.amount, plan.currency)}
            </p>
            {ratio !== null ? (
              <div className="grid gap-1.5">
                <div className="flex justify-between text-[13px] text-muted-foreground tabular-nums">
                  <span>
                    {plan.paidCount} de {plan.totalInstallments} pagadas
                  </span>
                  {plan.lastDueDate && (
                    <span>Termina {formatDate(plan.lastDueDate)}</span>
                  )}
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <div
                    className="progress-fill h-full rounded-full bg-income"
                    style={
                      {
                        "--progress": Math.min(ratio, 1),
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Sin fecha de fin · {plan.paidCount}{" "}
                {plan.paidCount === 1 ? "pago" : "pagos"} hechos
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function describeFrequency(plan: BudgetPageData["plans"][number]) {
  if (plan.frequency === "once")
    return `Pago único el ${formatDate(plan.startDate)}`;
  if (plan.frequency === "yearly")
    return `Cada año, el ${formatDate(plan.startDate, { withYear: false })}`;
  return `Cada mes, el día ${plan.dayOfMonth}`;
}

/* ───────────── Piezas comunes ───────────── */

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

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Repeat;
  title: string;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em]">
      <Icon
        className="size-5 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="first-letter:uppercase">{title}</span>
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function BudgetSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-10"
      aria-busy="true"
      aria-label="Cargando presupuesto"
    >
      <div className="grid gap-3">
        <span className="h-8 w-48 rounded-lg bg-muted" />
        <span className="h-6 w-64 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="h-[132px] rounded-xl bg-muted" />
        ))}
      </div>
      <span className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
