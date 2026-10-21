import { auth } from "@/lib/auth";
import { syncVersion } from "@/lib/data/sync";

/** Huella de los datos del usuario para la sincronización en vivo (ver LiveSync). */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { version, pending } = await syncVersion(session.user.id);
  return Response.json(
    { version, pending },
    { headers: { "Cache-Control": "no-store" } },
  );
}
