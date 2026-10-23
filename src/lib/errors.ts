// Manejo de errores robusto: traduce errores técnicos a mensajes amigables.

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

// Mapa de códigos de error de Postgres/Supabase a mensajes en español.
const CODE_MESSAGES: Record<string, string> = {
  "23505": "Ya existe un registro con estos datos. Verifica que no esté duplicado.",
  "23503": "No se puede completar la operación porque el registro está en uso.",
  "23502": "Faltan datos obligatorios para completar la operación.",
  "23514": "Los datos ingresados no cumplen con las reglas del sistema.",
  "22P02": "Uno de los valores ingresados tiene un formato inválido.",
  "42501": "No tienes permisos para realizar esta acción.",
  P0001: "", // errores RAISE EXCEPTION: usar el mensaje directamente
  PGRST301: "Tu sesión expiró. Vuelve a iniciar sesión.",
  "401": "Tu sesión expiró. Vuelve a iniciar sesión.",
  "403": "No tienes permisos para realizar esta acción.",
  "429": "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
};

// Traducciones de fragmentos comunes de mensajes de Supabase Auth.
const MESSAGE_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Debes confirmar tu correo antes de iniciar sesión."],
  [/user already registered/i, "Este correo ya está registrado."],
  [/password should be at least/i, "La contraseña es demasiado corta."],
  [/no autorizado/i, "No tienes permisos para realizar esta acción."],
  [
    /network|failed to fetch|load failed/i,
    "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
  ],
  [/jwt|token/i, "Tu sesión expiró. Vuelve a iniciar sesión."],
];

const GENERIC = "Ocurrió un error inesperado. Inténtalo de nuevo.";

export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return GENERIC;

  if (typeof error === "string") return error || GENERIC;

  const err = error as SupabaseLikeError & { error_description?: string };

  const rawMessage = err.message || err.details || err.error_description || "";

  // Código conocido con mensaje mapeado.
  const code = err.code ?? (err.status != null ? String(err.status) : undefined);
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  // Errores lanzados con RAISE EXCEPTION desde la base de datos suelen ser amigables.
  if (rawMessage) {
    for (const [pattern, friendly] of MESSAGE_MAP) {
      if (pattern.test(rawMessage)) return friendly;
    }
    // Si el mensaje parece de negocio (en español, corto), mostrarlo tal cual.
    if (rawMessage.length < 160 && !/^[A-Za-z]+Error:/.test(rawMessage)) {
      return rawMessage;
    }
  }

  return GENERIC;
}
