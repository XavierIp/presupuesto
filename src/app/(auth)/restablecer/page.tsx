import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function ResetPage({ searchParams }: PageProps<"/restablecer">) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Elige tu nueva contraseña</h1>
        <p className="text-muted-foreground">Este enlace sirve una sola vez.</p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <TokenForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TokenForm({ searchParams }: Pick<PageProps<"/restablecer">, "searchParams">) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === "string" ? token : ""} />;
}
