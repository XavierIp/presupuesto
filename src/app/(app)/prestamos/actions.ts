"use server";

import { and, eq, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(app)/actions";
import { db } from "@/lib/db";
import {
  loanEntries,
  loanPayments,
  loans,
  transactions,
  user as users,
} from "@/lib/db/schema";
import { ownActiveAccount } from "@/lib/data/accounts";
import { DNI_SCHEMA } from "@/lib/dni";
import { maskName, percentToBasisPoints, totalOwed } from "@/lib/loans";
import { todayIn } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, isoDate, money } from "@/lib/validation";

// Cada acción vuelve a leer la sesión y comprueba que el usuario sea la parte correcta del préstamo.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Busca al deudor por DNI y devuelve solo su nombre enmascarado. */
export async function lookupBorrower(
  dni: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  const parsed = DNI_SCHEMA.safeParse(dni.trim());
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const [found] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.dni, parsed.data))
    .limit(1);
  if (!found) return { ok: false, error: "No hay ninguna cuenta con ese DNI." };
  if (found.id === me.id)
    return { ok: false, error: "No puedes prestarte a ti mismo." };
  return { ok: true, name: maskName(found.name) };
}

/** Inserta el movimiento de dinero de un préstamo en la cuenta de una de las partes. */
async function moveMoney(
  tx: Tx,
  {
    userId,
    accountId,
    kind,
    amount,
    description,
    loanId,
  }: {
    userId: string;
    accountId: string | null;
    kind: "loan_out" | "loan_in";
    amount: number;
    description: string;
    loanId: string;
  },
) {
  if (!accountId) return null;
  const [row] = await tx
    .insert(transactions)
    .values({
      userId,
      accountId,
      kind,
      amount,
      description,
      loanId,
      occurredOn: todayIn(),
    })
    .returning({ id: transactions.id });
  return row.id;
}

/** Cuenta propia válida para mover dinero (no tarjeta de crédito), o null si no se eligió. */
async function cashAccount(
  userId: string,
  accountId: string | null | undefined,
  currency: string,
) {
  if (!accountId) return { id: null as string | null };
  const account = await ownActiveAccount(userId, accountId);
  if (!account || account.type === "credit" || account.currency !== currency) {
    return {
      error: "Elige una cuenta (no tarjeta de crédito) en la misma moneda.",
    };
  }
  return { id: account.id as string | null };
}

async function loanFor(
  loanId: string,
  userId: string,
  role: "lender" | "borrower",
) {
  const [loan] = await db
    .select()
    .from(loans)
    .where(
      and(
        eq(loans.id, loanId),
        eq(role === "lender" ? loans.lenderId : loans.borrowerId, userId),
      ),
    )
    .limit(1);
  return loan ?? null;
}

/** Marca como pagado un préstamo con condiciones cuando se cubrió todo lo debido. */
async function settleIfPaid(tx: Tx, loanId: string) {
  const [loan] = await tx.select().from(loans).where(eq(loans.id, loanId));
  if (!loan || loan.type !== "fixed" || loan.status !== "active") return;
  const entries = await tx
    .select()
    .from(loanEntries)
    .where(
      and(eq(loanEntries.loanId, loanId), eq(loanEntries.status, "accepted")),
    );
  const payments = await tx
    .select()
    .from(loanPayments)
    .where(
      and(eq(loanPayments.loanId, loanId), eq(loanPayments.status, "accepted")),
    );
  const owed = totalOwed(
    entries.reduce((s, e) => s + e.amount, 0),
    loan.interestRate,
  );
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (owed > 0 && paid >= owed)
    await tx.update(loans).set({ status: "paid" }).where(eq(loans.id, loanId));
}

/* ───────────── Crear ───────────── */

