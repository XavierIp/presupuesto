import Link from "next/link";
import { CreditCard, HandCoins, PieChart, PiggyBank, ShieldCheck, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses } from "@/components/ui/button";

const FEATURES = [
  {
    icon: PieChart,
    title: "Presupuestos mensuales",
    text: "Define cuánto gastar por categoría y mira en tiempo real cuánto te queda.",
  },
  {
    icon: CreditCard,
    title: "Débito y crédito",
    text: "Controla el uso de tus tarjetas, el límite disponible y las fechas de pago.",
  },
  {
    icon: HandCoins,
    title: "Préstamos",
    text: "Presta dinero a otros usuarios, registra abonos y sabe siempre cuánto te deben.",
  },
  {
    icon: PiggyBank,
    title: "Ahorro individual",
    text: "Crea metas con monto y fecha, y avanza aporte a aporte.",
  },
  {
    icon: Users,
    title: "Ahorro en grupo",
    text: "Invita a otras personas a una meta común y ve el aporte de cada una.",
  },
  {
    icon: ShieldCheck,
    title: "Tus datos, tu cuenta",
    text: "Cada persona tiene su propio acceso. Nunca guardamos números completos de tarjeta.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonClasses({ variant: "ghost" })}>
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="stagger grid max-w-3xl gap-6 py-16 sm:py-24">
          <p
            style={{ "--i": 0 } as React.CSSProperties}
            className="text-[12px] font-medium tracking-[0.06em] text-primary uppercase"
          >
            Finanzas personales
          </p>
          <h1
            style={{ "--i": 1 } as React.CSSProperties}
            className="text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-[56px]"
          >
            Sabe en qué se va tu dinero, mes a mes.
          </h1>
          <p
            style={{ "--i": 2 } as React.CSSProperties}
            className="max-w-xl text-lg text-pretty text-muted-foreground"
          >
            Presupuestos, ingresos y gastos, tarjetas, préstamos y ahorro en grupo, en un solo lugar.
          </p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="flex flex-wrap gap-3">
            <Link href="/registro" className={buttonClasses({ size: "lg" })}>
              Crear cuenta gratis
            </Link>
            <Link href="/login" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section aria-label="Funciones" className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="grid content-start gap-3 rounded-xl border bg-card p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-[13px] text-muted-foreground">
        Presupuesto · Finanzas personales
      </footer>
    </div>
  );
}
