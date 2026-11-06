import { Eye, Users } from "lucide-react";
import { getSharing } from "@/lib/data/sharing";
import { getCurrentUser, getSessionUser } from "@/lib/session";
import {
  AccountSwitcher,
  BackToMine,
  EndAccess,
  OpenAccounts,
  RequestAccessForm,
  RespondAccess,
} from "./sharing-client";

/** Selector "Mis cuentas / Cuentas de…". Solo aparece si llevas las cuentas de alguien. */
export async function AccountSwitcherSlot({
  className,
}: {
  className?: string;
}) {
  const [me, current] = await Promise.all([getSessionUser(), getCurrentUser()]);
  const { managing } = await getSharing(me.id);
  const options = managing
    .filter((m) => m.status === "accepted")
    .map((m) => ({ id: m.personId, name: m.name }));
  if (options.length === 0) return null;
  return (
    <AccountSwitcher
      value={current.actor ? current.id : ""}
      options={options}
      className={className}
    />
  );
}

/** Aviso fijo arriba mientras llevas las cuentas de otra persona. */
export async function ActingBanner() {
  const user = await getCurrentUser();
  if (!user.actor) return null;
  return (
    <div
      role="status"
      className="sticky top-[57px] z-20 -mx-4 -mt-6 mb-6 flex items-center justify-between gap-3 border-y border-savings/40 bg-savings/10 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:-mt-10 lg:mb-8 lg:px-10"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <Eye className="size-4 shrink-0 text-savings" aria-hidden />
        <span className="min-w-0">
          Llevas las cuentas de{" "}
          <span className="font-semibold">{user.name}</span>
          <span className="hidden text-muted-foreground sm:inline">
            {" "}
            · lo que registres queda en sus cuentas
          </span>
        </span>
      </p>
      <BackToMine />
    </div>
  );
}

/** Solicitudes para llevar mis cuentas: se responden desde cualquier pantalla. */
export async function SharingPrompt() {
  const [me, current] = await Promise.all([getSessionUser(), getCurrentUser()]);
  if (current.actor) return null;
  const { managers } = await getSharing(me.id);
  const pending = managers.filter((m) => m.status === "pending");
  if (pending.length === 0) return null;
  return (
    <div className="mb-8 grid gap-3">
      {pending.map((m) => (
        <section
          key={m.id}
          className="grid gap-4 rounded-xl border border-savings/40 bg-savings/5 p-5 sm:grid-cols-[auto_1fr] sm:items-start"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-savings/15 text-savings">
            <Users className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <h2 className="font-semibold">
                {m.name} quiere llevar tus cuentas
              </h2>
              <AccessExplainer />
            </div>
            <RespondAccess id={m.id} />
          </div>
        </section>
      ))}
    </div>
  );
}

function AccessExplainer() {
  return (
    <ul className="grid gap-0.5 text-sm text-muted-foreground">
      <li>
        · Podrá ver y registrar tus movimientos, pagos, tarjetas y préstamos.
      </li>
      <li>
        · No verá tu contraseña ni podrá cambiar tu DNI o tu código de
        recuperación.
      </li>
      <li>· Puedes quitarle el acceso cuando quieras, desde Más.</li>
    </ul>
  );
}

/** Sección de Más: quién lleva mis cuentas, de quién llevo y pedir acceso. */
export async function SharingSection() {
  const me = await getSessionUser();
  const { managing, managers } = await getSharing(me.id);
  const activeManagers = managers.filter((m) => m.status === "accepted");
  const pendingManagers = managers.filter((m) => m.status === "pending");

  return (
    <section
      id="compartir"
      aria-labelledby="compartir-title"
      className="grid scroll-mt-20 gap-5 rounded-xl border bg-card p-5"
    >
      <div className="grid gap-1">
        <h2
          id="compartir-title"
          className="flex items-center gap-2 font-semibold"
        >
          <Users
            className="size-5 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          Acceso compartido
        </h2>
        <p className="text-sm text-muted-foreground">
          Para llevar las cuentas de alguien (o que alguien lleve las tuyas) sin
          cerrar sesión: cambias entre ellas con el selector de arriba.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Cuentas que llevo
        </h3>
        {managing.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no llevas las cuentas de nadie.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {managing.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {m.status === "accepted"
                      ? "Te dio acceso"
                      : "Esperando que acepte"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {m.status === "accepted" ? (
                    <>
                      <EndAccess
                        id={m.id}
                        label="Dejar de llevar"
                        confirm="¿Seguro?"
                        success="Ya no llevas sus cuentas"
                      />
                      <OpenAccounts ownerId={m.personId} />
                    </>
                  ) : (
                    <EndAccess
                      id={m.id}
                      label="Cancelar"
                      confirm="¿Cancelar?"
                      success="Solicitud cancelada"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <details className="group rounded-lg border">
          <summary className="flex h-11 cursor-pointer list-none items-center px-3 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
            + Pedir llevar las cuentas de alguien
          </summary>
          <div className="border-t p-3">
            <RequestAccessForm />
          </div>
        </details>
      </div>

      <div className="grid gap-2">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Quién lleva mis cuentas
        </h3>
        {pendingManagers.map((m) => (
          <div
            key={m.id}
            className="grid gap-3 rounded-lg border border-savings/40 bg-savings/5 p-3"
          >
            <p className="font-medium">{m.name} quiere llevar tus cuentas</p>
            <AccessExplainer />
            <RespondAccess id={m.id} />
          </div>
        ))}
        {activeManagers.length === 0 && pendingManagers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nadie lleva tus cuentas.
          </p>
        ) : (
          activeManagers.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {activeManagers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-[13px] text-muted-foreground">
                      Puede ver y registrar en tus cuentas
                    </p>
                  </div>
                  <EndAccess
                    id={m.id}
                    label="Quitar acceso"
                    confirm="¿Quitar?"
                    success="Acceso quitado"
                  />
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </section>
  );
}
