// Integración de WhatsApp Web para Nica-POS.
// Funciona en la app de escritorio (Electron) mediante ventana dedicada
// persistente (las cookies de sesión quedan guardadas) y en el navegador web
// abriendo directamente el chat o WhatsApp Web oficial.

import { isDesktopApp } from "@/lib/desktop-print";

/**
 * Normaliza un número telefónico para WhatsApp.
 * Si es un número nicaragüense de 8 dígitos (ej. 8888-1234), agrega el código 505.
 */
export function formatWhatsAppPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  // Número de Nicaragua de 8 dígitos
  if (digits.length === 8) {
    return `505${digits}`;
  }
  return digits;
}

/**
 * Abre WhatsApp Web.
 * - En la app de escritorio (Electron): abre o enfoca la ventana dedicada
 *   con sesión persistente.
 * - En el navegador web: abre una pestaña o ventana con web.whatsapp.com.
 */
export async function openWhatsAppWeb(opts?: { phone?: string; text?: string }): Promise<void> {
  const cleanPhone = opts?.phone ? formatWhatsAppPhone(opts.phone) : "";
  const text = opts?.text ?? "";

  // 1. Si corre en Electron nativo
  if (isDesktopApp() && window.nicaposDesktop?.openWhatsApp) {
    try {
      await window.nicaposDesktop.openWhatsApp({
        phone: cleanPhone,
        text,
      });
      return;
    } catch (e) {
      console.warn("[whatsapp] Error abriendo ventana en Electron, usando respaldo:", e);
    }
  }

  // 2. Si corre en navegador web tradicional
  let url = "https://web.whatsapp.com";
  if (cleanPhone) {
    const encoded = encodeURIComponent(text);
    url = `https://web.whatsapp.com/send?phone=${cleanPhone}${encoded ? `&text=${encoded}` : ""}`;
  }

  // Intentamos abrir en ventana auxiliar tipo popup o pestaña
  const w = window.open(url, "nicapos_whatsapp_web", "noopener,noreferrer");
  if (w) {
    w.focus();
  } else {
    // Si el bloqueador de popups lo detiene, redirigir enlace
    window.open(url, "_blank");
  }
}

/**
 * Genera el texto del mensaje para enviar un ticket de venta por WhatsApp.
 */
export function buildSaleWhatsAppMessage(params: {
  saleNumber: number;
  customerName?: string | null;
  storeName?: string | null;
  branchName?: string | null;
  items: Array<{ name: string; quantity: number; total: number }>;
  totalNio: number;
  totalUsd: number;
  paymentMethod?: string;
  notes?: string;
}): string {
  const store = params.storeName || "Nica-POS";
  const branch = params.branchName ? ` · Sucursal ${params.branchName}` : "";
  const lines: string[] = [
    `🧾 *COMPROBANTE DE COMPRA — ${store}*${branch}`,
    `Venta: *#${params.saleNumber}*`,
  ];

  if (params.customerName && params.customerName.trim()) {
    lines.push(`Cliente: *${params.customerName.trim()}*`);
  }

  lines.push("--------------------------------");
  lines.push("*Detalle de compra:*");

  params.items.forEach((item) => {
    lines.push(`• ${item.quantity}x ${item.name} — C$ ${item.total.toFixed(2)}`);
  });

  lines.push("--------------------------------");
  lines.push(`*Total a pagar:* C$ ${params.totalNio.toFixed(2)} / $${params.totalUsd.toFixed(2)}`);

  if (params.paymentMethod) {
    lines.push(`Método: ${params.paymentMethod}`);
  }

  if (params.notes) {
    lines.push(`Nota: ${params.notes}`);
  }

  lines.push("");
  lines.push("¡Gracias por su preferencia! 🙏");

  return lines.join("\n");
}

/**
 * Genera el mensaje de estado de reparación listo para retirar.
 */
export function buildRepairReadyWhatsAppMessage(params: {
  orderNumber: number;
  customerName?: string | null;
  storeName?: string | null;
  brand: string;
  model: string;
  balanceFormatted: string;
  estimatedDate?: string;
}): string {
  const store = params.storeName || "Nica-POS";
  const lines = [
    `🔧 *¡Tu equipo está listo! — ${store}*`,
    `Hola ${params.customerName || "estimado cliente"}, te informamos que tu equipo ya fue reparado y probado con éxito:`,
    "",
    `📱 *Equipo:* ${params.brand} ${params.model}`,
    `📋 *Orden:* REP-${String(params.orderNumber).padStart(4, "0")}`,
    `💰 *Saldo pendiente:* ${params.balanceFormatted}`,
    "",
    "Puedes pasar a retirarlo por nuestra tienda con tu comprobante de recepción.",
    "¡Gracias por confiar en nosotros!",
  ];
  return lines.join("\n");
}
