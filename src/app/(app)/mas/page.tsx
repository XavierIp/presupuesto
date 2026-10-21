import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { MORE_LINKS } from "@/components/nav-items";
import { PageHeader } from "@/components/page-header";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";

export const metadata: Metadata = { title: "Más" };

export default function MasPage() {
  return (
    <>
      <PageHeader title="Más" />
      <div className="grid max-w-xl gap-6">
        <ul className="divide-y rounded-xl border bg-card">
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
        <div className="rounded-xl border bg-card p-4">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </>
  );
}
