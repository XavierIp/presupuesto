// Aplica las migraciones de ./drizzle y muestra el error real si alguna falla
// (drizzle-kit migrate a veces sale con código 1 sin explicar por qué).
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (en .env.local o en el entorno).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
  console.log("✓ Migraciones aplicadas");
} catch (error) {
  console.error("✗ La migración falló:", error.cause?.message ?? error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
