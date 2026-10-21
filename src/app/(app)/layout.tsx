import { Suspense } from "react";
import { BottomNav, BottomNavFallback, SidebarNav, SidebarNavFallback } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { DniPrompt } from "@/components/dni-prompt";
import { RecoveryPrompt } from "@/components/recovery-prompt";
import { LiveSync } from "@/components/live-sync";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";

// La estructura es estática (se prerenderiza); solo el usuario se transmite dentro de <Suspense>.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card px-4 py-5 lg:flex">
        <div className="flex items-center justify-between px-2">
          <Brand href="/dashboard" />
          <ThemeToggle />
        </div>
        <Suspense fallback={<SidebarNavFallback />}>
          <SidebarNav />
        </Suspense>
        <div className="mt-auto border-t pt-4">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-2 backdrop-blur-sm lg:hidden">
          <Brand href="/dashboard" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <Suspense fallback={null}>
            <DniPrompt />
          </Suspense>
          <Suspense fallback={null}>
            <RecoveryPrompt />
          </Suspense>
          {children}
        </main>
      </div>

      <LiveSync />
      <Suspense fallback={<BottomNavFallback />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
