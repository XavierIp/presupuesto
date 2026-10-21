import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  currency: string;
  /** Nulo solo en cuentas creadas antes de exigir el DNI. */
  dni: string | null;
};

/**
 * Capa de acceso a datos: único punto para leer al usuario actual.
 * Lee la petición, así que quien lo llame debe estar dentro de un <Suspense>.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id, name, email, currency, dni } = session.user;
  return { id, name, email, currency: currency ?? "PEN", dni: dni ?? null };
}
