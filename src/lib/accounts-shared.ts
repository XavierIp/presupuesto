// Tipos y etiquetas de cuentas compartidos entre servidor y cliente.

export type AccountType = "cash" | "debit" | "credit" | "savings";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Efectivo",
  debit: "Débito",
  credit: "Crédito",
  savings: "Ahorro",
};

/** Opción para los selectores de "¿con qué pagas / prestas?". */
export type PaymentSource = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  last4: string | null;
  /** Crédito: crédito disponible (null si no registró límite). Resto: saldo. */
  available: number | null;
  /** Solo crédito: días de corte y de pago (para calcular cuándo se cobran las cuotas). */
  statementDay: number | null;
  paymentDueDay: number | null;
};