const createSchema = z
  .object({
    type: z.enum(["fixed", "open"]),
    target: z.enum(["user", "external"]),
    dni: z.string().optional(),
    borrowerName: z.string().trim().max(60).optional(),
    amount: z.string().optional(),
    interest: z.string().optional(),
    installments: z.string().optional(),
    firstDueOn: z.string().optional(),
    payDay: z.string().optional(),
    creditLimit: z.string().optional(),
    accountId: z.string().optional(),
    note: z.string().trim().max(120).optional(),
  })
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (d.target === "user" && !DNI_SCHEMA.safeParse(d.dni ?? "").success)
      issue("dni", "El DNI debe tener 8 dígitos.");
    if (d.target === "external") {
      if (d.type === "open")
        issue("target", "La cuenta libre es solo con usuarios de la app.");
      if (!d.borrowerName)
        issue("borrowerName", "Escribe el nombre de la persona.");
    }
    const rate = d.interest ? percentToBasisPoints(d.interest) : 0;
    if (!Number.isFinite(rate) || rate < 0 || rate > 10_000)
      issue("interest", "Escribe un interés entre 0 y 100 %.");
    if (d.type === "fixed") {
      if (!money("el monto").safeParse(d.amount ?? "").success)
        issue("amount", "Escribe el monto a prestar.");
      const n = Number(d.installments);
      if (!Number.isInteger(n) || n < 1 || n > 120)
        issue("installments", "Entre 1 y 120 cuotas.");
      if (!isoDate.safeParse(d.firstDueOn ?? "").success)
        issue("firstDueOn", "Elige la fecha del primer pago.");
      if (!d.accountId)
        issue("accountId", "Elige de qué cuenta sale el dinero.");
    } else {
      const day = Number(d.payDay);
      if (!Number.isInteger(day) || day < 1 || day > 31)
        issue("payDay", "Escribe un día entre 1 y 31.");
      if (d.creditLimit && !money("el límite").safeParse(d.creditLimit).success)
        issue("creditLimit", "Límite no válido.");
    }
  });

export async function createLoan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [
      k,
      typeof v === "string" && v !== "" ? v : undefined,
    ]),
  );
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  let borrowerId: string | null = null;
  if (d.target === "user") {
    const [found] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.dni, d.dni!))
      .limit(1);
    if (!found)
      return {
        ok: false,
        fieldErrors: { dni: "No hay ninguna cuenta con ese DNI." },
      };
    if (found.id === me.id)
      return {
        ok: false,
        fieldErrors: { dni: "No puedes prestarte a ti mismo." },
      };
    borrowerId = found.id;
  }

  const account = await cashAccount(me.id, d.accountId, me.currency);
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };

  const principal = d.type === "fixed" ? money("el monto").parse(d.amount) : 0;
  const external = d.target === "external";

  await db.transaction(async (tx) => {
    const [loan] = await tx
      .insert(loans)
      .values({
        lenderId: me.id,
        borrowerId,
        borrowerName: external ? d.borrowerName : null,
        type: d.type,
        principal,
        currency: me.currency,
        // A otro usuario: queda pendiente hasta que acepte. A alguien externo: activo de inmediato.
        status: external ? "active" : "pending",
        lentOn: todayIn(),
        interestRate: d.interest ? percentToBasisPoints(d.interest) : 0,
        installments: d.type === "fixed" ? Number(d.installments) : null,
        firstDueOn: d.type === "fixed" ? d.firstDueOn : null,
        payDay: d.type === "open" ? Number(d.payDay) : null,
        creditLimit:
          d.type === "open" && d.creditLimit
            ? money("el límite").parse(d.creditLimit)
            : null,
        lenderAccountId: account.id,
        note: d.note || null,
      })
      .returning({ id: loans.id });

    if (d.type === "fixed") {
      const lenderTx = external
        ? await moveMoney(tx, {
            userId: me.id,
            accountId: account.id,
            kind: "loan_out",
            amount: principal,
            description: `Préstamo a ${d.borrowerName}`,
            loanId: loan.id,
          })
        : null;
      await tx.insert(loanEntries).values({
        loanId: loan.id,
        amount: principal,
        requestedBy: me.id,
        accountId: account.id,
        status: external ? "accepted" : "pending",
        disbursedOn: external ? todayIn() : null,
        lenderTransactionId: lenderTx,
      });
    }
  });

  refresh();
  return { ok: true };
}

