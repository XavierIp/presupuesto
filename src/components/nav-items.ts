import {
  ArrowLeftRight,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Menu,
  PieChart,
  PiggyBank,
  Plus,
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

/** Abre el formulario de nuevo movimiento desde cualquier pantalla. */
export const NEW_MOVEMENT: NavItem = {
  href: "/movimientos?nuevo=1",
  label: "Nuevo movimiento",
  icon: Plus,
};

/** Secciones que en móvil viven dentro de "Más". */
export const MORE_LINKS = SECTIONS.filter((s) =>
  ["/movimientos", "/tarjetas", "/ahorro"].includes(s.href),
);

const section = (href: string) => SECTIONS.find((s) => s.href === href)!;

// En móvil: 4 destinos y, al centro, el botón para registrar un movimiento
// (abre Movimientos con el formulario; al cerrarlo quedas en Movimientos).
export const MOBILE_SECTIONS: (NavItem & { primary?: boolean })[] = [
  section("/dashboard"),
  section("/prestamos"),
  { ...NEW_MOVEMENT, primary: true },
  section("/presupuestos"),
  { href: "/mas", label: "Más", icon: Menu },
];
