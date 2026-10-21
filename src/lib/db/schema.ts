// Esquema del dominio financiero.
// Todos los montos se guardan en centavos (enteros) para evitar errores de redondeo.
import { relations } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const cents = (name: string) => bigint(name, { mode: "number" });
const userRef = (name = "user_id") =>
  text(name)
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const accountType = pgEnum("account_type", ["cash", "debit", "credit", "savings"]);
export const categoryKind = pgEnum("category_kind", ["income", "expense"]);
/** `loan_out`: sale dinero por un préstamo (prestar o abonar). `loan_in`: entra (recibir o cobrar). */
export const transactionKind = pgEnum("transaction_kind", [
  "income",
  "expense",
  "transfer",
  "loan_out",
  "loan_in",
]);
export const loanStatus = pgEnum("loan_status", [
  "pending",
  "active",
  "paid",
  "cancelled",
  "rejected",
]);
/** `fixed`: préstamo con condiciones (monto, interés, cuotas). `open`: cuenta libre (pide y se suma). */
export const loanType = pgEnum("loan_type", ["fixed", "open"]);
/** Estado de solicitudes y abonos que la otra persona debe aceptar. */
export const requestStatus = pgEnum("request_status", ["pending", "accepted", "rejected"]);
export const groupRole = pgEnum("group_role", ["owner", "member"]);
export const paymentFrequency = pgEnum("payment_frequency", ["monthly", "yearly", "once"]);

