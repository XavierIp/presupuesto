import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, KeyRound, ShieldCheck } from "lucide-react";
import { AdminResetForm } from "@/components/admin-reset-form";
import { MORE_LINKS } from "@/components/nav-items";
import { PageHeader } from "@/components/page-header";
import { RecoveryCodePanel } from "@/components/recovery-code-panel";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";
import { isAdmin, recoveryCodeInfo } from "@/lib/recovery";
import { dateIn, formatDate } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Más" };

export default function MasPage() {
  return (
    <>
      <PageHeader title="Más" />
      <div className="grid max-w-xl gap-6">
        <ul className="divide-y rounded-xl border bg-card lg:hidden">
          {MORE_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-14 items-center gap-3 px-5 text-sm font-medium transition-colors duration-150 hover:bg-muted"
              >
                <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
          <SecuritySections />
        </Suspense>
        <div className="rounded-xl border bg-card p-4">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function SecuritySections() {
  const user = await getCurrentUser();
  const code = await recoveryCodeInfo(user.id);
  return (
    <>
      <section className="grid gap-3 rounded-xl border bg-card p-5" aria-labelledby="seguridad">
        <h2 id="seguridad" className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Código de recuperación
        </h2>
        <p className="text-sm text-muted-foreground">
          {code
            ? `Lo creaste el ${formatDate(dateIn(code.createdAt))}. Si lo perdiste, genera uno nuevo: el anterior dejará de funcionar.`
            : "Aún no tienes uno. Sin él no podrás recuperar tu cuenta si olvidas la contraseña."}
        </p>
        <div>
          <RecoveryCodePanel hasCode={Boolean(code)} />
        </div>
      </section>

      {isAdmin(user.email) && (
        <section className="grid gap-3 rounded-xl border bg-card p-5" aria-labelledby="admin">
          <h2 id="admin" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            Restablecer la contraseña de alguien
          </h2>
          <p className="text-sm text-muted-foreground">
            Para quien olvidó su contraseña y no tiene su código. Genera un enlace de un solo uso y
            envíaselo; la persona elige su nueva contraseña.
          </p>
          <AdminResetForm />
        </section>
      )}
    </>
  );
}
