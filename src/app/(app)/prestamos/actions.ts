"use server";

import { and, eq, ne } from "drizzle-orm";
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

/* ───────────── Cuenta libre: pedidos y entregas ───────────── */

/** El deudor pide dinero en su cuenta libre; el prestamista lo acepta o rechaza. */
export async function requestMoney(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const loan = await loanFor(String(formData.get("loanId")), me.id, "borrower");
  if (!loan || loan.type !== "open" || loan.status !== "active") {
    return { ok: false, error: "Esta cuenta libre no está activa." };
  }
  const parsed = z
    .object({ amount: money("el monto"), note: z.string().trim().max(120) })
    .safeParse({
      amount: formData.get("amount") ?? "",
      note: formData.get("note") ?? "",
    });
  if (!parsed.success) return fieldErrors(parsed.error);

  if (loan.creditLimit) {
    const entries = await db
      .select()
      .from(loanEntries)
      .where(
        and(
          eq(loanEntries.loanId, loan.id),
          ne(loanEntries.status, "rejected"),
        ),
      );
    const used = entries.reduce((s, e) => s + e.amount, 0);
    if (used + parsed.data.amount > loan.creditLimit) {
      return {
        ok: false,
        fieldErrors: { amount: "Supera el límite de la cuenta libre." },
      };
    }
  }

  await db.insert(loanEntries).values({
    loanId: loan.id,
    amount: parsed.data.amount,
    note: parsed.data.note || null,
    requestedBy: me.id,
    status: "pending",
  });
  refresh();
  return { ok: true };
}

/** El prestamista acepta o rechaza un pedido de la cuenta libre. Al aceptar, se entrega el dinero. */
export async function respondRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const [row] = await db
    .select({ entry: loanEntries, loan: loans })
    .from(loanEntries)
    .innerJoin(loans, eq(loans.id, loanEntries.loanId))
    .where(
      and(
        eq(loanEntries.id, String(formData.get("entryId"))),
        eq(loans.lenderId, me.id),
      ),
    )
    .limit(1);
  if (!row || row.entry.status !== "pending")
    return { ok: false, error: "Ese pedido ya fue respondido." };

  if (formData.get("decision") !== "accept") {
    await db
      .update(loanEntries)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(loanEntries.id, row.entry.id));
    refresh();
    return { ok: true };
  }

  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    row.loan.currency,
  );
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };
  await disburse(row.loan, row.entry.id, row.entry.amount, account.id, me.name);
  refresh();
  return { ok: true };
}

/** El prestamista entrega dinero en la cuenta libre sin que se lo pidan. */
export async function giveMoney(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const loan = await loanFor(String(formData.get("loanId")), me.id, "lender");
  if (!loan || loan.type !== "open" || loan.status !== "active") {
    return { ok: false, error: "Esta cuenta libre no está activa." };
  }
  const parsed = z
    .object({ amount: money("el monto"), note: z.string().trim().max(120) })
    .safeParse({
      amount: formData.get("amount") ?? "",
      note: formData.get("note") ?? "",
    });
  if (!parsed.success) return fieldErrors(parsed.error);
  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    loan.currency,
  );
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };

  const [entry] = await db
    .insert(loanEntries)
    .values({
      loanId: loan.id,
      amount: parsed.data.amount,
      note: parsed.data.note || null,
      requestedBy: me.id,
      status: "pending",
    })
    .returning({ id: loanEntries.id });
  await disburse(loan, entry.id, parsed.data.amount, account.id, me.name);
  refresh();
  return { ok: true };
}

async function disburse(
  loan: typeof loans.$inferSelect,
  entryId: string,
  amount: number,
  lenderAccountId: string | null,
  lenderName: string,
) {
  const borrowerAccount =
    loan.borrowerId && loan.borrowerAccountId
      ? await ownActiveAccount(loan.borrowerId, loan.borrowerAccountId)
      : null;
  const [borrower] = loan.borrowerId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, loan.borrowerId))
    : [];

  await db.transaction(async (tx) => {
    const lenderTx = await moveMoney(tx, {
      userId: loan.lenderId,
      accountId: lenderAccountId,
      kind: "loan_out",
      amount,
      description: `Préstamo a ${borrower?.name ?? loan.borrowerName ?? "otra persona"}`,
      loanId: loan.id,
    });
    const borrowerTx = loan.borrowerId
      ? await moveMoney(tx, {
          userId: loan.borrowerId,
          accountId: borrowerAccount?.id ?? null,
          kind: "loan_in",
          amount,
          description: `Préstamo de ${lenderName}`,
          loanId: loan.id,
        })
      : null;
    await tx
      .update(loanEntries)
      .set({
        status: "accepted",
        respondedAt: new Date(),
        disbursedOn: todayIn(),
        lenderTransactionId: lenderTx,
        borrowerTransactionId: borrowerTx,
      })
      .where(eq(loanEntries.id, entryId));
  });
}

