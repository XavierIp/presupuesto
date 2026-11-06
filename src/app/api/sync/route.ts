import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { syncVersion } from "@/lib/data/sync";
import { ACTING_COOKIE, actingAs } from "@/lib/session";

/** Huella de los datos que estoy viendo para la sincronización en vivo (ver LiveSync). */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  // Si estoy llevando las cuentas de otra persona, se sincronizan las suyas.
  const ownerId = (await cookies()).get(ACTING_COOKIE)?.value;
  const acting =
    ownerId && ownerId !== session.user.id
      ? await actingAs(session.user, ownerId)
      : null;
  const { version, pending } = await syncVersion(
    acting?.id ?? session.user.id,
    session.user.id,
  );
  return Response.json(
    { version, pending },
    { headers: { "Cache-Control": "no-store" } },
  );
}
