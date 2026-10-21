import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Presupuesto", template: "%s · Presupuesto" },
  description:
    "Finanzas personales: presupuestos mensuales, ingresos y gastos, tarjetas, préstamos y ahorro en grupo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom bloqueado: la app se ve igual en todas las pantallas del móvil.
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

// Aplica el tema guardado antes de pintar, para evitar el destello del tema equivocado.
// También bloquea el gesto de zoom de Safari en iOS, que no respeta user-scalable=no.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}document.addEventListener("gesturestart",function(e){e.preventDefault()});`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
