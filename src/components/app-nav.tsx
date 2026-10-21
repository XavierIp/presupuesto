"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MORE_LINKS, MOBILE_SECTIONS, SECTIONS } from "./nav-items";

const MORE_PATHS = ["/mas", ...MORE_LINKS.map((l) => l.href)];

function isActive(pathname: string, href: string) {
  if (href === "/mas") return MORE_PATHS.some((p) => pathname.startsWith(p));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  return <SidebarLinks pathname={usePathname()} />;
}

/** Versión sin ruta activa para el fallback de <Suspense> (rutas dinámicas). */
export function SidebarNavFallback() {
  return <SidebarLinks pathname="" />;
}

function SidebarLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Principal" className="grid gap-1">
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  return <BottomLinks pathname={usePathname()} />;
}

export function BottomNavFallback() {
  return <BottomLinks pathname="" />;
}

function BottomLinks({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_SECTIONS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2 : 1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