/* ───────────── Abonos ───────────── */

/**
 * Registra un abono. Si lo registra el deudor, sale de su cuenta y queda pendiente hasta que
 * el prestamista lo confirme. Si lo registra el prestamista (cobró), queda confirmado.
 */
export async function registerPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const loanId = String(formData.get("loanId"));
  const [loan] = await db
    .select()
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);
  const role =
    loan?.lenderId === me.id
      ? "lender"
      : loan?.borrowerId === me.id
        ? "borrower"
        : null;
  if (!loan || !role || loan.status !== "active")
    return { ok: false, error: "Este préstamo no está activo." };

  const parsed = z
    .object({ amount: money("el monto"), note: z.string().trim().max(120) })
    .safeParse({
      amount: formData.get("amount") ?? "",
      note: formData.get("note") ?? "",
    });
  if (!parsed.success) return fieldErrors(parsed.error);
  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    loan.currency,
  );
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };

  const [counterpart] = await db
    .select({ name: users.name })
    .from(users)
    .where(
      eq(users.id, role === "lender" ? (loan.borrowerId ?? "") : loan.lenderId),
    );
  const otherName = counterpart?.name ?? loan.borrowerName ?? "otra persona";

  await db.transaction(async (tx) => {
    const movement = await moveMoney(tx, {
      userId: me.id,
      accountId: account.id,
      kind: role === "lender" ? "loan_in" : "loan_out",
      amount: parsed.data.amount,
      description:
        role === "lender" ? `Abono de ${otherName}` : `Abono a ${otherName}`,
      loanId: loan.id,
    });
    await tx.insert(loanPayments).values({
      loanId: loan.id,
      amount: parsed.data.amount,
      paidOn: todayIn(),
      note: parsed.data.note || null,
      createdBy: me.id,
      // El deudor no puede darse por pagado solo: el prestamista confirma.
      status: role === "lender" || !loan.borrowerId ? "accepted" : "pending",
      lenderTransactionId: role === "lender" ? movement : null,
      borrowerTransactionId: role === "borrower" ? movement : null,
      respondedAt: role === "lender" ? new Date() : null,
    });
    if (role === "lender") await settleIfPaid(tx, loan.id);
  });

  refresh();
  return { ok: true };
}

/** El prestamista confirma (y recibe en su cuenta) o rechaza un abono del deudor. */
export async function respondPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  const [row] = await db
    .select({ payment: loanPayments, loan: loans })
    .from(loanPayments)
    .innerJoin(loans, eq(loans.id, loanPayments.loanId))
    .where(
      and(
        eq(loanPayments.id, String(formData.get("paymentId"))),
        eq(loans.lenderId, me.id),
      ),
    )
    .limit(1);
  if (!row || row.payment.status !== "pending")
    return { ok: false, error: "Ese abono ya fue respondido." };

  if (formData.get("decision") !== "accept") {
    await db.transaction(async (tx) => {
      await tx
        .update(loanPayments)
        .set({
          status: "rejected",
          respondedAt: new Date(),
          borrowerTransactionId: null,
        })
        .where(eq(loanPayments.id, row.payment.id));
      // Devuelve el dinero a la cuenta del deudor: su salida se anula.
      if (row.payment.borrowerTransactionId) {
        await tx
          .delete(transactions)
          .where(eq(transactions.id, row.payment.borrowerTransactionId));
      }
    });
    refresh();
    return { ok: true };
  }

  const account = await cashAccount(
    me.id,
    String(formData.get("accountId") ?? ""),
    row.loan.currency,
  );
  if ("error" in account)
    return { ok: false, fieldErrors: { accountId: account.error! } };
  const [borrower] = row.loan.borrowerId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.loan.borrowerId))
    : [];

  await db.transaction(async (tx) => {
    const lenderTx = await moveMoney(tx, {
      userId: me.id,
      accountId: account.id,
      kind: "loan_in",
      amount: row.payment.amount,
      description: `Abono de ${borrower?.name ?? "otra persona"}`,
      loanId: row.loan.id,
    });
    await tx
      .update(loanPayments)
      .set({
        status: "accepted",
        respondedAt: new Date(),
        lenderTransactionId: lenderTx,
      })
      .where(eq(loanPayments.id, row.payment.id));
    await settleIfPaid(tx, row.loan.id);
  });

  refresh();
  return { ok: true };
}