/** El prestamista cancela un préstamo que la otra persona aún no aceptó. */
export async function cancelLoan(loanId: string): Promise<FormState> {
  const me = await getCurrentUser();
  const loan = await loanFor(loanId, me.id, "lender");
  if (!loan || loan.status !== "pending")
    return { ok: false, error: "Solo puedes cancelar préstamos sin aceptar." };
  await db
    .update(loans)
    .set({ status: "cancelled", respondedAt: new Date() })
    .where(eq(loans.id, loan.id));
  refresh();
  return { ok: true };
}

/* ───────────── Responder (deudor) ───────────── */

/** El deudor acepta o rechaza el préstamo (o la cuenta libre) que le ofrecieron. */
export async function respondLoan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const loan = await loanFor(String(formData.get("loanId")), me.id, "borrower");
  if (!loan || loan.status !== "pending")
    return { ok: false, error: "Este préstamo ya no está pendiente." };

  if (formData.get("decision") !== "accept") {
    await db
      .update(loans)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(loans.id, loan.id));
    await db
      .update(loanEntries)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(loanEntries.loanId, loan.id));
    refresh();
    return { ok: true };
  }

  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    loan.currency,
  );
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };
  const lenderAccount = loan.lenderAccountId
    ? await ownActiveAccount(loan.lenderId, loan.lenderAccountId)
    : null;
  const [lender] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, loan.lenderId));

  await db.transaction(async (tx) => {
    await tx
      .update(loans)
      .set({
        status: "active",
        respondedAt: new Date(),
        borrowerAccountId: account.id,
      })
      .where(eq(loans.id, loan.id));

    if (loan.type === "fixed") {
      const [entry] = await tx
        .select()
        .from(loanEntries)
        .where(
          and(
            eq(loanEntries.loanId, loan.id),
            eq(loanEntries.status, "pending"),
          ),
        );
      if (entry) {
        const lenderTx = await moveMoney(tx, {
          userId: loan.lenderId,
          accountId: lenderAccount?.id ?? null,
          kind: "loan_out",
          amount: entry.amount,
          description: `Préstamo a ${me.name}`,
          loanId: loan.id,
        });
        const borrowerTx = await moveMoney(tx, {
          userId: me.id,
          accountId: account.id,
          kind: "loan_in",
          amount: entry.amount,
          description: `Préstamo de ${lender?.name ?? "otra persona"}`,
          loanId: loan.id,
        });
        await tx
          .update(loanEntries)
          .set({
            status: "accepted",
            respondedAt: new Date(),
            disbursedOn: todayIn(),
            lenderTransactionId: lenderTx,
            borrowerTransactionId: borrowerTx,
          })
          .where(eq(loanEntries.id, entry.id));
      }
    }
  });

  refresh();
  return { ok: true };
}

/* ───────────── Entregas y pedidos (cuenta libre) ───────────── */
//
// Todo empieza "pendiente" y lo acepta la otra parte. El dinero se mueve solo al aceptar:
// - El deudor pide → el prestamista acepta y elige de qué cuenta sale.
// - El prestamista entrega → el deudor confirma y elige a qué cuenta le llega.
// Mientras está pendiente, quien lo creó puede editarlo o cancelarlo.

const amountNote = z.object({
  amount: money("el monto"),
  note: z.string().trim().max(120),
});

/**
 * Con qué presta el prestamista: efectivo, débito o ahorro (le entrega dinero) o su tarjeta de
 * crédito (compró algo para la otra persona: gasto en su tarjeta, en 1 cuota o en cuotas, y a la
 * otra persona no le entra dinero).
 */
