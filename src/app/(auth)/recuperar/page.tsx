import type { Metadata } from "next";
import Link from "next/link";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Recuperar contraseña</h1>
        <p className="text-muted-foreground">Usa tu correo y el código de recuperación que guardaste.</p>
      </div>
      <RecoverForm />
      <p className="text-sm text-muted-foreground">
        ¿No tienes tu código? Pídele a un administrador de la app un enlace para restablecerla.{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
