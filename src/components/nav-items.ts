import {
  ArrowLeftRight,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Menu,
  PieChart,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const SECTIONS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/presupuestos", label: "Presupuestos", icon: PieChart },
  { href: "/tarjetas", label: "Tarjetas y cuentas", icon: CreditCard },
  { href: "/prestamos", label: "Préstamos", icon: HandCoins },
  { href: "/ahorro", label: "Ahorro", icon: PiggyBank },
];

/** Secciones que en móvil viven dentro de "Más". */
export const MORE_LINKS = SECTIONS.filter((s) => s.href === "/tarjetas" || s.href === "/prestamos");

// En móvil: máximo 5 destinos.
export const MOBILE_SECTIONS: NavItem[] = [
  ...SECTIONS.filter((s) => !MORE_LINKS.includes(s)),
  { href: "/mas", label: "Más", icon: Menu },
];
