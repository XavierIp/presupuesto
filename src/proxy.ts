import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Revisión optimista: solo mira si existe la cookie. La validación real ocurre en getCurrentUser().
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/registro";

  if (!hasSession && !isAuthPage) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/registro",
    "/dashboard/:path*",
    "/movimientos/:path*",
    "/presupuestos/:path*",
    "/tarjetas/:path*",
    "/prestamos/:path*",
    "/ahorro/:path*",
    "/mas",
  ],
};
