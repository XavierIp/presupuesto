import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Pool TCP estándar: admite transacciones (necesarias para pagos de préstamos y aportes).
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// En Vercel, cierra las conexiones inactivas antes de que la función se suspenda.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
