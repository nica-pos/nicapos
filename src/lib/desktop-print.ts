// Helpers de impresión que funcionan tanto en navegador como en el
// instalador de escritorio (Electron). Cuando corre en Electron y el
// usuario configuró una impresora por tipo de documento, imprime en
// silencio a esa impresora. En navegador o sin configuración, cae al
// diálogo estándar `window.print()`.

/** Firma de la API expuesta desde electron/preload.cjs */
type DesktopAPI = {
  isDesktop: true;
  listPrinters: () => Promise<Array<{ name: string; displayName: string; isDefault: boolean }>>;
  print: (opts: {
    deviceName?: string;
    silent?: boolean;
    copies?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  openCashDrawer: (opts: { deviceName: string }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
};

declare global {
  interface Window {
    nicaposDesktop?: DesktopAPI;
  }
}

/** ¿La app corre dentro del instalador de escritorio? */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.nicaposDesktop?.isDesktop;
}

/** Tipo de documento que se está imprimiendo. */
export type PrintKind = "ticket" | "carta";

/** Clave de localStorage para las preferencias de impresión del equipo. */
const STORAGE_KEY = "nicapos.print.settings.v1";

export type PrintSettings = {
  /** Impresora térmica preferida para tickets 80mm. */
  ticketPrinter?: string;
  /** Impresora para facturas tamaño carta. */
  cartaPrinter?: string;
  /** Si es true, imprime sin mostrar el diálogo del sistema. */
  silent: boolean;
  /** Copias por impresión (1 por defecto). */
  copies: number;
};

const DEFAULTS: PrintSettings = { silent: true, copies: 1 };

/** Lee las preferencias guardadas en este equipo. */
export function getPrintSettings(): PrintSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PrintSettings>) };
  } catch {
    return DEFAULTS;
  }
}

/** Guarda las preferencias en este equipo. */
export function setPrintSettings(next: Partial<PrintSettings>): PrintSettings {
  const merged = { ...getPrintSettings(), ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignorar cuota */
  }
  return merged;
}

/**
 * Imprime la vista actual (respetando las reglas @media print del DOM).
 * @param kind "ticket" o "carta" para elegir la impresora configurada.
 */
export async function printDocument(kind: PrintKind): Promise<void> {
  const desktop = window.nicaposDesktop;
  const settings = getPrintSettings();
  const deviceName = kind === "ticket" ? settings.ticketPrinter : settings.cartaPrinter;

  if (desktop && deviceName && settings.silent) {
    const res = await desktop.print({
      deviceName,
      silent: true,
      copies: settings.copies,
    });
    if (!res.ok) {
      // Si algo falla, ofrecer el diálogo del sistema como respaldo.
      console.warn("[print] silencioso falló, abriendo diálogo:", res.error);
      window.print();
    }
    return;
  }

  if (desktop) {
    // Sin impresora configurada: abrir el diálogo nativo de Electron.
    const res = await desktop.print({ silent: false });
    if (!res.ok) window.print();
    return;
  }

  // Navegador normal.
  window.print();
}

/** Abre el cajón monedero conectado a la térmica configurada. */
export async function openCashDrawer(): Promise<{ ok: boolean; error?: string }> {
  const desktop = window.nicaposDesktop;
  const settings = getPrintSettings();
  if (!desktop) return { ok: false, error: "Solo disponible en la app de escritorio" };
  if (!settings.ticketPrinter)
    return { ok: false, error: "Configura primero la impresora térmica" };
  return desktop.openCashDrawer({ deviceName: settings.ticketPrinter });
}