type Funding =
  | {
      id: string | null;
      installments: number | null;
      installmentAmount: number | null;
      paidWithCard: boolean;
    }
  | { error: Record<string, string> };

async function lenderFunding(
  userId: string,
  formData: FormData,
  currency: string,
): Promise<Funding> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId)
    return {
      id: null as string | null,
      installments: null,
      installmentAmount: null,
      paidWithCard: false,
    };
  const account = await ownActiveAccount(userId, accountId);
  if (!account || account.currency !== currency) {
    return {
      error: { accountId: "Elige una cuenta o tarjeta en la misma moneda." },
    };
  }
  const paidWithCard = account.type === "credit";
  if (!paidWithCard || formData.get("payMode") !== "installments") {
    return {
      id: account.id as string | null,
      installments: null,
      installmentAmount: null,
      paidWithCard,
    };
  }
  const n = Number(formData.get("installments"));
  if (!Number.isInteger(n) || n < 2 || n > 60) {
    return { error: { installments: "Escribe entre 2 y 60 cuotas." } };
  }
  const rawEach = String(formData.get("installmentAmount") ?? "").trim();
  let each: number | null = null;
  if (rawEach) {
    const parsed = money("el monto por cuota").safeParse(rawEach);
    if (!parsed.success)
      return { error: { installmentAmount: parsed.error.issues[0].message } };
    each = parsed.data;
  }
  return {
    id: account.id as string | null,
    installments: n,
    installmentAmount: each,
    paidWithCard: true,
  };
}

/**
 * Salida de dinero del prestamista. Con tarjeta de crédito es un gasto en la tarjeta
 * (sube su deuda y sus cuotas entran en el pago de cada mes); si no, una salida de préstamo.
 */
async function lenderOut(
  tx: Tx,
  {
    loan,
    accountId,
    amount,
    installments,
    installmentAmount,
    borrowerName,
  }: {
    loan: typeof loans.$inferSelect;
    accountId: string | null;
    amount: number;
    installments: number | null;
    installmentAmount: number | null;
    borrowerName: string;
  },
) {
  if (!accountId) return null;
  const account = await ownActiveAccount(loan.lenderId, accountId);
  if (!account) return null;
  if (account.type !== "credit") {
    return moveMoney(tx, {
      userId: loan.lenderId,
      accountId: account.id,
      kind: "loan_out",
      amount,
      description: `Préstamo a ${borrowerName}`,
      loanId: loan.id,
    });
  }
  const [row] = await tx
    .insert(transactions)
    .values({
      userId: loan.lenderId,
      accountId: account.id,
      kind: "expense",
      amount,
      installments,
      installmentAmount: installments
        ? (installmentAmount ?? Math.round(amount / installments))
        : null,
      description: `Compra para ${borrowerName} (con tarjeta)`,
      loanId: loan.id,
      occurredOn: todayIn(),
    })
    .returning({ id: transactions.id });
  return row.id;
}

async function loanParty(loanId: string, userId: string) {
  const [loan] = await db
    .select()
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);
  if (!loan) return null;
  const role =
    loan.lenderId === userId
      ? "lender"
      : loan.borrowerId === userId
        ? "borrower"
        : null;
  return role ? { loan, role: role as "lender" | "borrower" } : null;
}

async function checkLimit(
  loan: typeof loans.$inferSelect,
  amount: number,
  ignoreEntryId?: string,
) {
  if (!loan.creditLimit) return null;
  const entries = await db
    .select()
    .from(loanEntries)
    .where(
      and(eq(loanEntries.loanId, loan.id), ne(loanEntries.status, "rejected")),
    );
  const used = entries
    .filter((e) => e.id !== ignoreEntryId)
    .reduce((sum, e) => sum + e.amount, 0);
  return used + amount > loan.creditLimit
    ? "Supera el límite de la cuenta libre."
    : null;
}

