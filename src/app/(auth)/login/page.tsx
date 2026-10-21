import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Bienvenido de nuevo</h1>
        <p className="text-muted-foreground">Entra para ver tus finanzas.</p>
      </div>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary underline-offset-4 hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
