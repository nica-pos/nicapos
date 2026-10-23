import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  Trash2,
  Clock,
  Wrench,
  CheckCircle2,
  PackageCheck,
  Phone,
  MessageSquare,
  Play,
  TrendingUp,
  AlertTriangle,
  User,
  Check,
  Plus,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";
import { useProducts, useOpenCashSession } from "@/hooks/use-pos";
import { useLatestRate, formatNIO } from "@/hooks/use-fiscal";
import {
  REPAIR_STATUSES,
  repairBalance,
  repairNumber,
  repairProfit,
  statusLabel,
  useRepairAction,
  useRepairOrder,
  useTechnicians,
  useDeleteRepairOrder,
  buildRepairWhatsAppMessage,
  extractWarrantyDays,
  updateObservationsWithWarranty,
} from "@/hooks/use-repairs";
import { getOrderStation } from "@/routes/_authenticated/reparaciones";
import { decodeLock, PatternReplay } from "@/components/app/PatternLock";
import { supabase } from "@/integrations/supabase/client";

function RepairPhotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!paths.length) return;
    supabase.storage
      .from("repair-photos")
      .createSignedUrls(paths, 3600)
      .then(({ data }) =>
        setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]),
      );
  }, [paths.join("|")]);

  if (!urls.length) return null;
  return (
    <div className="pt-2">
      <div className="font-semibold text-xs text-muted-foreground mb-1">Fotos de ingreso:</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            <img
              src={u}
              alt="Foto del equipo"
              className="h-20 w-20 rounded border object-cover hover:opacity-90"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/reparaciones/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de Reparación — Nica-POS" },
      {
        name: "description",
        content: "Detalle de orden de reparación de celulares y control por estaciones.",
      },
      { property: "og:title", content: "Detalle de Reparación — Nica-POS" },
      { property: "og:description", content: "Detalle de orden de reparación de celulares y control por estaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepairDetail,
});

const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;
type PartRow = {
  id?: string;
  product_id?: string | null;
  name: string;
  quantity: number;
  unit_price_usd: number;
  consumed?: boolean;
};

function RepairDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { role, tenant } = useActiveTenant();
  const isAdmin = role === "owner" || role === "admin";
  const { data, isLoading } = useRepairOrder(id);
  const { data: techs = [] } = useTechnicians();
  const { data: products = [] } = useProducts() as {
    data?: { id: string; name: string; price_usd?: number; sale_price_usd?: number }[];
  };
  const action = useRepairAction();
  const deleteMutation = useDeleteRepairOrder();
  const { branch } = useActiveBranch();

  const { data: openCashSession } = useOpenCashSession();
  const latestRate = useLatestRate();
  const rate = latestRate ?? 36.6243;

  const [labor, setLabor] = useState(0);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [note, setNote] = useState("");
  const [diag, setDiag] = useState({ diagnosis: "", work_to_do: "" });

  // Modales de avance y eliminación
  const [assignOpen, setAssignOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliverMethod, setDeliverMethod] = useState("cash_usd");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Garantía técnica
  const [warrantyPreset, setWarrantyPreset] = useState<number | "custom">(30);
  const [customDays, setCustomDays] = useState("30");

  useEffect(() => {
    if (!data?.order) return;
    setLabor(Number(data.order.labor_usd || 0));
    setParts(
      data.parts.map((p) => ({
        id: p.id,
        product_id: p.product_id,
        name: p.name,
        quantity: Number(p.quantity),
        unit_price_usd: Number(p.unit_price_usd),
        consumed: p.consumed,
      })),
    );
    setDiag({ diagnosis: data.order.diagnosis ?? "", work_to_do: data.order.work_to_do ?? "" });
    const existingW = extractWarrantyDays(data.order.observations);
    setWarrantyPreset(existingW !== null ? existingW : 30);
    setCustomDays(String(existingW !== null ? existingW : 30));
  }, [data]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Cargando orden de reparación…
      </div>
    );
  }

  const o = data?.order;
  if (!o) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold">Orden no encontrada</h2>
        <p className="text-sm text-muted-foreground mt-2">
          La orden no existe o no tienes permisos en esta sucursal.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/reparaciones">Volver a Reparaciones</Link>
        </Button>
      </div>
    );
  }

  const closed = o.status === "delivered" || o.status === "cancelled";
  const balance = repairBalance(o);
  const profit = repairProfit(o);
  const station = getOrderStation(o.status);
  const techName = techs.find((t) => t.id === o.technician_id)?.name || "Sin asignar";

  async function run(fn: string, args: Record<string, unknown>, ok: string) {
    try {
      await action.mutateAsync({ fn, args });
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function printReceipt() {
    const w = window.open("", "_blank", "width=420,height=680");
    if (!w) return;
    const warrantyNum = extractWarrantyDays(o!.observations);
    const storeTitle = (tenant?.name || "NICA-POS").toUpperCase();
    const branchTitle = branch?.name ? `Sucursal: ${branch.name}` : "";
    w.document.write(`
      <html>
        <head>
          <title>${repairNumber(o!.order_number)}</title>
          <style>
            @page { size: auto; margin: 0; }
            body { font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 12px; padding: 14px; margin: 0 auto; max-width: 320px; line-height: 1.35; color: #000; }
            h2 { text-align: center; margin: 0 0 2px 0; font-size: 15px; font-weight: 800; }
            .sub { text-align: center; font-size: 11px; margin-bottom: 4px; }
            .sep { border-top: 1px dashed #000; margin: 8px 0; }
            .double-sep { border-top: 2px solid #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
            .bold { font-weight: bold; }
            .badge { display: inline-block; font-size: 14px; font-weight: bold; border: 1.5px solid #000; padding: 2px 6px; margin: 5px 0; }
            .terms { font-size: 9.5px; margin-top: 8px; line-height: 1.25; }
          </style>
        </head>
        <body>
          <div style="text-align: center;">
            <h2>${storeTitle}</h2>
            ${branchTitle ? `<div class="sub">${branchTitle}</div>` : ""}
            <div class="sub bold">COMPROBANTE DE REPARACIÓN</div>
            <div class="badge">${repairNumber(o!.order_number)}</div>
            <div style="font-size: 10px;">${new Date().toLocaleString()}</div>
          </div>
          <div class="double-sep"></div>
          <div><span class="bold">Cliente:</span> ${data!.customer?.name ?? "Particular"}</div>
          <div><span class="bold">Teléfono:</span> ${data!.customer?.phone ?? "—"}</div>
          <div><span class="bold">Equipo:</span> ${o!.brand} ${o!.model} (${o!.color ?? "—"})</div>
          <div><span class="bold">IMEI / Serie:</span> ${o!.imei ?? "—"}</div>
          <div class="sep"></div>
          <div><span class="bold">Falla:</span> ${o!.reported_issue}</div>
          ${o!.accessories ? `<div><span class="bold">Accesorios:</span> ${o!.accessories}</div>` : ""}
          ${o!.estimated_delivery ? `<div><span class="bold">Entrega estimada:</span> ${o!.estimated_delivery}</div>` : ""}
          ${warrantyNum ? `<div class="bold" style="color: #047857; margin-top: 2px;">🛡️ Garantía otorgada: ${warrantyNum} días</div>` : ""}
          <div><span class="bold">Estado actual:</span> ${statusLabel(o!.status)}</div>
          <div class="double-sep"></div>
          <div class="row"><span class="bold">Total presupuestado:</span> <span>${usd(Number(o!.total_usd))} (C$ ${formatNIO(Number(o!.total_usd) * rate)})</span></div>
          <div class="row"><span>Anticipo / Pagado:</span> <span>${usd(Number(o!.paid_usd))}</span></div>
          <div class="row bold" style="font-size: 13px; margin-top: 4px;"><span>Saldo Pendiente:</span> <span>${usd(balance)} (C$ ${formatNIO(balance * rate)})</span></div>
          <div class="sep"></div>
          <div class="terms">
            • Presente este comprobante para retirar su equipo al estar listo o en caso de reclamo.<br/>
            • No nos hacemos responsables por pérdidas de información o memorias.<br/>
            • Equipos no retirados tras 60 días causarán abandono.
          </div>
          <div style="text-align: center; font-size: 10px; font-weight: bold; margin-top: 10px;">
            ¡Gracias por su preferencia!
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {}
    }, 250);
  }

  return (
    <div className="space-y-6">
      {/* Barra superior de navegación y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/reparaciones">
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{repairNumber(o.order_number)}</h1>
          <Badge
            variant="secondary"
            className={
              station === "pending"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : station === "in_process"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : station === "ready"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : station === "delivered"
                      ? "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold"
            }
          >
            {station === "cancelled" ? "Fallida / No Reparable" : statusLabel(o.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {data.customer?.phone && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <a
                href={`https://wa.me/${data.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  buildRepairWhatsAppMessage({
                    order: o,
                    customerName: data.customer.name,
                    storeName: tenant?.name,
                    balanceUsd: balance,
                    rate: rate,
                  }),
                )}`}
                target="_blank"
                rel="noreferrer"
                title="Avisar al cliente por WhatsApp (Mensaje profesional)"
              >
                <MessageSquare className="mr-1.5 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={printReceipt}>
            <Printer className="mr-1.5 h-4 w-4" /> Comprobante
          </Button>

          {/* Botón para eliminar orden entregada o cancelada definitivamente */}
          {(o.status === "delivered" || o.status === "cancelled") && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Eliminar reparación del sistema de forma definitiva"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar orden
            </Button>
          )}

          {!closed && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setCancelOpen(true)}
            >
              Cancelar orden
            </Button>
          )}
        </div>
      </div>

      {/* STEPPER DE ESTACIONES VISUAL */}
      <Card className="overflow-hidden border shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Las 4 Estaciones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              {/* Estación 1: Pendiente */}
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                  station === "pending"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold"
                    : station === "in_process" || station === "ready" || station === "delivered"
                      ? "bg-muted/40 text-muted-foreground border-transparent"
                      : "opacity-60 border-transparent"
                }`}
              >
                <Clock className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-bold">1. Pendiente</div>
                  <div className="text-[10px] text-muted-foreground">Ingreso inicial</div>
                </div>
              </div>

              {/* Estación 2: En Proceso */}
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                  station === "in_process"
                    ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold"
                    : station === "ready" || station === "delivered"
                      ? "bg-muted/40 text-muted-foreground border-transparent"
                      : "opacity-60 border-transparent"
                }`}
              >
                <Wrench className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-bold">2. En Proceso</div>
                  <div className="text-[10px] text-muted-foreground">Técnico asignado</div>
                </div>
              </div>

              {/* Estación 3: Listo */}
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                  station === "ready"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : station === "delivered"
                      ? "bg-muted/40 text-muted-foreground border-transparent"
                      : "opacity-60 border-transparent"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-bold">3. Listo</div>
                  <div className="text-[10px] text-muted-foreground">Ganancia calculada</div>
                </div>
              </div>

              {/* Estación 4: Entregado */}
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                  station === "delivered"
                    ? "bg-slate-500/20 border-slate-500/40 font-semibold text-foreground"
                    : "opacity-60 border-transparent"
                }`}
              >
                <PackageCheck className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-bold">4. Entregado</div>
                  <div className="text-[10px] text-muted-foreground">Cobro finalizado</div>
                </div>
              </div>
            </div>

            {/* Botón de Acción Principal de la Estación */}
            <div className="w-full sm:w-auto shrink-0">
              {station === "pending" && (
                <Button
                  className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setAssignOpen(true)}
                >
                  <Play className="h-4 w-4" /> Iniciar (Asignar Técnico)
                </Button>
              )}
              {station === "in_process" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    onClick={() => setCompleteOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Terminar Reparación & Ganancia
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="h-4 w-4" /> Marcar como Fallida
                  </Button>
                </div>
              )}
              {station === "ready" && (
                <Button
                  className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setDeliverOpen(true)}
                >
                  <PackageCheck className="h-4 w-4" />{" "}
                  {balance > 0 ? "Cobrar y Entregar" : "Entregar al Cliente"}
                </Button>
              )}
              {station === "delivered" && (
                <Badge
                  variant="outline"
                  className="px-3 py-1.5 text-xs text-muted-foreground font-medium"
                >
                  ✓ Entregado el{" "}
                  {o.delivered_at ? new Date(o.delivered_at).toLocaleDateString() : ""}
                </Badge>
              )}
              {station === "cancelled" && (
                <Badge
                  variant="outline"
                  className="px-3 py-1.5 text-xs bg-rose-500/10 text-rose-600 border-rose-200 font-semibold"
                >
                  ❌ Reparación Fallida / No Reparable
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner de Reparación Fallida / No Reparable */}
      {station === "cancelled" && (
        <Card className="border-rose-300 dark:border-rose-900/50 bg-rose-500/10 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-rose-700 dark:text-rose-300 text-sm flex items-center gap-1.5">
                <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                Esta reparación no pudo completarse (Marcada como Fallida / No Reparable)
              </div>
              <div className="text-xs text-foreground/90">
                <span className="font-semibold">Explicación del técnico / taller:</span>{" "}
                {o.cancel_reason || "Sin motivo especificado"}
              </div>
              {o.cancelled_at && (
                <div className="text-[11px] text-muted-foreground">
                  Registrado el {new Date(o.cancelled_at).toLocaleString()}
                </div>
              )}
            </div>

            {data.customer?.phone && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 shrink-0"
                asChild
              >
                <a
                  href={`https://wa.me/${data.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    buildRepairWhatsAppMessage({
                      order: o,
                      customerName: data.customer.name,
                      storeName: tenant?.name,
                      balanceUsd: balance,
                      rate: rate,
                    }),
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Enviar explicación por WhatsApp
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tarjetas Financieras Clave */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total al cliente</div>
            <div className="text-2xl font-bold">{usd(Number(o.total_usd))}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Precio pactado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Costo de refacciones</div>
            <div className="text-2xl font-bold text-rose-500">
              {usd(Number(o.parts_cost_usd || 0))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Repuestos utilizados</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ganancia Neta
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              +{usd(profit)}
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
              {Number(o.total_usd) > 0
                ? `${Math.round((profit / Number(o.total_usd)) * 100)}% de margen`
                : "Sin costo registrado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Saldo pendiente</div>
            <div
              className={`text-2xl font-bold ${balance > 0 ? "text-amber-500" : "text-foreground"}`}
            >
              {usd(balance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pagado: {usd(Number(o.paid_usd))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid de 2 Columnas: Datos del Equipo y Técnico / Diagnóstico */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Columna 1: Datos del Equipo y Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Datos del Celular & Cliente</span>
              {data.customer?.phone && (
                <a
                  href={`tel:${data.customer.phone}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-normal"
                >
                  <Phone className="h-3.5 w-3.5" /> {data.customer.phone}
                </a>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 pb-2 border-b">
              <div>
                <span className="text-xs text-muted-foreground block">Cliente:</span>
                <span className="font-semibold">{data.customer?.name || "Sin nombre"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Equipo:</span>
                <span className="font-semibold">
                  {o.brand} {o.model} {o.color ? `· ${o.color}` : ""}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div>
                <b className="text-foreground">Falla reportada:</b>{" "}
                <span className="text-muted-foreground">{o.reported_issue}</span>
              </div>
              {o.imei && (
                <div>
                  <b className="text-foreground">IMEI / Serie:</b>{" "}
                  <span className="font-mono text-muted-foreground">{o.imei}</span>
                </div>
              )}
              {o.accessories && (
                <div>
                  <b className="text-foreground">Accesorios:</b>{" "}
                  <span className="text-muted-foreground">{o.accessories}</span>
                </div>
              )}
              {o.physical_condition && (
                <div>
                  <b className="text-foreground">Estado físico:</b>{" "}
                  <span className="text-muted-foreground">{o.physical_condition}</span>
                </div>
              )}
              {o.observations && (
                <div>
                  <b className="text-foreground">Observaciones:</b>{" "}
                  <span className="text-muted-foreground">{o.observations}</span>
                </div>
              )}
              {o.estimated_delivery && (
                <div>
                  <b className="text-foreground">Fecha estimada:</b>{" "}
                  <span className="text-muted-foreground">{o.estimated_delivery}</span>
                </div>
              )}
              {extractWarrantyDays(o.observations) !== null && (
                <div className="flex items-center gap-1.5 pt-1 text-xs">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Garantía del servicio: {extractWarrantyDays(o.observations)} días
                  </span>
                </div>
              )}
            </div>

            {/* Código / Patrón de desbloqueo */}
            {data.unlockCode &&
              (() => {
                const l = decodeLock(data.unlockCode);
                return (
                  <div className="rounded-md border p-2.5 bg-muted/30 text-xs mt-2">
                    <b className="block mb-1 text-foreground">Código de desbloqueo:</b>
                    {l.type === "pattern" ? (
                      <PatternReplay seq={l.pattern} />
                    ) : (
                      <span className="font-mono text-sm font-bold bg-muted px-2 py-0.5 rounded">
                        {l.text}
                      </span>
                    )}
                  </div>
                );
              })()}

            {/* Fotos */}
            <RepairPhotos paths={o.photo_paths ?? []} />

            {/* Responsable asignado */}
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground block mb-1">
                Técnico o responsable asignado:
              </span>
              {isAdmin && !closed ? (
                <Select
                  value={o.technician_id ?? ""}
                  onValueChange={(v) =>
                    run(
                      "update_repair_order",
                      { _order_id: o.id, _data: { technician_id: v } },
                      "Técnico reasignado",
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {techs.map((t) => {
                      const roleLabel =
                        t.role === "owner" ? "Dueño" : t.role === "admin" ? "Admin" : "Técnico";
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({roleLabel})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" /> {techName}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Columna 2: Diagnóstico y Trabajo a Realizar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagnóstico del Taller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Diagnóstico del problema</Label>
              <Textarea
                placeholder="¿Qué daño se encontró al abrir o revisar el equipo?"
                value={diag.diagnosis}
                disabled={closed}
                onChange={(e) => setDiag({ ...diag, diagnosis: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Trabajo realizado / a realizar</Label>
              <Textarea
                placeholder="Detalle del procedimiento realizado…"
                value={diag.work_to_do}
                disabled={closed}
                onChange={(e) => setDiag({ ...diag, work_to_do: e.target.value })}
                rows={3}
              />
            </div>

            {!closed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run(
                    "update_repair_order",
                    { _order_id: o.id, _data: diag },
                    "Diagnóstico guardado",
                  )
                }
              >
                Guardar notas de diagnóstico
              </Button>
            )}

            {/* Historial de estados */}
            <div className="border-t pt-3 space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground block">
                Historial de avance:
              </span>
              <div className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {data.history.map((h) => (
                  <div key={h.id} className="py-0.5 border-b border-muted/50 last:border-0">
                    <span className="font-mono text-[10px]">
                      {new Date(h.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>{" "}
                    · {statusLabel(h.to_status)} {h.note ? `— ${h.note}` : ""}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Pagos y Notas Internas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de Pagos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.payments.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                No se han registrado pagos aún.
              </div>
            ) : (
              data.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center py-1.5 border-b last:border-0 text-xs"
                >
                  <div>
                    <span className="font-semibold">
                      {p.kind === "advance" ? "Anticipo" : "Pago Final"}
                    </span>
                    <span className="text-muted-foreground block text-[11px]">
                      {new Date(p.created_at).toLocaleDateString()} · Método: {p.method}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-foreground">
                    {p.amount} {p.currency} ({usd(Number(p.amount_usd))})
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas Internas del Taller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Escribe una nota interna para el equipo…"
                className="text-xs"
              />
              <Button
                size="sm"
                onClick={() =>
                  note.trim() &&
                  run("add_repair_note", { _order_id: o.id, _note: note }, "Nota agregada").then(
                    () => setNote(""),
                  )
                }
              >
                Agregar
              </Button>
            </div>
            <div className="max-h-40 space-y-2 overflow-y-auto text-xs">
              {data.notes.map((n) => (
                <div key={n.id} className="rounded-md bg-muted/30 p-2">
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-foreground">{n.note}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MODAL 1: Iniciar y Asignar Técnico */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-blue-500" />
              Iniciar Reparación — {repairNumber(o.order_number)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecciona qué técnico o administrador se encargará de realizar esta reparación.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Técnico / Responsable *</Label>
              <Select
                value={o.technician_id || ""}
                onValueChange={(v) =>
                  run(
                    "update_repair_order",
                    { _order_id: o.id, _data: { technician_id: v } },
                    "Responsable asignado",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un técnico o admin…" />
                </SelectTrigger>
                <SelectContent>
                  {techs.map((t) => {
                    const roleLabel =
                      t.role === "owner" ? "Dueño" : t.role === "admin" ? "Admin" : "Técnico";
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({roleLabel})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={async () => {
                if (!o.technician_id) return toast.error("Selecciona un técnico primero");
                if (o.quote_status !== "approved") {
                  await run(
                    "save_repair_quote",
                    {
                      _order_id: o.id,
                      _labor: Number(o.total_usd || 0),
                      _parts: [],
                      _skip_approval: true,
                    },
                    "Cotización aprobada",
                  );
                }
                await run(
                  "change_repair_status",
                  { _order_id: o.id, _status: "in_repair" },
                  "Orden pasada a En Proceso",
                );
                setAssignOpen(false);
              }}
            >
              Pasar a En Proceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Terminar Reparación, Registrar Refacciones y Ganancia Neta */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Terminar Reparación & Registrar Costos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="font-semibold text-foreground">
                {o.brand} {o.model}
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                <span className="font-medium text-foreground">Falla:</span> {o.reported_issue}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Total cobrado al cliente ($ USD) *</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={labor}
                onChange={(e) => setLabor(Number(e.target.value) || 0)}
                className="text-base font-semibold"
                placeholder="0.00"
              />
            </div>

            {/* SECCIÓN DIRECTA DE REFACCIONES / COSTOS (Visible siempre sin esconder) */}
            <div className="space-y-3 rounded-lg border p-3.5 bg-card">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                <Wrench className="h-4 w-4 text-primary" />
                <span>Refacciones / Repuestos Comprados</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Si compraste alguna pieza, ingresa cuánto te costó para que el sistema calcule tu
                ganancia neta. Si no compraste nada, déjalo en 0.
              </p>

              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre de la refacción (opcional)</Label>
                  <Input
                    placeholder="Ej. Pantalla OLED, Pin de carga, Batería…"
                    value={parts[0]?.name === "Refacción" ? "" : parts[0]?.name || ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      if (parts.length === 0) {
                        setParts([{ name, quantity: 1, unit_price_usd: 0 }]);
                      } else {
                        setParts([{ ...parts[0], name }]);
                      }
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Costo de compra de la refacción ($ USD)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00 si no compraste refacción"
                    value={parts[0]?.unit_price_usd || ""}
                    onChange={(e) => {
                      const cost = Number(e.target.value) || 0;
                      if (parts.length === 0) {
                        setParts([
                          { name: "Refacción comprada", quantity: 1, unit_price_usd: cost },
                        ]);
                      } else {
                        setParts([{ ...parts[0], unit_price_usd: cost }]);
                      }
                    }}
                    className="font-medium"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN DE GARANTÍA DEL SERVICIO */}
            {(() => {
              const resolvedWarranty =
                warrantyPreset === "custom"
                  ? Math.max(0, parseInt(customDays, 10) || 0)
                  : Number(warrantyPreset || 0);
              return (
                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>Garantía del Servicio</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        resolvedWarranty > 0
                          ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10 font-bold text-[11px]"
                          : "text-muted-foreground text-[11px]"
                      }
                    >
                      {resolvedWarranty > 0 ? `${resolvedWarranty} días` : "Sin garantía"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {[
                      { label: "Sin garantía", val: 0 },
                      { label: "15 días", val: 15 },
                      { label: "30 días", val: 30 },
                      { label: "60 días", val: 60 },
                      { label: "90 días", val: 90 },
                    ].map((p) => (
                      <Button
                        key={p.val}
                        type="button"
                        size="sm"
                        variant={warrantyPreset === p.val ? "default" : "outline"}
                        className="h-6 text-[11px] px-2"
                        onClick={() => {
                          setWarrantyPreset(p.val);
                          setCustomDays(String(p.val));
                        }}
                      >
                        {p.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant={warrantyPreset === "custom" ? "default" : "outline"}
                      className="h-6 text-[11px] px-2"
                      onClick={() => setWarrantyPreset("custom")}
                    >
                      Otro
                    </Button>
                  </div>

                  {warrantyPreset === "custom" && (
                    <div className="flex items-center gap-2 pt-1 border-t mt-1">
                      <Label className="text-xs shrink-0">Días personalizados:</Label>
                      <Input
                        type="number"
                        min="0"
                        max="365"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="h-7 text-xs w-20 font-bold"
                      />
                      <span className="text-[11px] text-muted-foreground">días</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Resumen de Ganancia en vivo */}
            {(() => {
              const partCost = Number(parts[0]?.unit_price_usd || 0);
              const netProfit = Math.max(0, Math.round((labor - partCost) * 100) / 100);
              const margin = labor > 0 ? Math.round((netProfit / labor) * 100) : 0;
              return (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cobro al cliente:</span>
                    <span className="font-semibold text-foreground">{usd(labor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo de refacción:</span>
                    <span className="font-semibold text-rose-500">-{usd(partCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-emerald-600 dark:text-emerald-400 pt-1 border-t border-emerald-500/20">
                    <span>Ganancia Neta:</span>
                    <span>
                      +{usd(netProfit)} ({margin}% margen)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={async () => {
                if (labor <= 0) return toast.error("Ingresa el total a cobrar al cliente");
                const partCost = Number(parts[0]?.unit_price_usd || 0);
                const hasPart =
                  partCost > 0 || (parts[0]?.name && parts[0]?.name.trim().length > 0);
                const partName = parts[0]?.name?.trim() || "Refacción comprada";
                const partsPayload = hasPart
                  ? [{ name: partName, quantity: 1, unit_price_usd: partCost }]
                  : [];
                const laborUsd = hasPart ? Math.max(0, labor - partCost) : labor;

                await run(
                  "save_repair_quote",
                  {
                    _order_id: o.id,
                    _labor: laborUsd,
                    _parts: partsPayload,
                    _skip_approval: true,
                    _note: hasPart ? `Refacción: ${partName} (Costo $${partCost})` : "Mano de obra",
                  },
                  "Cotización y refacciones guardadas",
                );

                if (hasPart && partCost > 0) {
                  const { data: dbParts } = await supabase
                    .from("repair_parts")
                    .select("id")
                    .eq("order_id", o.id);
                  if (dbParts && dbParts.length > 0) {
                    const last = dbParts[dbParts.length - 1];
                    try {
                      await run(
                        "consume_repair_part",
                        { _part_id: last.id },
                        "Refacción descontada",
                      );
                      await run(
                        "set_repair_part_cost",
                        { _part_id: last.id, _unit_cost: partCost },
                        "Costo registrado",
                      );
                    } catch (err) {
                      console.warn("Could not set part cost:", err);
                    }
                  }
                }

                // Registrar días de garantía técnica en observaciones
                const resolvedWarranty =
                  warrantyPreset === "custom"
                    ? Math.max(0, parseInt(customDays, 10) || 0)
                    : Number(warrantyPreset || 0);
                const newObservations = updateObservationsWithWarranty(
                  o.observations,
                  resolvedWarranty,
                );
                if (newObservations !== (o.observations || "")) {
                  await supabase
                    .from("repair_orders")
                    .update({ observations: newObservations })
                    .eq("id", o.id);
                }

                const warrantyNote =
                  resolvedWarranty > 0 ? `Garantía: ${resolvedWarranty} días.` : "Sin garantía.";
                await run(
                  "change_repair_status",
                  {
                    _order_id: o.id,
                    _status: "ready",
                    _note: `Reparación terminada. ${warrantyNote}`,
                  },
                  `Orden marcada como Lista para Entregar (${resolvedWarranty > 0 ? `${resolvedWarranty} días de garantía` : "sin garantía"})`,
                );
                setCompleteOpen(false);
              }}
            >
              Avanzar a Lista para Entregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Cobrar y Entregar */}
      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              Entregar Celular — {repairNumber(o.order_number)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3.5 text-xs space-y-1.5 bg-card">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total orden:</span>
                <span className="font-semibold">
                  {usd(Number(o.total_usd))} / {formatNIO(Number(o.total_usd) * rate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anticipo pagado:</span>
                <span className="font-semibold text-emerald-600">{usd(Number(o.paid_usd))}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1.5 border-t">
                <span>Saldo por cobrar:</span>
                <span className={balance > 0 ? "text-amber-500" : "text-emerald-500"}>
                  {usd(balance)} ({formatNIO(balance * rate)})
                </span>
              </div>
            </div>

            {balance > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Método de pago del saldo</Label>
                <Select value={deliverMethod} onValueChange={setDeliverMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash_usd">Efectivo USD (${balance.toFixed(2)})</SelectItem>
                    <SelectItem value="cash_nio">
                      Efectivo Córdobas (C$ {(balance * rate).toFixed(2)})
                    </SelectItem>
                    <SelectItem value="card">Tarjeta de débito/crédito</SelectItem>
                    <SelectItem value="transfer">Transferencia bancaria</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {!openCashSession &&
                  (deliverMethod === "cash_usd" || deliverMethod === "cash_nio")
                    ? "✓ Caja POS cerrada: el pago en efectivo se registrará directamente en el módulo de taller sin impedimentos."
                    : "El cobro se registrará en la orden y la finalizará automáticamente."}
                </p>
              </div>
            )}

            {balance === 0 && (
              <div className="rounded-md bg-emerald-500/10 p-3 text-center text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                ✓ Esta orden ya está 100% pagada. Solo resta entregar el equipo al cliente.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeliverOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-primary text-primary-foreground gap-1.5"
              onClick={async () => {
                if (balance > 0) {
                  const isCash = deliverMethod === "cash_usd" || deliverMethod === "cash_nio";
                  const cur = deliverMethod === "cash_nio" ? "NIO" : "USD";
                  const amt =
                    deliverMethod === "cash_nio" ? Math.round(balance * rate * 100) / 100 : balance;
                  const effectiveMethod = !openCashSession && isCash ? "transfer" : deliverMethod;

                  try {
                    await action.mutateAsync({
                      fn: "record_repair_payment",
                      args: {
                        _order_id: o.id,
                        _amount: amt,
                        _method: effectiveMethod,
                        _currency: cur,
                        _kind: "final",
                      },
                    });

                    if (!openCashSession && isCash) {
                      await supabase.from("repair_notes").insert({
                        tenant_id: o.tenant_id,
                        order_id: o.id,
                        note: `Pago de saldo recibido en efectivo en el taller: ${deliverMethod === "cash_nio" ? formatNIO(amt) : usd(amt)} (independiente de caja POS)`,
                      });
                    }
                  } catch (payErr: any) {
                    const errText = payErr?.message || "";
                    if (errText.includes("caja") || errText.includes("Abrí la caja") || isCash) {
                      console.warn(
                        "Caja POS cerrada. Registrando cobro independiente en el taller:",
                        payErr,
                      );
                      await action.mutateAsync({
                        fn: "record_repair_payment",
                        args: {
                          _order_id: o.id,
                          _amount: amt,
                          _method: "transfer",
                          _currency: cur,
                          _kind: "final",
                        },
                      });
                    } else {
                      return toast.error(errText);
                    }
                  }
                }
                await run(
                  "deliver_repair",
                  { _order_id: o.id },
                  "Equipo entregado al cliente con éxito",
                );
                setDeliverOpen(false);
              }}
            >
              <PackageCheck className="h-4 w-4" />{" "}
              {balance > 0 ? "Cobrar Saldo y Entregar" : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL MARCAR COMO FALLIDA / CANCELAR ORDEN */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Marcar como Fallida / No Reparable
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <div>
                <span className="font-semibold text-foreground">Equipo:</span> {o.brand} {o.model}
              </div>
              <div>
                <span className="font-semibold text-foreground">Falla original:</span>{" "}
                {o.reported_issue}
              </div>
              {data.customer?.name && (
                <div>
                  <span className="font-semibold text-foreground">Cliente:</span>{" "}
                  {data.customer.name}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Motivos frecuentes (haz clic para seleccionar):
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Placa base / procesador en corto circuito irreversible",
                  "Repuesto no disponible en el mercado nacional ni importación",
                  "Daño severo por agua / sulfatado irreparable",
                  "Riesgo crítico de rotura total al intentar desmontar",
                  "Costo de reparación excede el valor comercial del equipo",
                  "Memoria interna / procesador dañado físicamente",
                ].map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => setCancelReason(qr)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors text-left ${
                      cancelReason === qr
                        ? "bg-rose-500 text-white border-rose-500 font-medium"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Explicación del motivo para el cliente *
              </Label>
              <Textarea
                rows={3}
                placeholder="Explica qué se detectó en la placa, repuesto, circuito, etc…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Esta nota quedará guardada en el historial de la orden para que el cliente la
                conozca.
              </p>
            </div>

            {data.customer?.phone && cancelReason.trim() && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-2">
                <div className="text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="font-semibold flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Explicación lista para WhatsApp
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    Puedes notificar al cliente directamente
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shrink-0"
                >
                  <a
                    href={`https://wa.me/${data.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      buildRepairWhatsAppMessage({
                        order: { ...o, cancel_reason: cancelReason.trim() },
                        customerName: data.customer.name,
                        storeName: tenant?.name,
                        balanceUsd: balance,
                        rate: rate,
                      }),
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Enviar WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
              onClick={async () => {
                if (!cancelReason.trim())
                  return toast.error("Escribe o selecciona el motivo de la falla");
                await run(
                  "cancel_repair",
                  { _order_id: o.id, _reason: cancelReason.trim() },
                  "Reparación marcada como fallida / no reparable",
                );
                await supabase.from("repair_notes").insert({
                  tenant_id: o.tenant_id,
                  order_id: o.id,
                  note: `Reparación marcada como FALLIDA. Motivo: ${cancelReason.trim()}`,
                });
                setCancelOpen(false);
              }}
            >
              <XCircle className="h-4 w-4" /> Confirmar como Fallida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO CONFIRMACIÓN: Eliminar Orden de Reparación Entregada */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Eliminar Orden Entregada
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar permanentemente del sistema la orden{" "}
              <span className="font-bold text-foreground">{repairNumber(o.order_number)}</span> (
              {o.brand} {o.model})?
            </p>

            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Acción irreversible
              </div>
              <p>
                Esta acción eliminará de forma definitiva la orden, su historial de estados, pagos y
                notas registradas.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                setIsDeleting(true);
                try {
                  await deleteMutation.mutateAsync(o.id);
                  toast.success(`Orden ${repairNumber(o.order_number)} eliminada exitosamente.`);
                  navigate({ to: "/reparaciones" });
                } catch (err: any) {
                  toast.error(err?.message || "Error al eliminar la orden");
                  setIsDeleting(false);
                }
              }}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Eliminando…" : "Sí, eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
