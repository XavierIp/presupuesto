import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Ahorro" };

export default function AhorroPage() {
  return (
    <ComingSoon
      title="Ahorro"
      description="Metas de ahorro individuales y en grupo."
      icon={PiggyBank}
      points={[
        "Metas personales con monto objetivo y fecha límite",
        "Grupos de ahorro con código de invitación",
        "Aportes de cada miembro y progreso de la meta",
      ]}
    />
  );
}
