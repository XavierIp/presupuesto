# Presupuesto — Sistema de diseño (MASTER)

Fuente de verdad para toda la UI. Si existe `pages/<pagina>.md`, sus reglas tienen prioridad sobre este archivo.

- **Producto:** finanzas personales multiusuario (presupuestos mensuales, ingresos/gastos, tarjetas de débito y crédito, préstamos entre usuarios, ahorro individual y en grupo).
- **Stack:** Next.js (App Router) + Tailwind CSS v4.
- **Generado con:** skill `ui-ux-pro-max` (perfil *Personal Finance Tracker*, paleta *Trust blue + profit green*) y principios de animación de `emil-design-eng`.

---

## 1. Estilo: Minimalismo suizo, con modo oscuro de primera clase

**Por qué:** es una herramienta que se usa a diario para leer números. Lo que necesita es claridad, jerarquía y confianza, no decoración.

- Retícula clara, mucho espacio en blanco y alto contraste. Cada pantalla tiene **un número protagonista** (saldo disponible, lo que queda del presupuesto o el progreso de la meta).
- Superficies planas con bordes de 1px y sombras mínimas. Radios: `8px` para controles, `12px` para tarjetas y `16px` para hojas y modales.
- **Modo claro y oscuro** desde el día 1 (respeta `prefers-color-scheme` y ofrece un selector manual).
- **Glassmorphism solo en la tarjeta visual de débito/crédito.** Es el único "objeto físico" de la app. En el resto de la interfaz el blur afecta la legibilidad de los datos y el rendimiento.
- Iconos SVG de **Lucide** (`lucide-react`) con trazo de 1.75px. Nada de emojis como iconos.

**Evitar:** degradados morado/rosa de "estética IA", diseño infantil o lúdico, comisiones o cifras poco claras, y color como único indicador (los gastos llevan `−` y los ingresos `+`, además del color).

## 2. Paleta

Todos los pares de texto/fondo están verificados con WCAG AA (≥ 4.5:1).

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F8FAFC` | `#0B1220` | Fondo de página |
| `foreground` | `#0F172A` | `#F1F5F9` | Texto principal (17:1) |
| `card` | `#FFFFFF` | `#111A2E` | Tarjetas y paneles |
| `muted` | `#F1F5F9` | `#1A2438` | Fondos secundarios, filas alternas |
| `muted-foreground` | `#475569` | `#94A3B8` | Texto secundario (7.6:1 / 6.8:1) |
| `border` | `#E2E8F0` | `rgb(255 255 255 / 0.08)` | Bordes de 1px |
| `primary` | `#1E40AF` | `#60A5FA` | Acciones principales, enlaces, foco |
| `on-primary` | `#FFFFFF` | `#0B1220` | Texto sobre primary (8.7:1 / 7.4:1) |
| `income` | `#047857` | `#34D399` | Ingresos, saldo positivo, metas cumplidas |
| `expense` | `#B91C1C` | `#F87171` | Gastos, deudas vencidas, acciones destructivas |
| `warning` | `#B45309` | `#FBBF24` | Presupuesto ≥ 80 %, pagos de tarjeta próximos |
| `savings` | `#0E7490` | `#22D3EE` | Ahorro individual y en grupo |
| `ring` | `#1E40AF` | `#60A5FA` | Anillo de foco (nunca se elimina) |

**Gráficas (categorías de gasto):** usa una escala categórica separada y **nunca** reutilices `income` o `expense` como color de categoría, porque esos colores ya tienen significado.

## 3. Tipografía: Inter (un solo sistema)

Pareo *Modern Dark Cinema / Inter System*, que la skill recomienda para fintech. Una sola familia da precisión y coherencia, y Inter tiene **cifras tabulares**, lo esencial en una app de dinero porque las columnas de montos quedan alineadas y los números no "bailan" al cambiar.

```tsx
// app/layout.tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
```

| Nivel | Tamaño / peso | Tracking |
|---|---|---|
| Display (saldo principal) | 40–48px / 700 | -0.03em |
| H1 | 30px / 600 | -0.02em |
| H2 | 22px / 600 | -0.01em |
| Cuerpo | 16px / 400, line-height 1.5 | 0 |
| Etiqueta | 13px / 500 | 0 |
| Overline | 12px / 500 MAYÚSCULAS | +0.06em |

- **Todo monto** usa `font-variant-numeric: tabular-nums` (la clase `tabular-nums` de Tailwind) y se alinea a la derecha en tablas.
- Formatea los montos con `Intl.NumberFormat(locale, { style: "currency", currency })`. Nunca concatenes `"$" + n`.
- El texto de cuerpo nunca baja de 12px.

## 4. Espaciado y densidad

La densidad es media-alta (dashboard). Escala de 4px: `4 8 12 16 24 32 48 64`.
Objetivos táctiles de **44×44px como mínimo**, con 8px entre ellos.
Breakpoints: 375 / 768 / 1024 / 1440. En móvil: navegación inferior con 5 destinos o menos (Inicio, Movimientos, Presupuestos, Ahorro, Más).

## 5. Movimiento (principios de Emil Kowalski)

> Primero preguntar: ¿esto debería animarse? ¿Con qué frecuencia lo verá el usuario?

