"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

/** Cambia entre claro y oscuro y guarda la preferencia. Sin animación: es un cambio instantáneo. */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema claro u oscuro"
      className={cn(
        "pressable inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Sun className="size-5 dark:hidden" strokeWidth={1.75} aria-hidden />
      <Moon className="hidden size-5 dark:block" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