/** Cuentas de dinero: efectivo, débito, crédito o ahorro. */
export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: id(),
    userId: userRef(),
    name: text("name").notNull(),
    type: accountType("type").notNull(),
    currency: text("currency").notNull(),
    /** Saldo inicial al registrar la cuenta. El saldo actual se deriva de los movimientos. */
    openingBalance: cents("opening_balance").notNull().default(0),
    /** Solo tarjetas: últimos 4 dígitos (nunca el número completo). */
    last4: text("last4"),
    /** Solo crédito. */
    creditLimit: cents("credit_limit"),
    statementDay: integer("statement_day"),
    paymentDueDay: integer("payment_due_day"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("financial_accounts_user_idx").on(t.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: userRef(),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    icon: text("icon").notNull().default("circle"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_user_name_kind_idx").on(t.userId, t.name, t.kind)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: userRef(),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    /** Solo transferencias: cuenta destino (p. ej. pago de tarjeta de crédito). */
    toAccountId: text("to_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    kind: transactionKind("kind").notNull(),
    /** Siempre positivo; el signo lo da `kind`. */
    amount: cents("amount").notNull(),
    /**
     * Compras con tarjeta de crédito en cuotas: el gasto completo sube la deuda al comprar,
     * y cada mes se factura una cuota de `installmentAmount` (puede incluir intereses).
     */
    installments: integer("installments"),
    installmentAmount: cents("installment_amount"),
    /** Movimiento generado por un préstamo (desembolso o abono). */
    loanId: text("loan_id").references(() => loans.id, { onDelete: "set null" }),
    description: text("description"),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.occurredOn),
    index("transactions_account_idx").on(t.accountId),
  ],
);

/** Presupuesto mensual por categoría. `month` es siempre el día 1 del mes. */
export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: userRef(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    month: date("month", { mode: "string" }).notNull(),
    amount: cents("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("budgets_user_month_category_idx").on(t.userId, t.month, t.categoryId)],
);

/**
 * Pagos programados: cuotas (auto 830 × 36 meses), suscripciones sin fin (plan de teléfono)
 * o pagos únicos. Cada ocurrencia se calcula a partir de `startDate` y `dayOfMonth`.
 */
export const recurringPayments = pgTable(
  "recurring_payments",
  {
    id: id(),
    userId: userRef(),
    name: text("name").notNull(),
    amount: cents("amount").notNull(),
    currency: text("currency").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    /** Cuenta de donde sale el pago. Si es nula se usa la cuenta principal. */
    accountId: text("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
    frequency: paymentFrequency("frequency").notNull(),
    /** Fecha del primer pago. */
    startDate: date("start_date", { mode: "string" }).notNull(),
    /** Día de pago (1–31). Si el mes es más corto se usa su último día. */
    dayOfMonth: integer("day_of_month").notNull(),
    /** Número total de cuotas; nulo = sin fecha de fin. */
    installments: integer("installments"),
    createdAt: createdAt(),
  },
  (t) => [index("recurring_payments_user_idx").on(t.userId)],
);

/** Registro de cada cuota pagada; enlaza con el gasto que generó. */
export const recurringPaymentRecords = pgTable(
  "recurring_payment_records",
  {
    id: id(),
    recurringPaymentId: text("recurring_payment_id")
      .notNull()
      .references(() => recurringPayments.id, { onDelete: "cascade" }),
    installment: integer("installment").notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    amount: cents("amount").notNull(),
    transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("recurring_payment_records_installment_idx").on(
      t.recurringPaymentId,
      t.installment,
    ),
  ],
);

/**
 * Préstamos que hago a otras personas.
 * Si el deudor tiene cuenta en la app se enlaza con `borrowerId` y debe aceptar (pending → active);
 * si no, se guarda solo su nombre en `borrowerName`.
 */
export const loans = pgTable(
  "loans",
  {
    id: id(),
    lenderId: userRef("lender_id"),
    borrowerId: text("borrower_id").references(() => user.id, { onDelete: "set null" }),
    borrowerName: text("borrower_name"),
    type: loanType("type").notNull().default("fixed"),
    /** Préstamo con condiciones: monto prestado. Cuenta libre: 0 (se suma con `loan_entries`). */
    principal: cents("principal").notNull(),
    currency: text("currency").notNull(),
    status: loanStatus("status").notNull().default("pending"),
    lentOn: date("lent_on", { mode: "string" }).notNull(),
    dueOn: date("due_on", { mode: "string" }),
    /** Interés total en puntos básicos (500 = 5 %), sobre el monto prestado. */
    interestRate: integer("interest_rate").notNull().default(0),
    /** Préstamo con condiciones: número de cuotas mensuales y fecha de la primera. */
    installments: integer("installments"),
    firstDueOn: date("first_due_on", { mode: "string" }),
    /** Cuenta libre: día del mes en que el deudor paga, y límite opcional. */
    payDay: integer("pay_day"),
    creditLimit: cents("credit_limit"),
    /** Cuentas por defecto de cada lado (de dónde sale / a dónde llega el dinero). */
    lenderAccountId: text("lender_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    borrowerAccountId: text("borrower_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("loans_lender_idx").on(t.lenderId),
    index("loans_borrower_idx").on(t.borrowerId),
  ],
);

export const loanPayments = pgTable(
  "loan_payments",
  {
    id: id(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    amount: cents("amount").notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    /** Abono registrado por el deudor: queda `pending` hasta que el prestamista lo confirma. */
    status: requestStatus("status").notNull().default("accepted"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    lenderTransactionId: text("lender_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    borrowerTransactionId: text("borrower_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("loan_payments_loan_idx").on(t.loanId)],
);

/**
 * Desembolsos de un préstamo. En el préstamo con condiciones hay uno (el monto, que el deudor acepta);
 * en la cuenta libre, cada pedido del deudor es una entrada que el prestamista acepta o rechaza.
 */
export const loanEntries = pgTable(
  "loan_entries",
  {
    id: id(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    amount: cents("amount").notNull(),
    note: text("note"),
    status: requestStatus("status").notNull().default("pending"),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    disbursedOn: date("disbursed_on", { mode: "string" }),
    lenderTransactionId: text("lender_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    borrowerTransactionId: text("borrower_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("loan_entries_loan_idx").on(t.loanId)],
);

export const savingsGroups = pgTable("savings_groups", {
  id: id(),
  name: text("name").notNull(),
  createdBy: userRef("created_by"),
  /** Código para invitar a otros usuarios al grupo. */
  inviteCode: text("invite_code")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID().slice(0, 8)),
  createdAt: createdAt(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => savingsGroups.id, { onDelete: "cascade" }),
    userId: userRef(),
    role: groupRole("role").notNull().default("member"),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

/** Meta de ahorro individual (`groupId` nulo) o de grupo. */
export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: id(),
    ownerId: userRef("owner_id"),
    groupId: text("group_id").references(() => savingsGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    target: cents("target").notNull(),
    currency: text("currency").notNull(),
    deadline: date("deadline", { mode: "string" }),
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("savings_goals_owner_idx").on(t.ownerId), index("savings_goals_group_idx").on(t.groupId)],
);

export const savingsContributions = pgTable(
  "savings_contributions",
  {
    id: id(),
    goalId: text("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    userId: userRef(),
    /** Positivo = aporte, negativo = retiro. */
    amount: cents("amount").notNull(),
    contributedOn: date("contributed_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("savings_contributions_goal_idx").on(t.goalId)],
);

export const financialAccountsRelations = relations(financialAccounts, ({ many }) => ({
  transactions: many(transactions, { relationName: "account" }),
  incomingTransfers: many(transactions, { relationName: "toAccount" }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(financialAccounts, {
    fields: [transactions.accountId],
    references: [financialAccounts.id],
    relationName: "account",
  }),
  toAccount: one(financialAccounts, {
    fields: [transactions.toAccountId],
    references: [financialAccounts.id],
    relationName: "toAccount",
  }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const recurringPaymentsRelations = relations(recurringPayments, ({ many, one }) => ({
  records: many(recurringPaymentRecords),
  category: one(categories, {
    fields: [recurringPayments.categoryId],
    references: [categories.id],
  }),
}));

export const recurringPaymentRecordsRelations = relations(recurringPaymentRecords, ({ one }) => ({
  payment: one(recurringPayments, {
    fields: [recurringPaymentRecords.recurringPaymentId],
    references: [recurringPayments.id],
  }),
}));

export const loanEntriesRelations = relations(loanEntries, ({ one }) => ({
  loan: one(loans, { fields: [loanEntries.loanId], references: [loans.id] }),
}));

export const loansRelations = relations(loans, ({ many, one }) => ({
  entries: many(loanEntries),
  lender: one(user, { fields: [loans.lenderId], references: [user.id], relationName: "lender" }),
  borrower: one(user, {
    fields: [loans.borrowerId],
    references: [user.id],
    relationName: "borrower",
  }),
  payments: many(loanPayments),
}));

export const loanPaymentsRelations = relations(loanPayments, ({ one }) => ({
  loan: one(loans, { fields: [loanPayments.loanId], references: [loans.id] }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ many, one }) => ({
  contributions: many(savingsContributions),
  group: one(savingsGroups, { fields: [savingsGoals.groupId], references: [savingsGroups.id] }),
}));

export const savingsContributionsRelations = relations(savingsContributions, ({ one }) => ({
  goal: one(savingsGoals, { fields: [savingsContributions.goalId], references: [savingsGoals.id] }),
}));