### Curvas y duraciones

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);    /* entradas/salidas */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* movimiento en pantalla */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* hojas inferiores (tipo iOS) */
```

- **Nunca `ease-in`** en la UI.
- **Nunca `transition: all`**: declara las propiedades exactas.
- Anima solo `transform` y `opacity`. Las barras de progreso usan `scaleX`, no `width`.
- La UI va por debajo de **300ms**, y las salidas son más rápidas que las entradas.

### Mapa por componente

| Elemento | Frecuencia | Decisión |
|---|---|---|
| Botones | Muy alta | `:active { scale(0.97) }`, 160ms `--ease-out` |
| Hover de filas y tarjetas | Muy alta | Solo cambio de color, 150ms `ease`, dentro de `@media (hover: hover) and (pointer: fine)` |
| Atajos de teclado / paleta de comandos (⌘K) | 100+/día | **Sin animación** |
| Dropdowns, selects, popovers | Alta | 180ms `--ease-out`, desde `scale(0.96)` + `opacity: 0`, con `transform-origin` en el disparador |
| Tooltips | Alta | Retardo inicial; los siguientes se abren al instante y sin animación |
| Modales (nuevo gasto, transferir) | Ocasional | 220ms `--ease-out`, `scale(0.96)` → 1, con origen al centro |
| Hoja inferior móvil (Vaul) | Ocasional | 400ms `--ease-drawer`, se cierra con un gesto rápido (velocidad > 0.11) |
| Toasts (Sonner) | Ocasional | Valores por defecto de Sonner; entran y salen por el mismo lado |
| Nuevo movimiento en la lista | Ocasional | Entra con opacidad + altura; nunca aparece de golpe |
| Barra de progreso de presupuesto o meta | Al cargar | `scaleX` 600ms `--ease-out` una vez; luego cambia de color al pasar a `warning` |
| **Saldos y montos** | Constante | **Sin conteo animado.** Son datos funcionales: el valor nuevo aparece con un *crossfade* de 150ms con `blur(2px)` |
| Gráficas | Al cargar | Entrada breve una sola vez; nada decorativo que siga al mouse |
| Meta de ahorro cumplida | Rara | Aquí **sí** cabe un detalle de celebración (spring con `bounce: 0.2`) |
| Lista del dashboard al cargar | Al cargar | Escalonado de 40ms entre tarjetas, sin bloquear la interacción |

- **Animaciones dinámicas o interrumpibles:** transiciones CSS o `motion` (con `transform: "translateX()"` como cadena, no los atajos `x`/`y`).
- **Entradas simples:** `@starting-style`.
- **`prefers-reduced-motion`:** se quitan los desplazamientos y escalas, y se conservan los fundidos de opacidad y color.

## 6. Tokens listos para Tailwind v4

```css
/* app/globals.css */
@import "tailwindcss";
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {
  --background: #F8FAFC; --foreground: #0F172A;
  --card: #FFFFFF; --muted: #F1F5F9; --muted-foreground: #475569;
  --border: #E2E8F0; --primary: #1E40AF; --on-primary: #FFFFFF;
  --income: #047857; --expense: #B91C1C; --warning: #B45309; --savings: #0E7490;
  --ring: #1E40AF;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background: #0B1220; --foreground: #F1F5F9;
    --card: #111A2E; --muted: #1A2438; --muted-foreground: #94A3B8;
    --border: rgb(255 255 255 / 0.08); --primary: #60A5FA; --on-primary: #0B1220;
    --income: #34D399; --expense: #F87171; --warning: #FBBF24; --savings: #22D3EE;
    --ring: #60A5FA;
  }
}
[data-theme="dark"] {
  --background: #0B1220; --foreground: #F1F5F9;
  --card: #111A2E; --muted: #1A2438; --muted-foreground: #94A3B8;
  --border: rgb(255 255 255 / 0.08); --primary: #60A5FA; --on-primary: #0B1220;
  --income: #34D399; --expense: #F87171; --warning: #FBBF24; --savings: #22D3EE;
  --ring: #60A5FA;
}

@theme inline {
  --font-sans: var(--font-sans);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-on-primary: var(--on-primary);
  --color-income: var(--income);
  --color-expense: var(--expense);
  --color-warning: var(--warning);
  --color-savings: var(--savings);
  --color-ring: var(--ring);
  --ease-out: var(--ease-out);
  --ease-in-out: var(--ease-in-out);
  --ease-drawer: var(--ease-drawer);
}

body { background: var(--background); color: var(--foreground); }
```

Usa siempre tokens semánticos (`bg-card`, `text-income`) y nunca hex directos en los componentes.

## 7. Librerías sugeridas

- **Componentes:** shadcn/ui (sobre Radix o Base UI), adaptado a estos tokens.
- **Iconos:** `lucide-react`.
- **Toasts:** `sonner`.
- **Hoja inferior móvil:** `vaul`.
- **Animación:** CSS primero; `motion` solo para gestos y layout.
- **Gráficas:** Recharts, con tooltips y leyendas y sin depender solo del color.

## 8. Checklist antes de entregar cada pantalla

- [ ] Contraste ≥ 4.5:1 en claro **y** oscuro
- [ ] Anillo de foco visible y navegación completa por teclado
- [ ] Botones de solo icono con `aria-label`
- [ ] Montos con `tabular-nums`, `Intl.NumberFormat` y signo `+`/`−`
- [ ] Etiquetas visibles en formularios y errores junto al campo
- [ ] Estados de carga (skeleton con espacio reservado, CLS < 0.1) y estados vacíos
- [ ] `prefers-reduced-motion` respetado
- [ ] Sin scroll horizontal a 375px
