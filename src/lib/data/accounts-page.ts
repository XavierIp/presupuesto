import "server-only";
import { addMonths, daysInMonth, firstDayOf, parseDate, todayIn } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { accountBalances, availableBalance, toPaymentSources } from "./accounts";
import { cardStatements, type CardStatement } from "./cards";

/** Próxima fecha (hoy o después) que cae en `day` de cada mes. */
function nextDayOfMonth(today: string, day: number) {
  const t = parseDate(today);
  const thisMonth = { year: t.year, month: t.month };
  const clamp = (ym: typeof thisMonth) =>
    `${firstDayOf(ym).slice(0, 8)}${String(Math.min(day, daysInMonth(ym))).padStart(2, "0")}`;
  const candidate = clamp(thisMonth);
  return candidate >= today ? candidate : clamp(addMonths(thisMonth, 1));
}

/** El estado de cuenta "vigente": el de este mes si aún no vence o no está pagado; si no, el siguiente. */
function currentBill(thisMonth: CardStatement | undefined, nextMonth: CardStatement | undefined, today: string) {
  const bill = thisMonth?.bill;
  if (bill && (bill.dates.dueDate >= today || bill.paid < bill.billed)) return thisMonth;
  return nextMonth;
}

export async function getAccountsPage() {
  const user = await getCurrentUser();
  const today = todayIn();
  const t = parseDate(today);
  const thisMonth = { year: t.year, month: t.month };
  const [accounts, current, next] = await Promise.all([
    accountBalances(user.id),
    cardStatements(user.id, thisMonth, today),
    cardStatements(user.id, addMonths(thisMonth, 1), today),
  ]);

  const rows = accounts.map((a) => {
    if (a.type !== "credit") {
      return {
        ...a,
        debt: 0,
        availableCredit: null,
        nextStatement: null,
        statement: null,
        pendingInstallments: [] as CardStatement["pendingInstallments"],
      };
    }
    const debt = Math.max(0, -a.balance);
    const statement = currentBill(
      current.find((c) => c.id === a.id),
      next.find((c) => c.id === a.id),
      today,
    );
    return {
      ...a,
      debt,
      availableCredit: a.creditLimit !== null ? a.creditLimit - debt : null,
      nextStatement: a.statementDay ? nextDayOfMonth(today, a.statementDay) : null,
      /** Pago vigente: total del estado de cuenta, abonado y fecha límite. */
      statement: statement?.bill
        ? {
            billed: statement.bill.billed,
            paid: statement.bill.paid,
            previous: statement.bill.previous,
            dueDate: statement.bill.dates.dueDate,
            statementDate: statement.bill.dates.statementDate,
            estimated: statement.bill.dates.statementDate >= today,
          }
        : null,
      pendingInstallments: current.find((c) => c.id === a.id)?.pendingInstallments ?? [],
    };
  });

  const inCurrency = rows.filter((a) => a.currency === user.currency);
  const credit = inCurrency.filter((a) => a.type === "credit");

  return {
    user,
    today,
    accounts: rows,
    sources: toPaymentSources(accounts),
    available: availableBalance(accounts, user.currency),
    creditDebt: credit.reduce((sum, a) => sum + a.debt, 0),
    creditAvailable: credit.reduce((sum, a) => sum + (a.availableCredit ?? 0), 0),
    hasCredit: credit.length > 0,
  };
}

export type AccountsPageData = Awaited<ReturnType<typeof getAccountsPage>>;
