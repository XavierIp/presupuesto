import Link from "next/link";
import { Wallet } from "lucide-react";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
        <Wallet className="size-4" strokeWidth={2} aria-hidden />
      </span>
      Presupuesto
    </Link>
  );
}
