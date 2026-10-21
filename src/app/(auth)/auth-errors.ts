const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres.",
  INVALID_EMAIL: "Escribe un correo válido.",
  DNI_ALREADY_EXISTS: "Ya existe una cuenta con ese DNI.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null) {
  if (error?.status === 429) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return (error?.code && MESSAGES[error.code]) || "No pudimos completar la solicitud. Inténtalo de nuevo.";
}

/** Solo permite volver a rutas internas (evita redirecciones abiertas). */
export function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
