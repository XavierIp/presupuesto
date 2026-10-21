import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";

/** Pantalla base para secciones cuya tabla ya existe pero cuya interfaz aún no. */
export function ComingSoon({
  title,
  description,
  icon: Icon,
  points,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  points: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="grid max-w-xl justify-items-start gap-4 rounded-xl border bg-card p-6">
        <span className="inline-flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="grid gap-1">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">En construcción</h2>
          <p className="text-muted-foreground">Esta sección incluirá:</p>
        </div>
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