/** Crea (o edita, si viene `entryId`) un pedido del deudor o una entrega del prestamista. */
export async function saveEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const party = await loanParty(String(formData.get("loanId")), me.id);
  if (!party || party.loan.type !== "open" || party.loan.status !== "active") {
    return { ok: false, error: "Esta cuenta libre no está activa." };
  }
  const parsed = amountNote.safeParse({
    amount: formData.get("amount") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  let account: {
    id: string | null;
    installments: number | null;
    installmentAmount: number | null;
    paidWithCard: boolean;
  };
  if (party.role === "lender") {
    const funding = await lenderFunding(me.id, formData, party.loan.currency);
    if ("error" in funding) return { ok: false, fieldErrors: funding.error };
    account = funding;
  } else {
    const cash = await cashAccount(
      me.id,
      String(formData.get("accountId") ?? ""),
      party.loan.currency,
    );
    if ("error" in cash)
      return { ok: false, fieldErrors: { accountId: cash.error! } };
    account = {
      id: cash.id,
      installments: null,
      installmentAmount: null,
      paidWithCard: false,
    };
  }

  const entryId = String(formData.get("entryId") ?? "");
  if (entryId) {
    const [entry] = await db
      .select()
      .from(loanEntries)
      .where(eq(loanEntries.id, entryId));
    if (
      !entry ||
      entry.loanId !== party.loan.id ||
      entry.requestedBy !== me.id
    ) {
      return { ok: false, error: "No puedes editar este movimiento." };
    }
    if (entry.status !== "pending") {
      return { ok: false, error: "Ya fue aceptado: no se puede editar." };
    }
    const overLimit = await checkLimit(
      party.loan,
      parsed.data.amount,
      entry.id,
    );
    if (overLimit) return { ok: false, fieldErrors: { amount: overLimit } };
    await db
      .update(loanEntries)
      .set({
        amount: parsed.data.amount,
        note: parsed.data.note || null,
        accountId: account.id,
        installments: account.installments,
        installmentAmount: account.installmentAmount,
        paidWithCard: account.paidWithCard,
      })
      .where(eq(loanEntries.id, entry.id));
  } else {
    const overLimit = await checkLimit(party.loan, parsed.data.amount);
    if (overLimit) return { ok: false, fieldErrors: { amount: overLimit } };
    await db.insert(loanEntries).values({
      loanId: party.loan.id,
      amount: parsed.data.amount,
      note: parsed.data.note || null,
      requestedBy: me.id,
      accountId: account.id,
      installments: account.installments,
      installmentAmount: account.installmentAmount,
      paidWithCard: account.paidWithCard,
      status: "pending",
    });
  }
  refresh();
  return { ok: true };
}

/** Quien creó el pedido o la entrega lo cancela mientras sigue pendiente. */
export async function cancelEntry(entryId: string): Promise<FormState> {
  const me = await getCurrentUser();
  const [entry] = await db
    .select()
    .from(loanEntries)
    .where(eq(loanEntries.id, entryId));
  if (!entry || entry.requestedBy !== me.id)
    return { ok: false, error: "No puedes cancelarlo." };
  if (entry.status !== "pending") {
    return { ok: false, error: "Ya fue aceptado: no se puede cancelar." };
  }
  await db.delete(loanEntries).where(eq(loanEntries.id, entry.id));
  refresh();
  return { ok: true };
}

/** La otra parte acepta (y se mueve el dinero) o rechaza un pedido o una entrega. */
export async function respondEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const [entry] = await db
    .select()
    .from(loanEntries)
    .where(eq(loanEntries.id, String(formData.get("entryId"))))
    .limit(1);
  const party = entry ? await loanParty(entry.loanId, me.id) : null;
  if (!entry || !party || entry.requestedBy === me.id) {
    return { ok: false, error: "No puedes responder esto." };
  }
  if (entry.status !== "pending")
    return { ok: false, error: "Ya fue respondido." };

  if (formData.get("decision") !== "accept") {
    await db
      .update(loanEntries)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(loanEntries.id, entry.id));
    refresh();
    return { ok: true };
  }

  const { loan } = party;
  // Una cuenta la eligió quien creó la entrada; la otra, quien responde.
  let lender = {
    id: entry.accountId,
    installments: entry.installments,
    installmentAmount: entry.installmentAmount,
    paidWithCard: entry.paidWithCard,
  };
  let borrowerAccountId = entry.accountId;
  if (party.role === "lender") {
    const funding = await lenderFunding(me.id, formData, loan.currency);
    if ("error" in funding) return { ok: false, fieldErrors: funding.error };
    lender = funding;
  } else if (entry.paidWithCard) {
    // Compra con la tarjeta del prestamista: al deudor no le entra dinero, solo confirma.
    borrowerAccountId = null;
  } else {
    const cash = await cashAccount(
      me.id,
      String(formData.get("accountId") ?? ""),
      loan.currency,
    );
    if ("error" in cash)
      return { ok: false, fieldErrors: { accountId: cash.error! } };
    borrowerAccountId = cash.id;
  }
  const names = await partyNames(loan);
  const borrowerAccount = loan.borrowerId
    ? await stillOwned(loan.borrowerId, borrowerAccountId)
    : null;

  await db.transaction(async (tx) => {
    const lenderTx = await lenderOut(tx, {
      loan,
      accountId: lender.id,
      amount: entry.amount,
      installments: lender.installments,
      installmentAmount: lender.installmentAmount,
      borrowerName: names.borrower,
    });
    // Con tarjeta el prestamista compró algo: no hay dinero que entre a las cuentas del deudor.
    const borrowerTx =
      loan.borrowerId && !lender.paidWithCard
        ? await moveMoney(tx, {
            userId: loan.borrowerId,
            accountId: borrowerAccount,
            kind: "loan_in",
            amount: entry.amount,
            description: `Préstamo de ${names.lender}`,
            loanId: loan.id,
          })
        : null;
    await tx
      .update(loanEntries)
      .set({
        status: "accepted",
        respondedAt: new Date(),
        disbursedOn: todayIn(),
        accountId: lender.id,
        installments: lender.installments,
        installmentAmount: lender.installmentAmount,
        paidWithCard: lender.paidWithCard,
        lenderTransactionId: lenderTx,
        borrowerTransactionId: borrowerTx,
      })
      .where(eq(loanEntries.id, entry.id));
  });
  refresh();
  return { ok: true };
}

