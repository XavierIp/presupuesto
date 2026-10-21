"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(app)/actions";
import { db } from "@/lib/db";
import {
  budgets,
  categories,
  recurringPaymentRecords,
  recurringPayments,
  transactions,
} from "@/lib/db/schema";
import { ownActiveAccount } from "@/lib/data/accounts";
import {
  firstDayOf,
  occurrencesInMonth,
  parseDate,
  parseYearMonth,
  todayIn,
  totalInstallments,
} from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, isoDate, money } from "@/lib/validation";

// Cada acción vuelve a leer la sesión: nunca confía en ids de usuario que vengan del cliente.

async function ownCategory(userId: string, categoryId: string | null) {
  if (!categoryId) return null;
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        eq(categories.kind, "expense"),
      ),
    )
    .limit(1);
  return category?.id ?? null;
}

/* ───────────── Pagos programados ───────────── */

const planSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Ponle un nombre.")
      .max(60, "Máximo 60 caracteres."),
    amount: money("el monto"),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    frequency: z.enum(["monthly", "semimonthly", "yearly", "once"]),
    startDate: isoDate,
    duration: z.enum(["installments", "indefinite"]),
    installments: z.string().optional(),
  })
  .transform((data, ctx) => {
    let installments: number | null = null;
    if (data.frequency !== "once" && data.duration === "installments") {
      const n = Number(data.installments);
      if (!Number.isInteger(n) || n < 1 || n > 600) {
        ctx.addIssue({
          code: "custom",
          path: ["installments"],
          message: "Escribe un número de cuotas entre 1 y 600.",
        });
        return z.NEVER;
      }
      installments = n;
    }
    return { ...data, installments };
  });

export async function createPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = planSchema.safeParse({
    name: formData.get("name") ?? "",
    amount: formData.get("amount") ?? "",
    categoryId: formData.get("categoryId") || undefined,
    accountId: formData.get("accountId") || undefined,
    frequency: formData.get("frequency"),
    startDate: formData.get("startDate") ?? "",
    duration: formData.get("duration") ?? "indefinite",
    installments: formData.get("installments") || undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const plan = parsed.data;
  const account = await ownActiveAccount(user.id, plan.accountId);
  if (plan.accountId && (!account || account.currency !== user.currency)) {
    return {
      ok: false,
      fieldErrors: { accountId: "Elige una cuenta válida en tu moneda." },
    };
  }
  await db.insert(recurringPayments).values({
    accountId: account?.id ?? null,
    userId: user.id,
    name: plan.name,
    amount: plan.amount,
    currency: user.currency,
    categoryId: await ownCategory(user.id, plan.categoryId ?? null),
    frequency: plan.frequency,
    startDate: plan.startDate,
    dayOfMonth:
      plan.frequency === "semimonthly" ? 15 : parseDate(plan.startDate).day,
    installments: plan.frequency === "once" ? 1 : plan.installments,
  });

  refresh();
  return { ok: true };
}

export async function deletePlan(planId: string): Promise<FormState> {
  const user = await getCurrentUser();
  await db
    .delete(recurringPayments)
    .where(
      and(
        eq(recurringPayments.id, planId),
        eq(recurringPayments.userId, user.id),
      ),
    );
  refresh();
  return { ok: true };
}

/**
 * Marca como pagada la cuota del mes indicado y registra el gasto en la cuenta o tarjeta elegida.
 * Con tarjeta de crédito el gasto aumenta su deuda; con una cuenta, baja su saldo.
 */
export async function payInstallment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const planId = String(formData.get("planId") ?? "");
  const ym = parseYearMonth(String(formData.get("month") ?? ""));
  if (!ym) return { ok: false, error: "Mes no válido." };

  const [plan] = await db
    .select()
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.id, planId),
        eq(recurringPayments.userId, user.id),
      ),
    )
    .limit(1);
  if (!plan) return { ok: false, error: "No encontramos ese pago." };

  const wanted = Number(formData.get("installment"));
  const occurrence = occurrencesInMonth(plan, ym).find(
    (o) => !wanted || o.installment === wanted,
  );
  if (!occurrence) return { ok: false, error: "Ese pago no cae en este mes." };

  const account = await ownActiveAccount(
    user.id,
    String(formData.get("accountId") ?? ""),
  );
  if (!account || account.currency !== plan.currency) {
    return { ok: false, fieldErrors: { accountId: "Elige con qué pagas." } };
  }
  const accountId = account.id;

  const total = totalInstallments(plan);
  const description =
    total && total > 1
      ? `${plan.name} · cuota ${occurrence.installment} de ${total}`
      : plan.name;
  const today = todayIn();

  try {
    await db.transaction(async (tx) => {
      const [transaction] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          accountId,
          categoryId: plan.categoryId,
          kind: "expense",
          amount: plan.amount,
          description,
          occurredOn: today,
        })
        .returning({ id: transactions.id });

      await tx.insert(recurringPaymentRecords).values({
        recurringPaymentId: plan.id,
        installment: occurrence.installment,
        dueOn: occurrence.dueOn,
        paidOn: today,
        amount: plan.amount,
        transactionId: transaction.id,
      });
    });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505")
      return { ok: false, error: "Esa cuota ya estaba pagada." };
    throw error;
  }

  refresh();
  return { ok: true };
}

/** Deshace un pago: borra el registro de la cuota y el gasto que generó. */
export async function undoPayment(recordId: string): Promise<FormState> {
  const user = await getCurrentUser();
  const [record] = await db
    .select({
      id: recurringPaymentRecords.id,
      transactionId: recurringPaymentRecords.transactionId,
    })
    .from(recurringPaymentRecords)
    .innerJoin(
      recurringPayments,
      eq(recurringPayments.id, recurringPaymentRecords.recurringPaymentId),
    )
    .where(
      and(
        eq(recurringPaymentRecords.id, recordId),
        eq(recurringPayments.userId, user.id),
      ),
    )
    .limit(1);
  if (!record) return { ok: false, error: "No encontramos ese pago." };

  await db.transaction(async (tx) => {
    await tx
      .delete(recurringPaymentRecords)
      .where(eq(recurringPaymentRecords.id, record.id));
    if (record.transactionId) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, record.transactionId),
            eq(transactions.userId, user.id),
          ),
        );
    }
  });

  refresh();
  return { ok: true };
}

/* ───────────── Presupuesto por categoría ───────────── */

export async function saveBudget(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = z
    .object({
      categoryId: z.string().min(1, "Elige una categoría."),
      amount: money("el monto"),
      month: z.string(),
    })
    .safeParse({
      categoryId: formData.get("categoryId") ?? "",
      amount: formData.get("amount") ?? "",
      month: formData.get("month") ?? "",
    });
  if (!parsed.success) return fieldErrors(parsed.error);

  const ym = parseYearMonth(parsed.data.month);
  const categoryId = await ownCategory(user.id, parsed.data.categoryId);
  if (!ym || !categoryId)
    return { ok: false, fieldErrors: { categoryId: "Elige una categoría." } };

  await db
    .insert(budgets)
    .values({
      userId: user.id,
      categoryId,
      month: firstDayOf(ym),
      amount: parsed.data.amount,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.month, budgets.categoryId],
      set: { amount: parsed.data.amount },
    });

  refresh();
  return { ok: true };
}

export async function deleteBudget(budgetId: string): Promise<FormState> {
  const user = await getCurrentUser();
  await db
    .delete(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)));
  refresh();
  return { ok: true };
}
