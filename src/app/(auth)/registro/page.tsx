import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Crea tu cuenta</h1>
        <p className="text-muted-foreground">Empieza a organizar tu dinero en un minuto.</p>
      </div>
      <RegisterForm />
      <p className="text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