/* ───────────── Abonos ───────────── */
//
// Lo registra el deudor ("pagué") o el prestamista ("me pagó"); la otra parte lo confirma.
// Con una persona externa no hay quien confirme: se registra aceptado al instante.

export async function savePayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const party = await loanParty(String(formData.get("loanId")), me.id);
  if (!party || party.loan.status !== "active") {
    return { ok: false, error: "Este préstamo no está activo." };
  }
  const parsed = amountNote.safeParse({
    amount: formData.get("amount") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    party.loan.currency,
  );
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };
  const { loan } = party;

  const paymentId = String(formData.get("paymentId") ?? "");
  if (paymentId) {
    const [payment] = await db
      .select()
      .from(loanPayments)
      .where(eq(loanPayments.id, paymentId));
    if (!payment || payment.loanId !== loan.id || payment.createdBy !== me.id) {
      return { ok: false, error: "No puedes editar este abono." };
    }
    if (payment.status !== "pending") {
      return { ok: false, error: "Ya fue confirmado: no se puede editar." };
    }
    await db
      .update(loanPayments)
      .set({
        amount: parsed.data.amount,
        note: parsed.data.note || null,
        accountId: account.id,
      })
      .where(eq(loanPayments.id, payment.id));
    refresh();
    return { ok: true };
  }

  // Préstamo a alguien externo: el prestamista registra el cobro directamente.
  if (!loan.borrowerId) {
    const names = await partyNames(loan);
    await db.transaction(async (tx) => {
      const lenderTx = await moveMoney(tx, {
        userId: me.id,
        accountId: account.id,
        kind: "loan_in",
        amount: parsed.data.amount,
        description: `Abono de ${names.borrower}`,
        loanId: loan.id,
      });
      await tx.insert(loanPayments).values({
        loanId: loan.id,
        amount: parsed.data.amount,
        paidOn: todayIn(),
        note: parsed.data.note || null,
        createdBy: me.id,
        accountId: account.id,
        status: "accepted",
        lenderTransactionId: lenderTx,
        respondedAt: new Date(),
      });
      await settleIfPaid(tx, loan.id);
    });
    refresh();
    return { ok: true };
  }

  await db.insert(loanPayments).values({
    loanId: loan.id,
    amount: parsed.data.amount,
    paidOn: todayIn(),
    note: parsed.data.note || null,
    createdBy: me.id,
    accountId: account.id,
    status: "pending",
  });
  refresh();
  return { ok: true };
}

