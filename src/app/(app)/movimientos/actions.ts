"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(app)/actions";
import { db } from "@/lib/db";
import {
  categories,
  recurringPaymentRecords,
  transactions,
} from "@/lib/db/schema";
import { ownActiveAccount } from "@/lib/data/accounts";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, isoDate, money } from "@/lib/validation";

// Cada acción vuelve a leer la sesión: nunca confía en ids de usuario que vengan del cliente.

const schema = z
  .object({
    kind: z.enum(["expense", "income", "transfer"]),
    amount: money("el monto"),
    description: z
      .string()
      .trim()
      .max(80, "Máximo 80 caracteres.")
      .transform((v) => v || null),
    categoryId: z.string().optional(),
    accountId: z.string().min(1, "Elige una cuenta."),
    toAccountId: z.string().optional(),
    occurredOn: isoDate,
    payMode: z.enum(["single", "installments"]).default("single"),
    installments: z.string().optional(),
    installmentAmount: z.string().optional(),
  })
  .transform((data, ctx) => {
    let installments: number | null = null;
    let installmentAmount: number | null = null;
    if (data.kind === "expense" && data.payMode === "installments") {
      const n = Number(data.installments);
      if (!Number.isInteger(n) || n < 2 || n > 60) {
        ctx.addIssue({
          code: "custom",
          path: ["installments"],
          message: "Escribe entre 2 y 60 cuotas.",
        });
        return z.NEVER;
      }
      installments = n;
      if (data.installmentAmount) {
        const parsed = money("el monto por cuota").safeParse(
          data.installmentAmount,
        );
        if (!parsed.success) {
          ctx.addIssue({
            code: "custom",
            path: ["installmentAmount"],
            message: parsed.error.issues[0].message,
          });
          return z.NEVER;
        }
        installmentAmount = parsed.data;
      } else {
        installmentAmount = Math.round(data.amount / n);
      }
    }
    return { ...data, installments, installmentAmount };
  });

export async function createMovement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = schema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount") ?? "",
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") || undefined,
    accountId: formData.get("accountId") ?? "",
    toAccountId: formData.get("toAccountId") || undefined,
    occurredOn: formData.get("occurredOn") ?? "",
    payMode: formData.get("payMode") || undefined,
    installments: formData.get("installments") || undefined,
    installmentAmount: formData.get("installmentAmount") || undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const data = parsed.data;

  const account = await ownActiveAccount(user.id, data.accountId);
  if (!account)
    return {
      ok: false,
      fieldErrors: { accountId: "Elige una cuenta válida." },
    };

  let toAccountId: string | null = null;
  if (data.kind === "transfer") {
    const to = await ownActiveAccount(user.id, data.toAccountId);
    if (!to)
      return {
        ok: false,
        fieldErrors: { toAccountId: "Elige la cuenta de destino." },
      };
    if (to.id === account.id) {
      return {
        ok: false,
        fieldErrors: {
          toAccountId: "Elige una cuenta distinta a la de origen.",
        },
      };
    }
    if (to.currency !== account.currency) {
      return {
        ok: false,
        fieldErrors: {
          toAccountId: "Las dos cuentas deben estar en la misma moneda.",
        },
      };
    }
    toAccountId = to.id;
  }

  if (data.installments && account.type !== "credit") {
    return {
      ok: false,
      fieldErrors: {
        accountId: "Solo las tarjetas de crédito permiten cuotas.",
      },
    };
  }

  let categoryId: string | null = null;
  if (data.kind !== "transfer" && data.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, data.categoryId),
          eq(categories.userId, user.id),
          eq(categories.kind, data.kind),
        ),
      )
      .limit(1);
    categoryId = category?.id ?? null;
  }

  await db.insert(transactions).values({
    userId: user.id,
    kind: data.kind,
    amount: data.amount,
    description:
      data.description ??
      (data.kind === "transfer" && account
        ? `Transferencia desde ${account.name}`
        : null),
    categoryId,
    accountId: account.id,
    toAccountId,
    occurredOn: data.occurredOn,
    installments: data.installments,
    installmentAmount: data.installmentAmount,
  });

  refresh();
  return { ok: true };
}

/**
 * Elimina un movimiento. Si era el pago de una cuota programada, la cuota vuelve a quedar pendiente.
 */
export async function deleteMovement(
  transactionId: string,
): Promise<FormState> {
  const user = await getCurrentUser();
  const [own] = await db
    .select({ id: transactions.id, loanId: transactions.loanId })
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, user.id)),
    )
    .limit(1);
  if (!own) return { ok: false, error: "No encontramos ese movimiento." };
  if (own.loanId) {
    return { ok: false, error: "Este movimiento es de un préstamo: gestiónalo desde Préstamos." };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(recurringPaymentRecords)
      .where(eq(recurringPaymentRecords.transactionId, own.id));
    await tx.delete(transactions).where(eq(transactions.id, own.id));
  });

  refresh();
  return { ok: true };
}
