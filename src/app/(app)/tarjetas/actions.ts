"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(app)/actions";
import { db } from "@/lib/db";
import { financialAccounts, transactions } from "@/lib/db/schema";
import { accountBalances, ownActiveAccount } from "@/lib/data/accounts";
import { todayIn } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, money, optionalDay } from "@/lib/validation";

// Cada acción vuelve a leer la sesión: nunca confía en ids de usuario que vengan del cliente.

const accountSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Ponle un nombre.").max(40, "Máximo 40 caracteres."),
    type: z.enum(["cash", "debit", "credit", "savings"]),
    last4: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || /^\d{4}$/.test(v), "Escribe solo los últimos 4 dígitos."),
    balance: z.string(),
    creditLimit: z.string().optional(),
    statementDay: optionalDay,
    paymentDueDay: optionalDay,
  })
  .transform((data, ctx) => {
    const isCredit = data.type === "credit";
    // Crédito: se pide la deuda (≥ 0) y se guarda como saldo negativo.
    const parsedBalance = (
      isCredit ? money("la deuda actual", { allowZero: true }) : money("el saldo", { allowNegative: true })
    ).safeParse(data.balance);
    if (!parsedBalance.success) {
      ctx.addIssue({ code: "custom", path: ["balance"], message: parsedBalance.error.issues[0].message });
      return z.NEVER;
    }
    let creditLimit: number | null = null;
    if (isCredit && data.creditLimit) {
      const parsedLimit = money("el límite").safeParse(data.creditLimit);
      if (!parsedLimit.success) {
        ctx.addIssue({ code: "custom", path: ["creditLimit"], message: parsedLimit.error.issues[0].message });
        return z.NEVER;
      }
      creditLimit = parsedLimit.data;
    }
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      last4: data.type === "debit" || isCredit ? data.last4 : null,
      targetBalance: isCredit ? -parsedBalance.data : parsedBalance.data,
      creditLimit,
      statementDay: isCredit ? data.statementDay : null,
      paymentDueDay: isCredit ? data.paymentDueDay : null,
    };
  });

/** Crea o edita una cuenta. Al editar, el saldo indicado reemplaza al calculado. */
export async function saveAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = accountSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name") ?? "",
    type: formData.get("type"),
    last4: formData.get("last4") || undefined,
    balance: formData.get("balance") ?? "",
    creditLimit: formData.get("creditLimit") || undefined,
    statementDay: formData.get("statementDay") || undefined,
    paymentDueDay: formData.get("paymentDueDay") || undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, targetBalance, ...fields } = parsed.data;

  if (!id) {
    await db.insert(financialAccounts).values({
      ...fields,
      userId: user.id,
      currency: user.currency,
      openingBalance: targetBalance,
    });
  } else {
    const current = (await accountBalances(user.id)).find((a) => a.id === id);
    if (!current) return { ok: false, error: "No encontramos esa cuenta." };
    await db
      .update(financialAccounts)
      .set({
        name: fields.name,
        last4: fields.last4,
        creditLimit: fields.creditLimit,
        statementDay: fields.statementDay,
        paymentDueDay: fields.paymentDueDay,
        openingBalance: current.openingBalance + (targetBalance - current.balance),
      })
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, user.id)));
  }

  refresh();
  return { ok: true };
}

/** Archiva la cuenta: deja de aparecer y de sumar, pero su historial se conserva. */
export async function archiveAccount(accountId: string): Promise<FormState> {
  const user = await getCurrentUser();
  await db
    .update(financialAccounts)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.userId, user.id),
        isNull(financialAccounts.archivedAt),
      ),
    );
  refresh();
  return { ok: true };
}

/** Pago de tarjeta de crédito: transferencia desde una cuenta propia hacia la tarjeta. */
export async function payCreditCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = z
    .object({ cardId: z.string(), fromAccountId: z.string().min(1, "Elige de dónde pagas."), amount: money("el monto") })
    .safeParse({
      cardId: formData.get("cardId") ?? "",
      fromAccountId: formData.get("fromAccountId") ?? "",
      amount: formData.get("amount") ?? "",
    });
  if (!parsed.success) return fieldErrors(parsed.error);

  const [card, from] = await Promise.all([
    ownActiveAccount(user.id, parsed.data.cardId),
    ownActiveAccount(user.id, parsed.data.fromAccountId),
  ]);
  if (!card || card.type !== "credit") return { ok: false, error: "No encontramos esa tarjeta." };
  if (!from || from.type === "credit") {
    return { ok: false, fieldErrors: { fromAccountId: "Elige una cuenta (no una tarjeta de crédito)." } };
  }
  if (from.currency !== card.currency) {
    return { ok: false, fieldErrors: { fromAccountId: "La cuenta debe estar en la misma moneda." } };
  }

  await db.insert(transactions).values({
    userId: user.id,
    accountId: from.id,
    toAccountId: card.id,
    kind: "transfer",
    amount: parsed.data.amount,
    description: `Pago de tarjeta ${card.name}`,
    occurredOn: todayIn(),
  });

  refresh();
  return { ok: true };
}