export async function cancelPayment(paymentId: string): Promise<FormState> {
  const me = await getCurrentUser();
  const [payment] = await db
    .select()
    .from(loanPayments)
    .where(eq(loanPayments.id, paymentId));
  if (!payment || payment.createdBy !== me.id)
    return { ok: false, error: "No puedes cancelarlo." };
  if (payment.status !== "pending") {
    return { ok: false, error: "Ya fue confirmado: no se puede cancelar." };
  }
  await db.delete(loanPayments).where(eq(loanPayments.id, payment.id));
  refresh();
  return { ok: true };
}

/** La otra parte confirma (y se mueve el dinero) o rechaza un abono. */
export async function respondPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const [payment] = await db
    .select()
    .from(loanPayments)
    .where(eq(loanPayments.id, String(formData.get("paymentId"))))
    .limit(1);
  const party = payment ? await loanParty(payment.loanId, me.id) : null;
  if (!payment || !party || payment.createdBy === me.id) {
    return { ok: false, error: "No puedes responder esto." };
  }
  if (payment.status !== "pending")
    return { ok: false, error: "Ya fue respondido." };

  if (formData.get("decision") !== "accept") {
    await db
      .update(loanPayments)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(loanPayments.id, payment.id));
    refresh();
    return { ok: true };
  }

  const mine = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    party.loan.currency,
  );
  if ("error" in mine)
    return { ok: false, fieldErrors: { accountId: mine.error! } };
  const { loan } = party;
  const lenderAccountId = party.role === "lender" ? mine.id : payment.accountId;
  const borrowerAccountId =
    party.role === "borrower" ? mine.id : payment.accountId;
  const names = await partyNames(loan);
  const lenderAccount = await stillOwned(loan.lenderId, lenderAccountId);
  const borrowerAccount = loan.borrowerId
    ? await stillOwned(loan.borrowerId, borrowerAccountId)
    : null;

  await db.transaction(async (tx) => {
    const lenderTx = await moveMoney(tx, {
      userId: loan.lenderId,
      accountId: lenderAccount,
      kind: "loan_in",
      amount: payment.amount,
      description: `Abono de ${names.borrower}`,
      loanId: loan.id,
    });
    const borrowerTx = loan.borrowerId
      ? await moveMoney(tx, {
          userId: loan.borrowerId,
          accountId: borrowerAccount,
          kind: "loan_out",
          amount: payment.amount,
          description: `Abono a ${names.lender}`,
          loanId: loan.id,
        })
      : null;
    await tx
      .update(loanPayments)
      .set({
        status: "accepted",
        respondedAt: new Date(),
        paidOn: todayIn(),
        lenderTransactionId: lenderTx,
        borrowerTransactionId: borrowerTx,
      })
      .where(eq(loanPayments.id, payment.id));
    await settleIfPaid(tx, loan.id);
  });
  refresh();
  return { ok: true };
}

