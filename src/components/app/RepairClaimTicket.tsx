import React from "react";
import {
  Printer,
  MessageSquare,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Check,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { repairNumber } from "@/hooks/use-repairs";

export interface RepairTicketData {
  storeName: string;
  branchName?: string;
  orderNumber?: number;
  orderNumberText?: string;
  dateText?: string;
  customerName: string;
  customerPhone?: string;
  deviceBrand: string;
  deviceModel: string;
  deviceColor?: string;
  deviceImei?: string;
  reportedIssue: string;
  observations?: string;
  accessories?: string;
  deliveryDate?: string;
  warrantyDays?: number | null;
  totalCostUsd?: number;
  totalCostFormatted: string;
  advanceUsd?: number;
  advanceFormatted: string;
  balanceUsd?: number;
  balanceFormatted: string;
  currency?: "USD" | "NIO";
  isPreliminary?: boolean;
}

/**
 * Imprime un ticket térmico de comprobante de ingreso / reclamo de reparación
 * compatible con impresoras de 58mm y 80mm y navegadores web.
 */
export function printRepairClaimTicket(data: RepairTicketData) {
  const w = window.open("", "_blank", "width=420,height=680");
  if (!w) return;

  const numText =
    data.orderNumberText || (data.orderNumber ? repairNumber(data.orderNumber) : "ORDEN NUEVA");
  const now = data.dateText || new Date().toLocaleString();

  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Comprobante ${numText}</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            font-size: 12px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            padding: 12px;
            margin: 0 auto;
            max-width: 320px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .title {
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .subtitle {
            font-size: 11px;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
          .badge-order {
            display: inline-block;
            font-size: 15px;
            font-weight: 900;
            padding: 3px 8px;
            border: 2px solid #000;
            margin: 6px 0;
          }
          .sep {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .double-sep {
            border-top: 2px solid #000;
            margin: 8px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .terms {
            font-size: 9.5px;
            line-height: 1.25;
            text-align: justify;
            margin-top: 8px;
          }
          .footer-thanks {
            text-align: center;
            font-size: 10px;
            font-weight: bold;
            margin-top: 10px;
          }
          @media print {
            body { padding: 4px; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${escapeHtml(data.storeName.toUpperCase())}</div>
          ${data.branchName ? `<div class="subtitle">Sucursal: ${escapeHtml(data.branchName)}</div>` : ""}
          <div class="subtitle bold">${data.isPreliminary ? "PRE-COMPROBANTE DE INGRESO" : "COMPROBANTE DE RECEPCIÓN / RECLAMO"}</div>
          <div class="badge-order">${escapeHtml(numText)}</div>
          <div style="font-size: 10.5px;">Fecha: ${escapeHtml(now)}</div>
        </div>

        <div class="double-sep"></div>

        <div><span class="bold">CLIENTE:</span> ${escapeHtml(data.customerName || "Particular")}</div>
        ${data.customerPhone ? `<div><span class="bold">TELÉFONO:</span> ${escapeHtml(data.customerPhone)}</div>` : ""}

        <div class="sep"></div>

        <div><span class="bold">EQUIPO:</span> ${escapeHtml(data.deviceBrand)} ${escapeHtml(data.deviceModel)}</div>
        ${data.deviceColor ? `<div><span class="bold">COLOR:</span> ${escapeHtml(data.deviceColor)}</div>` : ""}
        ${data.deviceImei ? `<div><span class="bold">IMEI / SERIE:</span> ${escapeHtml(data.deviceImei)}</div>` : ""}
        ${data.accessories ? `<div><span class="bold">ACCESORIOS:</span> ${escapeHtml(data.accessories)}</div>` : ""}

        <div class="sep"></div>

        <div><span class="bold">FALLA REPORTADA:</span></div>
        <div style="padding-left: 4px; margin-top: 2px;">${escapeHtml(data.reportedIssue)}</div>

        ${
          data.observations
            ? `<div style="margin-top: 4px;"><span class="bold">OBSERVACIONES FÍSICAS:</span></div>
               <div style="padding-left: 4px; font-size: 11px;">${escapeHtml(data.observations)}</div>`
            : ""
        }

        ${
          data.deliveryDate
            ? `<div style="margin-top: 6px;"><span class="bold">FECHA ESTIMADA ENTREGA:</span> ${escapeHtml(data.deliveryDate)}</div>`
            : ""
        }

        ${
          data.warrantyDays !== undefined && data.warrantyDays !== null && data.warrantyDays > 0
            ? `<div style="margin-top: 4px;"><span class="bold">GARANTÍA OTORGADA:</span> ${data.warrantyDays} DÍAS</div>`
            : ""
        }

        <div class="double-sep"></div>

        <div class="row">
          <span>Presupuesto pactado:</span>
          <span class="bold">${escapeHtml(data.totalCostFormatted)}</span>
        </div>
        <div class="row">
          <span>Anticipo recibido:</span>
          <span>${escapeHtml(data.advanceFormatted)}</span>
        </div>
        <div class="row bold" style="font-size: 13px; margin-top: 4px;">
          <span>SALDO PENDIENTE:</span>
          <span>${escapeHtml(data.balanceFormatted)}</span>
        </div>

        <div class="sep"></div>

        <div class="terms">
          <div class="bold text-center" style="margin-bottom: 2px;">CONDICIONES DEL SERVICIO:</div>
          <div>• Es indispensable presentar este comprobante para retirar el equipo al estar listo o en caso de retiro.</div>
          <div>• Respalde su información. El taller no se hace responsable por pérdida de datos o memoria.</div>
          <div>• Equipos no retirados después de 60 días causan costo de almacenaje o abandono.</div>
        </div>

        <div class="footer-thanks">
          ¡Agradecemos su preferencia y confianza!<br/>
          Conserve este boleto para su reclamo.
        </div>
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      // Ignorar si el usuario cancela la impresión
    }
  }, 250);
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Visualizador de Ticket estilo papel térmico para previsualizaciones en pantalla
 */
export function RepairThermalTicketView({ data }: { data: RepairTicketData }) {
  const numText =
    data.orderNumberText || (data.orderNumber ? repairNumber(data.orderNumber) : "NUEVA ORDEN");

  return (
    <div className="bg-amber-50/70 dark:bg-zinc-900 border-2 border-dashed border-amber-300 dark:border-zinc-700 rounded-xl p-5 font-mono text-xs text-zinc-900 dark:text-zinc-100 shadow-sm max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <h3 className="font-extrabold text-sm uppercase tracking-wide text-foreground">
          {data.storeName || "TALLER DE REPARACIONES"}
        </h3>
        {data.branchName && (
          <p className="text-[11px] text-muted-foreground uppercase">{data.branchName}</p>
        )}
        <div className="inline-block px-2.5 py-0.5 my-1.5 rounded border border-foreground/30 font-bold text-xs bg-background/60">
          {data.isPreliminary ? "TICKET PREVIO DE RECLAMO" : "COMPROBANTE DE RECEPCIÓN"}
        </div>
        <div className="text-base font-black tracking-wider text-primary">{numText}</div>
        <div className="text-[10px] text-muted-foreground">{data.dateText || "Fecha: Hoy"}</div>
      </div>

      <div className="border-t border-dashed border-zinc-400 dark:border-zinc-700 my-3" />

      {/* Cliente */}
      <div className="space-y-1">
        <div>
          <span className="font-bold">Cliente: </span>
          <span>{data.customerName || "(Sin nombre)"}</span>
        </div>
        {data.customerPhone && (
          <div>
            <span className="font-bold">Teléfono: </span>
            <span>{data.customerPhone}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-zinc-400 dark:border-zinc-700 my-3" />

      {/* Equipo */}
      <div className="space-y-1">
        <div>
          <span className="font-bold">Equipo: </span>
          <span>
            {data.deviceBrand} {data.deviceModel}
          </span>
        </div>
        {data.deviceColor && (
          <div>
            <span className="font-bold">Color: </span>
            <span>{data.deviceColor}</span>
          </div>
        )}
        {data.deviceImei && (
          <div>
            <span className="font-bold">IMEI / Serie: </span>
            <span>{data.deviceImei}</span>
          </div>
        )}
        {data.accessories && (
          <div>
            <span className="font-bold">Accesorios: </span>
            <span>{data.accessories}</span>
          </div>
        )}
        <div className="pt-1">
          <span className="font-bold">Falla reportada: </span>
          <span className="text-rose-600 dark:text-rose-400 font-semibold">
            {data.reportedIssue || "Por diagnosticar"}
          </span>
        </div>
        {data.observations && (
          <div className="text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">Obs: </span>
            {data.observations}
          </div>
        )}
        {data.deliveryDate && (
          <div className="pt-1">
            <span className="font-bold text-primary">Entrega prometida: </span>
            <span>{data.deliveryDate}</span>
          </div>
        )}
        {data.warrantyDays !== undefined && data.warrantyDays !== null && data.warrantyDays > 0 && (
          <div className="pt-1 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Garantía: {data.warrantyDays} días</span>
          </div>
        )}
      </div>

      <div className="border-t-2 border-zinc-500 dark:border-zinc-600 my-3" />

      {/* Finanzas */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Presupuesto total:</span>
          <span className="font-bold">{data.totalCostFormatted}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Anticipo recibido:</span>
          <span className="font-semibold">{data.advanceFormatted}</span>
        </div>
        <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-300 dark:border-zinc-800">
          <span>SALDO PENDIENTE:</span>
          <span className="text-amber-600 dark:text-amber-400">{data.balanceFormatted}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-zinc-400 dark:border-zinc-700 my-3" />

      {/* Términos y aviso */}
      <div className="text-[9.5px] text-muted-foreground space-y-1">
        <p className="font-bold text-center uppercase text-zinc-700 dark:text-zinc-300">
          Aviso importante al cliente
        </p>
        <p>
          • Es indispensable presentar este comprobante para retirar el equipo al estar listo o en
          caso de reclamo.
        </p>
        <p>
          • El taller no se responsabiliza por pérdida de información. Realice respaldos periódicos.
        </p>
        <p>• Equipos no retirados tras 60 días se consideran en abandono.</p>
      </div>

      <div className="text-center font-bold text-[10px] mt-4 text-muted-foreground">
        ¡Gracias por su preferencia!
      </div>
    </div>
  );
}

/**
 * Modal de Vista Previa del Ticket antes de confirmar el ingreso
 */
export function PreviewRepairTicketDialog({
  open,
  onOpenChange,
  ticketData,
  onConfirmOrder,
  confirmBusy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketData: RepairTicketData;
  onConfirmOrder: () => void;
  confirmBusy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Vista Previa de Factura / Ticket Previo
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            Así es como se imprimirá y se entregará el comprobante de reclamo al cliente para
            retirar su equipo al estar listo.
          </p>

          <RepairThermalTicketView data={ticketData} />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => printRepairClaimTicket(ticketData)}
          >
            <Printer className="h-4 w-4" /> Imprimir Prueba
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Seguir Editando
            </Button>
            <Button
              type="button"
              onClick={onConfirmOrder}
              disabled={confirmBusy}
              className="gap-2 bg-primary font-semibold"
            >
              <Check className="h-4 w-4" /> {confirmBusy ? "Guardando…" : "Confirmar e Ingresar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Modal posterior a la creación exitosa de una orden:
 * Permite imprimir inmediatamente el comprobante de reclamo o enviarlo por WhatsApp
 */
export function OrderCreatedSuccessDialog({
  open,
  onOpenChange,
  ticketData,
  whatsappMessage,
  phone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketData: RepairTicketData | null;
  whatsappMessage?: string;
  phone?: string;
}) {
  if (!ticketData) return null;

  const cleanPhone = phone?.replace(/\D/g, "");
  const waUrl =
    cleanPhone && whatsappMessage
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
            ¡Orden de Reparación Ingresada!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Número de Orden asignado:
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground">
              {ticketData.orderNumberText ||
                (ticketData.orderNumber ? repairNumber(ticketData.orderNumber) : "")}
            </div>
            <div className="text-xs text-foreground font-medium">
              {ticketData.deviceBrand} {ticketData.deviceModel} · {ticketData.customerName}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Entrega al cliente su comprobante físico o envíale el ticket por WhatsApp para que pueda
            reclamar su celular al estar listo o fallido.
          </p>

          <div className="grid gap-2.5">
            <Button
              type="button"
              size="lg"
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={() => printRepairClaimTicket(ticketData)}
            >
              <Printer className="h-5 w-5" /> Imprimir Ticket / Factura de Reclamo
            </Button>

            {waUrl ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full gap-2 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                asChild
              >
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="h-5 w-5 text-emerald-500" /> Enviar Ticket por WhatsApp
                </a>
              </Button>
            ) : (
              <div className="text-[11px] text-center text-muted-foreground">
                (No se proporcionó número telefónico para WhatsApp)
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
