import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DNI_SCHEMA } from "@/lib/dni";
import { CURRENCIES } from "@/lib/money";

const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense"; icon: string }[] = [
  { name: "Salario", kind: "income", icon: "briefcase" },
  { name: "Otros ingresos", kind: "income", icon: "plus-circle" },
  { name: "Vivienda", kind: "expense", icon: "home" },
  { name: "Comida", kind: "expense", icon: "utensils" },
  { name: "Transporte", kind: "expense", icon: "car" },
  { name: "Servicios", kind: "expense", icon: "zap" },
  { name: "Salud", kind: "expense", icon: "heart-pulse" },
  { name: "Entretenimiento", kind: "expense", icon: "film" },
  { name: "Compras", kind: "expense", icon: "shopping-bag" },
  { name: "Educación", kind: "expense", icon: "graduation-cap" },
];

// En Vercel, las URLs de preview cambian en cada despliegue: se confían automáticamente.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  trustedOrigins: vercelOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // Restablecimiento sin correo (ver src/lib/recovery.ts): el enlace vence en 1 hora
    // y al cambiar la contraseña se cierran las sesiones abiertas en otros dispositivos.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      dni: {
        type: "string",
        required: true,
        unique: true,
        validator: { input: DNI_SCHEMA },
      },
      currency: {
        type: "string",
        required: false,
        defaultValue: "PEN",
        validator: { input: CURRENCIES.schema },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Caché corta: al cambiar la contraseña, las sesiones revocadas dejan de servir en ≤ 1 minuto.
    cookieCache: { enabled: true, maxAge: 60 },
  },
  databaseHooks: {
    user: {
      create: {
        // Un DNI solo puede pertenecer a una cuenta (el correo ya es único en Better Auth).
        before: async (user) => {
          const dni = typeof user.dni === "string" ? user.dni : null;
          if (!dni) return;
          const [taken] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.dni, dni))
            .limit(1);
          if (taken) {
            throw new APIError("BAD_REQUEST", {
              message: "Ya existe una cuenta con ese DNI.",
              code: "DNI_ALREADY_EXISTS",
            });
          }
        },
        after: async (user) => {
          await db
            .insert(schema.categories)
            .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id })))
            .onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