/* ───────────── Utilidades ───────────── */

async function partyNames(loan: typeof loans.$inferSelect) {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      loan.borrowerId
        ? or(eq(users.id, loan.lenderId), eq(users.id, loan.borrowerId))
        : eq(users.id, loan.lenderId),
    );
  return {
    lender: rows.find((r) => r.id === loan.lenderId)?.name ?? "otra persona",
    borrower:
      rows.find((r) => r.id === loan.borrowerId)?.name ??
      loan.borrowerName ??
      "otra persona",
  };
}

/** La cuenta elegida al crear pudo archivarse: si ya no es válida, no se registra el movimiento. */
async function stillOwned(userId: string, accountId: string | null) {
  if (!accountId) return null;
  const account = await ownActiveAccount(userId, accountId);
  return account && account.type !== "credit" ? account.id : null;
}

/* ───────────── Cerrar ───────────── */

/**
 * El prestamista elimina (cierra) un préstamo activo. Antes responde si le pagaron todo:
 * - "paid": registra lo que faltaba como cobrado (opcionalmente en una cuenta) y lo marca pagado.
 * - "forgive": no le pagaron el resto; se cierra igual y la deuda queda saldada.
 * Lo pendiente sin responder se rechaza. El préstamo pasa al historial de ambas personas.
 */
export async function closeLoan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const loan = await loanFor(String(formData.get("loanId")), me.id, "lender");
  if (!loan || loan.status !== "active")
    return { ok: false, error: "Este préstamo no está activo." };

  const paidAll = formData.get("decision") === "paid";
  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    loan.currency,
  );
  if (paidAll && "error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };

  const [entries, payments] = await Promise.all([
    db
      .select()
      .from(loanEntries)
      .where(
        and(
          eq(loanEntries.loanId, loan.id),
          eq(loanEntries.status, "accepted"),
        ),
      ),
    db
      .select()
      .from(loanPayments)
      .where(
        and(
          eq(loanPayments.loanId, loan.id),
          eq(loanPayments.status, "accepted"),
        ),
      ),
  ]);
  const balance =
    totalOwed(
      entries.reduce((s, e) => s + e.amount, 0),
      loan.interestRate,
    ) - payments.reduce((s, p) => s + p.amount, 0);
  const names = await partyNames(loan);

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(loanEntries)
      .set({ status: "rejected", respondedAt: now })
      .where(
        and(eq(loanEntries.loanId, loan.id), eq(loanEntries.status, "pending")),
      );
    await tx
      .update(loanPayments)
      .set({ status: "rejected", respondedAt: now })
      .where(
        and(
          eq(loanPayments.loanId, loan.id),
          eq(loanPayments.status, "pending"),
        ),
      );

    if (paidAll && balance > 0) {
      const lenderTx = await moveMoney(tx, {
        userId: me.id,
        accountId: "error" in account ? null : account.id,
        kind: "loan_in",
        amount: balance,
        description: `Abono de ${names.borrower} (cierre)`,
        loanId: loan.id,
      });
      await tx.insert(loanPayments).values({
        loanId: loan.id,
        amount: balance,
        paidOn: todayIn(),
        note: "Pagó todo el monto (cierre)",
        createdBy: me.id,
        accountId: "error" in account ? null : account.id,
        status: "accepted",
        lenderTransactionId: lenderTx,
        respondedAt: now,
      });
    }
    await tx
      .update(loans)
      .set({
        status: paidAll ? "paid" : "cancelled",
        respondedAt: now,
        note: paidAll
          ? loan.note
          : [loan.note, "Cerrado sin cobrar el saldo"]
              .filter(Boolean)
              .join(" · "),
      })
      .where(eq(loans.id, loan.id));
  });

  refresh();
  return { ok: true };
}
