import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Wrench,
  Play,
  CheckCircle2,
  PackageCheck,
  Clock,
  ArrowRight,
  Phone,
  MessageSquare,
  AlertCircle,
  DollarSign,
  TrendingUp,
  User,
  ShieldCheck,
  Check,
  Search,
  Coins,
  XCircle,
  AlertTriangle,
  Trash2,
  Eye,
  Printer,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";
import { useCustomers } from "@/hooks/use-credit";
import { useOpenCashSession } from "@/hooks/use-pos";
import { useLatestRate, formatNIO, formatUSD, usdToNio, nioToUsd } from "@/hooks/use-fiscal";
import {
  REPAIR_STATUSES,
  repairBalance,
  repairNumber,
  repairProfit,
  statusLabel,
  useRepairAction,
  useRepairOrders,
  useTechnicians,
  type RepairOrder,
  useDeleteRepairOrder,
  buildRepairWhatsAppMessage,
  extractWarrantyDays,
  updateObservationsWithWarranty,
} from "@/hooks/use-repairs";
import { encodeLock, PatternInput, type LockType } from "@/components/app/PatternLock";
import {
  PreviewRepairTicketDialog,
  OrderCreatedSuccessDialog,
  printRepairClaimTicket,
  type RepairTicketData,
} from "@/components/app/RepairClaimTicket";

export const Route = createFileRoute("/_authenticated/reparaciones")({
  head: () => ({
    meta: [
      { title: "Reparaciones — Nica-POS" },
      {
        name: "description",
        content: "Flujo por estaciones de reparación de celulares y cálculo de ganancia neta.",
      },
    ],
  }),
  component: RepairsLayout,
});

function RepairsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/reparaciones" && path !== "/reparaciones/") return <Outlet />;
  return <RepairsPage />;
}

const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;

// Estaciones del taller
type StationKey = "pending" | "in_process" | "ready" | "delivered" | "failed" | "all";

export function getOrderStation(
  status: string,
): "pending" | "in_process" | "ready" | "delivered" | "cancelled" {
  if (["received", "diagnosing", "waiting_approval"].includes(status)) return "pending";
  if (["in_repair", "waiting_parts"].includes(status)) return "in_process";
  if (status === "ready") return "ready";
  if (status === "delivered") return "delivered";
  return "cancelled";
}

function RepairsPage() {
  const { role, tenant } = useActiveTenant();
  const isAdmin = role === "owner" || role === "admin";
  const { data: orders = [], isLoading } = useRepairOrders();
  const { data: techs = [] } = useTechnicians();
  const { data: customers = [] } = useCustomers();
  const latestRate = useLatestRate();
  const rate = latestRate ?? 36.62;

  const [activeStation, setActiveStation] = useState<StationKey>("pending");
  const [q, setQ] = useState("");
  const [techFilter, setTechFilter] = useState("all");
  const [currencyView, setCurrencyView] = useState<"USD" | "NIO">("USD");
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  // Modales de avance de estación y eliminación
  const [assigningOrder, setAssigningOrder] = useState<RepairOrder | null>(null);
  const [completingOrder, setCompletingOrder] = useState<RepairOrder | null>(null);
  const [deliveringOrder, setDeliveringOrder] = useState<RepairOrder | null>(null);
  const [failingOrder, setFailingOrder] = useState<RepairOrder | null>(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<RepairOrder | null>(null);

  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const techName = (id: string | null) => {
    if (!id) return "Sin asignar";
    const found = techs.find((t) => t.id === id);
    if (!found) return "Sin asignar";
    const roleLabel =
      found.role === "owner" ? "Dueño" : found.role === "admin" ? "Admin" : "Técnico";
    return `${found.name} (${roleLabel})`;
  };

  // Formato monetario dinámico según moneda elegida (USD o Córdobas)
  const formatMoney = (usdVal: number) => {
    if (currencyView === "NIO") {
      return formatNIO(usdVal * rate);
    }
    return usd(usdVal);
  };

  // Conteo por estación
  const stationCounts = useMemo(() => {
    const counts = {
      pending: 0,
      in_process: 0,
      ready: 0,
      delivered: 0,
      failed: 0,
      all: orders.length,
    };
    orders.forEach((o) => {
      const st = getOrderStation(o.status);
      if (st === "cancelled") {
        counts.failed++;
      } else if (st in counts) {
        counts[st as keyof typeof counts]++;
      }
    });
    return counts;
  }, [orders]);

  // Filtrado de órdenes
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const st = getOrderStation(o.status);
      if (activeStation === "failed") {
        if (st !== "cancelled") return false;
      } else if (activeStation !== "all" && st !== activeStation) {
        return false;
      }
      if (techFilter !== "all" && o.technician_id !== techFilter) return false;
      if (q.trim()) {
        const c = custMap.get(o.customer_id);
        const hay = [
          repairNumber(o.order_number),
          o.imei,
          o.brand,
          o.model,
          o.reported_issue,
          o.cancel_reason,
          c?.name,
          c?.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, activeStation, techFilter, q, custMap]);

  // Métricas financieras exclusivas de reparaciones (SEPARADAS de las ventas del POS)
  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const totalRevenueUsd = validOrders.reduce((s, o) => s + Number(o.total_usd || 0), 0);
  const totalPartsUsd = validOrders.reduce((s, o) => s + Number(o.parts_cost_usd || 0), 0);
  const totalProfitUsd = validOrders.reduce((s, o) => s + repairProfit(o), 0);
  const totalPendingBalanceUsd = validOrders.reduce(
    (s, o) => s + (o.status !== "delivered" ? repairBalance(o) : 0),
    0,
  );
  const marginPct = totalRevenueUsd > 0 ? Math.round((totalProfitUsd / totalRevenueUsd) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Taller de Reparaciones</h1>
            <Badge variant="outline" className="text-xs">
              Finanzas independientes
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Flujo por estaciones: 1. Pendiente ➔ 2. En Proceso (asignar técnico) ➔ 3. Listo
            (refacción y ganancia) ➔ 4. Entregado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de moneda de visualización: USD / NIO */}
          <div className="flex items-center rounded-lg border bg-card p-1 text-xs">
            <button
              onClick={() => setCurrencyView("USD")}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                currencyView === "USD"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              $ USD
            </button>
            <button
              onClick={() => setCurrencyView("NIO")}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                currencyView === "NIO"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              C$ NIO
            </button>
          </div>

          {role !== "accountant" && (
            <Button onClick={() => setNewOrderOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva reparación
            </Button>
          )}
        </div>
      </div>

      {/* PANEL FINANCIERO EXCLUSIVO DE REPARACIONES (Separado de Ventas POS) */}
      <Card className="border border-primary/20 bg-card shadow-sm overflow-hidden">
        <div className="bg-primary/5 px-4 py-2.5 border-b border-primary/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-primary" />
            Finanzas del Taller de Reparaciones (Exclusivo, sin mezclar con Ventas POS)
          </div>
          <div className="text-muted-foreground">
            Tasa de cambio:{" "}
            <span className="font-semibold text-foreground">1 USD = C$ {rate.toFixed(2)}</span>
          </div>
        </div>
        <CardContent className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground block">Ingresos Taller</span>
            <span className="text-xl font-bold text-foreground block mt-1">
              {formatMoney(totalRevenueUsd)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {currencyView === "NIO" ? usd(totalRevenueUsd) : formatNIO(totalRevenueUsd * rate)}
            </span>
          </div>

          <div className="rounded-lg bg-rose-500/10 p-3">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium block">
              Costo de Refacciones
            </span>
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400 block mt-1">
              {formatMoney(totalPartsUsd)}
            </span>
            <span className="text-[11px] text-muted-foreground">Piezas compradas</span>
          </div>

          <div className="rounded-lg bg-emerald-500/10 p-3">
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold block flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ganancia Neta Taller
            </span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
              +{formatMoney(totalProfitUsd)}
            </span>
            <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
              {marginPct}% de margen
            </span>
          </div>

          <div className="rounded-lg bg-amber-500/10 p-3">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium block">
              Saldos por Cobrar
            </span>
            <span className="text-xl font-bold text-amber-700 dark:text-amber-400 block mt-1">
              {formatMoney(totalPendingBalanceUsd)}
            </span>
            <span className="text-[11px] text-muted-foreground">Pendiente de entrega</span>
          </div>
        </CardContent>
      </Card>

      {/* Navegación por Estaciones y Filtros */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={activeStation}
            onValueChange={(v) => setActiveStation(v as StationKey)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full sm:w-auto">
              <TabsTrigger value="pending" className="text-xs sm:text-sm">
                1. Pendientes{" "}
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px]">
                  {stationCounts.pending}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="in_process" className="text-xs sm:text-sm">
                2. En Proceso{" "}
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px]">
                  {stationCounts.in_process}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="ready" className="text-xs sm:text-sm">
                3. Listas{" "}
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px]">
                  {stationCounts.ready}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs sm:text-sm">
                4. Entregadas{" "}
                <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px]">
                  {stationCounts.delivered}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="failed"
                className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-medium"
              >
                Fallidas{" "}
                <Badge
                  variant="secondary"
                  className="ml-1.5 px-1 py-0 text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400"
                >
                  {stationCounts.failed}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                Todas
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar celular, cliente, IMEI…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
            {role !== "technician" && (
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="w-44 text-xs sm:text-sm">
                  <SelectValue placeholder="Técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los técnicos</SelectItem>
                  {techs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Lista de Órdenes en la Estación Actual */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Cargando reparaciones…
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="h-10 w-10 text-muted-foreground/60 mb-3" />
              <h3 className="font-semibold text-base">No hay reparaciones en esta estación</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {activeStation === "pending"
                  ? "No hay celulares pendientes. Puedes crear una nueva orden con el botón 'Nueva reparación'."
                  : activeStation === "in_process"
                    ? "No hay celulares en proceso actualmente. Inicia una orden desde 'Pendientes'."
                    : activeStation === "ready"
                      ? "No hay celulares listos para entregar en este momento."
                      : activeStation === "failed"
                        ? "No hay reparaciones marcadas como fallidas o no reparables."
                        : "No se encontraron reparaciones con los filtros seleccionados."}
              </p>
              {activeStation === "pending" && (
                <Button
                  onClick={() => setNewOrderOpen(true)}
                  variant="outline"
                  className="mt-4 gap-2"
                >
                  <Plus className="h-4 w-4" /> Crear orden
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((o) => {
              const cust = custMap.get(o.customer_id);
              const station = getOrderStation(o.status);
              const balanceUsd = repairBalance(o);
              const profitUsd = repairProfit(o);
              const partsCostUsd = Number(o.parts_cost_usd || 0);
              const totalUsd = Number(o.total_usd || 0);

              return (
                <Card
                  key={o.id}
                  className="relative flex flex-col justify-between overflow-hidden border shadow-xs hover:border-primary/50 transition-all"
                >
                  {/* Barra de color por estación */}
                  <div
                    className={`h-1.5 w-full ${
                      station === "pending"
                        ? "bg-amber-500"
                        : station === "in_process"
                          ? "bg-blue-500"
                          : station === "ready"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                    }`}
                  />

                  <CardContent className="p-4 space-y-3">
                    {/* Fila Superior: Número de Orden y Estado */}
                    <div className="flex items-center justify-between">
                      <Link
                        to="/reparaciones/$id"
                        params={{ id: o.id }}
                        className="font-bold text-base text-primary hover:underline flex items-center gap-1.5"
                      >
                        {repairNumber(o.order_number)}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({new Date(o.created_at).toLocaleDateString()})
                        </span>
                      </Link>

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

                    {/* Datos del Equipo */}
                    <div>
                      <div className="text-base font-semibold text-foreground">
                        {o.brand} {o.model} {o.color ? `· ${o.color}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        <span className="font-medium text-foreground">Falla:</span>{" "}
                        {o.reported_issue}
                      </div>
                      {o.imei && (
                        <div className="text-[11px] font-mono text-muted-foreground/80 mt-0.5">
                          IMEI: {o.imei}
                        </div>
                      )}

                      {/* Motivo de falla si no se pudo reparar */}
                      {o.cancel_reason && (
                        <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-2 text-xs text-rose-700 dark:text-rose-300 mt-2">
                          <div className="font-semibold flex items-center gap-1 text-[11px]">
                            <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" /> Motivo por el
                            que no se pudo reparar:
                          </div>
                          <div className="mt-0.5 text-foreground/90 font-medium text-xs">
                            {o.cancel_reason}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cliente y Teléfono */}
                    <div className="rounded-md bg-muted/40 p-2 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-medium">{cust?.name || "Cliente sin registrar"}</div>
                        {cust?.phone && <div className="text-muted-foreground">{cust.phone}</div>}
                      </div>
                      {cust?.phone && (
                        <div className="flex items-center gap-1">
                          <a
                            href={`https://wa.me/${cust.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              buildRepairWhatsAppMessage({
                                order: o,
                                customerName: cust.name,
                                storeName: tenant?.name,
                                balanceUsd: balanceUsd,
                                rate: rate,
                              }),
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded hover:bg-muted text-emerald-600 dark:text-emerald-400"
                            title="Avisar al cliente por WhatsApp (Mensaje profesional)"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </a>
                          <a
                            href={`tel:${cust.phone}`}
                            className="p-1 rounded hover:bg-muted text-primary"
                            title="Llamar"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Responsable / Técnico */}
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Responsable:</span>
                      <span
                        className={o.technician_id ? "font-medium" : "text-amber-500 font-medium"}
                      >
                        {techName(o.technician_id)}
                      </span>
                    </div>

                    {/* Resumen Financiero: Precio, Costo de Piezas y Ganancia Neta */}
                    <div className="border-t pt-2 grid grid-cols-3 gap-1 text-center text-xs">
                      <div className="bg-muted/30 rounded p-1.5">
                        <div className="text-[10px] text-muted-foreground">Total cliente</div>
                        <div className="font-semibold">{formatMoney(totalUsd)}</div>
                      </div>
                      <div className="bg-muted/30 rounded p-1.5">
                        <div className="text-[10px] text-muted-foreground">Costo piezas</div>
                        <div className="font-semibold text-rose-500">
                          {formatMoney(partsCostUsd)}
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 rounded p-1.5">
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Ganancia Neta
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(profitUsd)}
                        </div>
                      </div>
                    </div>

                    {/* Saldo pendiente (si aplica) */}
                    {balanceUsd > 0 && station !== "cancelled" && (
                      <div className="flex items-center justify-between text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                        <span>Saldo pendiente por cobrar:</span>
                        <span>{formatMoney(balanceUsd)}</span>
                      </div>
                    )}

                    {/* Botón de Acción Principal por Estación */}
                    <div className="pt-1">
                      {station === "pending" && (
                        <Button
                          className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                          onClick={() => setAssigningOrder(o)}
                        >
                          <Play className="h-3.5 w-3.5" /> Iniciar (Asignar Técnico)
                        </Button>
                      )}

                      {station === "in_process" && (
                        <div className="space-y-1.5">
                          <Button
                            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            size="sm"
                            onClick={() => setCompletingOrder(o)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Agregar Refacción & Pasar a
                            Lista
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                            size="sm"
                            onClick={() => setFailingOrder(o)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Marcar como Fallida / No Reparable
                          </Button>
                        </div>
                      )}

                      {station === "ready" && (
                        <Button
                          className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                          size="sm"
                          onClick={() => setDeliveringOrder(o)}
                        >
                          <PackageCheck className="h-3.5 w-3.5" />{" "}
                          {balanceUsd > 0 ? "Cobrar y Entregar" : "Entregar al Cliente"}
                        </Button>
                      )}

                      {station === "delivered" && (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" className="flex-1" size="sm" asChild>
                            <Link to="/reparaciones/$id" params={{ id: o.id }}>
                              Ver comprobante y detalle
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 px-2.5 shrink-0"
                              onClick={() => setDeleteConfirmOrder(o)}
                              title="Eliminar reparación entregada del sistema"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}

                      {station === "cancelled" && (
                        <div className="flex gap-2">
                          <Button variant="outline" className="w-full text-xs" size="sm" asChild>
                            <Link to="/reparaciones/$id" params={{ id: o.id }}>
                              Ver detalle completo
                            </Link>
                          </Button>
                          {cust?.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 shrink-0 px-2.5"
                              asChild
                              title="Avisar al cliente por WhatsApp"
                            >
                              <a
                                href={`https://wa.me/${cust.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                  buildRepairWhatsAppMessage({
                                    order: o,
                                    customerName: cust.name,
                                    storeName: tenant?.name,
                                    balanceUsd: balanceUsd,
                                    rate: rate,
                                  }),
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                              </a>
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 px-2.5 shrink-0"
                              onClick={() => setDeleteConfirmOrder(o)}
                              title="Eliminar orden fallida del sistema"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Iniciar Reparación y Asignar Responsable (Técnico o Admin) */}
      {assigningOrder && (
        <AssignTechnicianDialog
          order={assigningOrder}
          techs={techs}
          open={!!assigningOrder}
          onOpenChange={(v) => !v && setAssigningOrder(null)}
        />
      )}

      {/* MODAL 2: Terminar Reparación, Registrar Refacciones y Calcular Ganancia Neta */}
      {completingOrder && (
        <CompleteRepairDialog
          order={completingOrder}
          rate={rate}
          open={!!completingOrder}
          onOpenChange={(v) => !v && setCompletingOrder(null)}
        />
      )}

      {/* MODAL 3: Cobrar Saldo y Entregar al Cliente */}
      {deliveringOrder && (
        <DeliverRepairDialog
          order={deliveringOrder}
          rate={rate}
          open={!!deliveringOrder}
          onOpenChange={(v) => !v && setDeliveringOrder(null)}
        />
      )}

      {/* MODAL 4: Marcar Reparación como Fallida / No Reparable con Nota y Explicación */}
      {failingOrder && (
        <FailRepairDialog
          order={failingOrder}
          customer={custMap.get(failingOrder.customer_id)}
          storeName={tenant?.name}
          open={!!failingOrder}
          onOpenChange={(v) => !v && setFailingOrder(null)}
        />
      )}

      {/* MODAL 5: Eliminar Reparación Entregada (con confirmación de seguridad) */}
      {deleteConfirmOrder && (
        <DeleteRepairDialog
          order={deleteConfirmOrder}
          open={!!deleteConfirmOrder}
          onOpenChange={(v) => !v && setDeleteConfirmOrder(null)}
        />
      )}

      {/* MODAL CREAR NUEVA ORDEN (con selector de moneda C$ o $) */}
      <NewRepairDialog open={newOrderOpen} onOpenChange={setNewOrderOpen} rate={rate} />
    </div>
  );
}

// -------------------------------------------------------------
// MODAL: Eliminar Orden de Reparación Entregada
// -------------------------------------------------------------
function DeleteRepairDialog({
  order,
  open,
  onOpenChange,
}: {
  order: RepairOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const deleteMutation = useDeleteRepairOrder();

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteMutation.mutateAsync(order.id);
      toast.success(
        `Orden ${repairNumber(order.order_number)} eliminada correctamente del sistema.`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar la orden de reparación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Eliminar Orden de Reparación Entregada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <p className="text-muted-foreground">
            ¿Estás seguro de que deseas eliminar permanentemente del sistema la orden{" "}
            <span className="font-bold text-foreground">{repairNumber(order.order_number)}</span> (
            {order.brand} {order.model})?
          </p>

          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Acción irreversible
            </div>
            <p>
              Esta acción eliminará de forma definitiva la orden, su historial de estados, notas y
              registros asociados.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy} className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            {busy ? "Eliminando…" : "Sí, eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// MODAL: Marcar Reparación como Fallida / No Reparable
// -------------------------------------------------------------
function FailRepairDialog({
  order,
  customer,
  storeName,
  open,
  onOpenChange,
}: {
  order: RepairOrder;
  customer?: { name: string; phone: string | null } | null;
  storeName?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const action = useRepairAction();

  const QUICK_REASONS = [
    "Placa base / procesador en corto circuito irreversible",
    "Repuesto no disponible en el mercado nacional ni importación",
    "Daño severo por agua / sulfatado irreparable",
    "Riesgo crítico de rotura total al intentar desmontar",
    "Costo de reparación excede el valor comercial del equipo",
    "Memoria interna / procesador dañado físicamente",
  ];

  async function handleFail() {
    if (!reason.trim()) {
      return toast.error("Ingresa el motivo por el cual no se pudo reparar el equipo");
    }

    setBusy(true);
    try {
      await action.mutateAsync({
        fn: "cancel_repair",
        args: {
          _order_id: order.id,
          _reason: reason.trim(),
        },
      });

      await supabase.from("repair_notes").insert({
        tenant_id: order.tenant_id,
        order_id: order.id,
        note: `Reparación marcada como NO REPARABLE / FALLIDA. Motivo: ${reason.trim()}`,
      });

      toast.success(`Orden ${repairNumber(order.order_number)} marcada como no reparable.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al registrar la reparación fallida");
    } finally {
      setBusy(false);
    }
  }

  const whatsappText = encodeURIComponent(
    buildRepairWhatsAppMessage({
      order: { ...order, cancel_reason: reason.trim() },
      customerName: customer?.name,
      storeName: storeName,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <XCircle className="h-5 w-5" />
            Marcar Reparación como Fallida / No Reparable
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <div className="font-semibold text-foreground">
              {order.brand} {order.model} — {repairNumber(order.order_number)}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              <span className="font-medium text-foreground">Falla original:</span>{" "}
              {order.reported_issue}
            </div>
            {customer?.name && (
              <div className="text-muted-foreground text-xs mt-0.5">
                <span className="font-medium text-foreground">Cliente:</span> {customer.name}{" "}
                {customer.phone ? `(${customer.phone})` : ""}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Motivos frecuentes (haz clic para seleccionar):
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => setReason(qr)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors text-left ${
                    reason === qr
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
            <Label className="text-xs font-semibold">Explicación detallada para el cliente *</Label>
            <Textarea
              rows={3}
              placeholder="Explica qué se detectó en la placa, repuesto, circuito, etc…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Esta nota quedará guardada en el historial de la orden para que el equipo o cliente
              pueda consultarla.
            </p>
          </div>

          {customer?.phone && (
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
                  href={`https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${whatsappText}`}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleFail}
            disabled={busy || !reason.trim()}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            <XCircle className="h-4 w-4" /> {busy ? "Guardando…" : "Confirmar como Fallida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// MODAL: Asignar Técnico e Iniciar Reparación
// -------------------------------------------------------------
function AssignTechnicianDialog({
  order,
  techs,
  open,
  onOpenChange,
}: {
  order: RepairOrder;
  techs: { id: string; role: string; name: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [selectedTech, setSelectedTech] = useState(order.technician_id || "");
  const [busy, setBusy] = useState(false);
  const action = useRepairAction();

  async function handleStart() {
    if (!selectedTech) {
      return toast.error("Selecciona qué técnico o administrador va a realizar la reparación");
    }
    setBusy(true);
    try {
      // 1. Asignar técnico
      await action.mutateAsync({
        fn: "update_repair_order",
        args: { _order_id: order.id, _data: { technician_id: selectedTech } },
      });

      // 2. Si la orden no tiene cotización aprobada, asegurar una aprobación de base
      if (order.quote_status !== "approved") {
        await action.mutateAsync({
          fn: "save_repair_quote",
          args: {
            _order_id: order.id,
            _labor: Number(order.total_usd || 0),
            _parts: [],
            _skip_approval: true,
            _note: "Aprobación al iniciar en taller",
          },
        });
      }

      // 3. Cambiar a estado en reparación
      await action.mutateAsync({
        fn: "change_repair_status",
        args: { _order_id: order.id, _status: "in_repair", _note: "Reparación iniciada en taller" },
      });

      toast.success(`Orden ${repairNumber(order.order_number)} avanzada a En Proceso`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-500" />
            Iniciar Reparación — {repairNumber(order.order_number)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <div className="font-semibold text-foreground">
              {order.brand} {order.model}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              <span className="font-medium text-foreground">Falla:</span> {order.reported_issue}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">¿Quién va a realizar la reparación? *</Label>
            <p className="text-xs text-muted-foreground">
              Selecciona el técnico o el administrador responsable de este celular.
            </p>
            <Select value={selectedTech} onValueChange={setSelectedTech}>
              <SelectTrigger className="w-full">
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleStart}
            disabled={busy || !selectedTech}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Check className="h-4 w-4" /> {busy ? "Avanzando…" : "Pasar a En Proceso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// MODAL: Terminar Reparación, Registrar Refacciones y Ganancia Neta
// -------------------------------------------------------------
function CompleteRepairDialog({
  order,
  rate,
  open,
  onOpenChange,
}: {
  order: RepairOrder;
  rate: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [currency, setCurrency] = useState<"USD" | "NIO">("USD");
  const [totalChargedInput, setTotalChargedInput] = useState<string>(
    order.total_usd ? String(order.total_usd) : "0",
  );
  const [partName, setPartName] = useState("");
  const [partCostInput, setPartCostInput] = useState<string>("0");
  const [busy, setBusy] = useState(false);
  const action = useRepairAction();

  // Días de Garantía (por defecto 30 días o lo que ya tenga registrado)
  const existingWarranty = useMemo(
    () => extractWarrantyDays(order.observations),
    [order.observations],
  );
  const [warrantyPreset, setWarrantyPreset] = useState<number | "custom">(
    existingWarranty !== null ? existingWarranty : 30,
  );
  const [customDays, setCustomDays] = useState(
    String(existingWarranty !== null ? existingWarranty : 30),
  );

  const resolvedWarrantyDays = useMemo(() => {
    if (warrantyPreset === "custom") {
      return Math.max(0, parseInt(customDays, 10) || 0);
    }
    return Number(warrantyPreset || 0);
  }, [warrantyPreset, customDays]);

  // Convertir a USD para consistencia de cálculo interno
  const totalChargedUsd = useMemo(() => {
    const val = Number(totalChargedInput) || 0;
    return currency === "NIO" ? val / rate : val;
  }, [totalChargedInput, currency, rate]);

  const partCostUsd = useMemo(() => {
    const val = Number(partCostInput) || 0;
    return currency === "NIO" ? val / rate : val;
  }, [partCostInput, currency, rate]);

  const netProfitUsd = Math.max(0, Math.round((totalChargedUsd - partCostUsd) * 100) / 100);
  const profitMargin = totalChargedUsd > 0 ? Math.round((netProfitUsd / totalChargedUsd) * 100) : 0;

  async function handleFinish() {
    if (totalChargedUsd <= 0) {
      return toast.error("Ingresa el precio total a cobrar al cliente");
    }

    setBusy(true);
    try {
      const hasPart = partCostUsd > 0 || partName.trim().length > 0;
      const finalPartName = partName.trim() || "Refacción comprada";
      const laborUsd = hasPart ? Math.max(0, totalChargedUsd - partCostUsd) : totalChargedUsd;

      const partsPayload = hasPart
        ? [
            {
              name: finalPartName,
              quantity: 1,
              unit_price_usd: partCostUsd,
            },
          ]
        : [];

      // 1. Guardar cotización aprobada directamente con mano de obra y piezas
      await action.mutateAsync({
        fn: "save_repair_quote",
        args: {
          _order_id: order.id,
          _labor: laborUsd,
          _parts: partsPayload,
          _skip_approval: true,
          _note: hasPart
            ? `Refacción: ${finalPartName} (Costo $${partCostUsd.toFixed(2)})`
            : "Mano de obra completa",
        },
      });

      // 2. Si se agregó refacción con costo, registrar su costo unitario
      if (hasPart && partCostUsd > 0) {
        const { data: parts } = await supabase
          .from("repair_parts")
          .select("id")
          .eq("order_id", order.id);

        if (parts && parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          try {
            await action.mutateAsync({
              fn: "consume_repair_part",
              args: { _part_id: lastPart.id },
            });
            await action.mutateAsync({
              fn: "set_repair_part_cost",
              args: { _part_id: lastPart.id, _unit_cost: partCostUsd },
            });
          } catch (err) {
            console.warn("Could not set part cost through RPC:", err);
          }
        }
      }

      // 3. Registrar garantía técnica en las observaciones de la orden
      const newObservations = updateObservationsWithWarranty(
        order.observations,
        resolvedWarrantyDays,
      );
      if (newObservations !== (order.observations || "")) {
        await supabase
          .from("repair_orders")
          .update({ observations: newObservations })
          .eq("id", order.id);
      }

      // 4. Cambiar a estado Listo
      const warrantyNote =
        resolvedWarrantyDays > 0
          ? `Garantía otorgada: ${resolvedWarrantyDays} días.`
          : "Sin garantía.";
      await action.mutateAsync({
        fn: "change_repair_status",
        args: {
          _order_id: order.id,
          _status: "ready",
          _note: `Reparación terminada. ${warrantyNote} Ganancia neta: $${netProfitUsd.toFixed(2)}`,
        },
      });

      toast.success(
        `¡Reparación terminada! Lista para entregar (${resolvedWarrantyDays > 0 ? `${resolvedWarrantyDays} días de garantía` : "sin garantía"}, Ganancia: $${netProfitUsd.toFixed(2)})`,
      );
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              {order.brand} {order.model}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              <span className="font-medium text-foreground">Falla:</span> {order.reported_issue}
            </div>
          </div>

          {/* Selector de Moneda */}
          <div className="flex items-center justify-between rounded-lg border p-2 bg-muted/20">
            <span className="text-xs font-medium">Moneda para registrar cobro y costos:</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={currency === "USD" ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setCurrency("USD")}
              >
                $ USD
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currency === "NIO" ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setCurrency("NIO")}
              >
                C$ NIO
              </Button>
            </div>
          </div>

          {/* Precio total cobrado al cliente */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Total a cobrar al cliente ({currency === "USD" ? "$ USD" : "C$ Córdobas"}) *
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={totalChargedInput}
              onChange={(e) => setTotalChargedInput(e.target.value)}
              className="text-base font-semibold"
              placeholder="0.00"
            />
            {currency === "NIO" && Number(totalChargedInput) > 0 && (
              <p className="text-xs text-muted-foreground">Equivale a: {usd(totalChargedUsd)}</p>
            )}
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
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Costo de compra de la refacción ({currency === "USD" ? "$ USD" : "C$ Córdobas"})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00 si no compraste refacción"
                  value={partCostInput}
                  onChange={(e) => setPartCostInput(e.target.value)}
                  className="font-medium"
                />
                {currency === "NIO" && Number(partCostInput) > 0 && (
                  <p className="text-xs text-muted-foreground">Equivale a: {usd(partCostUsd)}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN DE GARANTÍA DEL SERVICIO */}
          <div className="space-y-2.5 rounded-lg border p-3.5 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Garantía del Servicio</span>
              </div>
              <Badge
                variant="outline"
                className={
                  resolvedWarrantyDays > 0
                    ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10 font-bold"
                    : "text-muted-foreground"
                }
              >
                {resolvedWarrantyDays > 0
                  ? `${resolvedWarrantyDays} días de garantía`
                  : "Sin garantía"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Define los días de respaldo para el cliente. Se plasmará en el comprobante y en los
              mensajes de WhatsApp.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "Sin garantía", val: 0 },
                { label: "15 días", val: 15 },
                { label: "30 días (1 mes)", val: 30 },
                { label: "60 días (2 meses)", val: 60 },
                { label: "90 días (3 meses)", val: 90 },
              ].map((p) => (
                <Button
                  key={p.val}
                  type="button"
                  size="sm"
                  variant={warrantyPreset === p.val ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
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
                className="h-7 text-xs px-2.5"
                onClick={() => setWarrantyPreset("custom")}
              >
                Otro
              </Button>
            </div>

            {warrantyPreset === "custom" && (
              <div className="flex items-center gap-2 pt-1 border-t mt-2">
                <Label className="text-xs font-semibold shrink-0">Días personalizados:</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="h-8 text-xs w-24 font-bold"
                  placeholder="Ej. 45"
                />
                <span className="text-xs text-muted-foreground">días de garantía</span>
              </div>
            )}
          </div>

          {/* TARJETA DE CÁLCULO DE GANANCIA NETA EN VIVO */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Cálculo de Ganancia Neta
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div>
                <div className="text-[10px] text-muted-foreground">Cobro al cliente</div>
                <div className="font-bold text-foreground text-sm">
                  {currency === "NIO"
                    ? formatNIO(Number(totalChargedInput) || 0)
                    : usd(totalChargedUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Costo refacción</div>
                <div className="font-bold text-rose-500 text-sm">
                  -{currency === "NIO" ? formatNIO(Number(partCostInput) || 0) : usd(partCostUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Ganancia Neta
                </div>
                <div className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                  +{currency === "NIO" ? formatNIO(netProfitUsd * rate) : usd(netProfitUsd)}
                </div>
              </div>
            </div>
            {totalChargedUsd > 0 && (
              <div className="text-center text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-1 border-t border-emerald-500/20">
                Margen de ganancia: {profitMargin}%{" "}
                {currency === "NIO"
                  ? `(≈ +${usd(netProfitUsd)})`
                  : `(≈ +${formatNIO(netProfitUsd * rate)})`}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleFinish}
            disabled={busy || totalChargedUsd <= 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <CheckCircle2 className="h-4 w-4" /> {busy ? "Guardando…" : "Listo para Entregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// MODAL: Cobrar y Entregar al Cliente
// -------------------------------------------------------------
function DeliverRepairDialog({
  order,
  rate,
  open,
  onOpenChange,
}: {
  order: RepairOrder;
  rate: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const balanceUsd = repairBalance(order);
  const [payMethod, setPayMethod] = useState("cash_usd");
  const [busy, setBusy] = useState(false);
  const action = useRepairAction();
  const { data: openCashSession } = useOpenCashSession();

  async function handleDeliver() {
    setBusy(true);
    try {
      // 1. Si hay saldo pendiente, registrar el cobro
      if (balanceUsd > 0) {
        const isCash = payMethod === "cash_usd" || payMethod === "cash_nio";
        const cur = payMethod === "cash_nio" ? "NIO" : "USD";
        const amt =
          payMethod === "cash_nio" ? Math.round(balanceUsd * rate * 100) / 100 : balanceUsd;
        // Si no hay sesión de caja POS abierta y el método es efectivo, usar 'transfer' para no disparar la restricción de caja POS
        const effectiveMethod = !openCashSession && isCash ? "transfer" : payMethod;

        try {
          await action.mutateAsync({
            fn: "record_repair_payment",
            args: {
              _order_id: order.id,
              _amount: amt,
              _method: effectiveMethod,
              _currency: cur,
              _kind: "final",
            },
          });

          if (!openCashSession && isCash) {
            await supabase.from("repair_notes").insert({
              tenant_id: order.tenant_id,
              order_id: order.id,
              note: `Pago de saldo recibido en efectivo en el taller: ${payMethod === "cash_nio" ? formatNIO(amt) : usd(amt)} (independiente de caja POS)`,
            });
          }
        } catch (payErr: any) {
          const errText = payErr?.message || "";
          if (errText.includes("caja") || errText.includes("Abrí la caja") || isCash) {
            console.warn("Caja POS cerrada. Registrando cobro independiente en el taller:", payErr);
            await action.mutateAsync({
              fn: "record_repair_payment",
              args: {
                _order_id: order.id,
                _amount: amt,
                _method: "transfer",
                _currency: cur,
                _kind: "final",
              },
            });
          } else {
            throw payErr;
          }
        }
      }

      // 2. Marcar como entregado
      await action.mutateAsync({
        fn: "deliver_repair",
        args: { _order_id: order.id },
      });

      toast.success(
        `¡Equipo entregado con éxito! Orden ${repairNumber(order.order_number)} finalizada.`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al entregar la orden");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Entregar Celular — {repairNumber(order.order_number)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <div className="font-semibold text-foreground">
              {order.brand} {order.model}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              <span className="font-medium text-foreground">Falla solucionada:</span>{" "}
              {order.reported_issue}
            </div>
          </div>

          <div className="rounded-lg border p-3.5 space-y-2 bg-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total de la reparación:</span>
              <span className="font-semibold">
                {usd(Number(order.total_usd))} / {formatNIO(Number(order.total_usd) * rate)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Anticipo ya pagado:</span>
              <span className="font-semibold text-emerald-600">{usd(Number(order.paid_usd))}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base font-bold">
              <span>Saldo a pagar ahora:</span>
              <span className={balanceUsd > 0 ? "text-amber-500" : "text-emerald-500"}>
                {usd(balanceUsd)} ({formatNIO(balanceUsd * rate)})
              </span>
            </div>
          </div>

          {balanceUsd > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Método de pago del saldo</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_usd">Efectivo USD (${balanceUsd.toFixed(2)})</SelectItem>
                  <SelectItem value="cash_nio">
                    Efectivo Córdobas (C$ {(balanceUsd * rate).toFixed(2)})
                  </SelectItem>
                  <SelectItem value="card">Tarjeta de débito/crédito</SelectItem>
                  <SelectItem value="transfer">Transferencia bancaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {balanceUsd === 0 && (
            <div className="rounded-md bg-emerald-500/10 p-3 text-center text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              ✓ Esta orden ya está 100% pagada. Solo resta entregar el equipo al cliente.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDeliver}
            disabled={busy}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <PackageCheck className="h-4 w-4" />{" "}
            {busy ? "Procesando…" : balanceUsd > 0 ? "Cobrar y Entregar" : "Confirmar Entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// MODAL: Nueva Orden de Reparación (Ingreso / Estación 1: Pendiente)
// Con selección explícita de moneda: Córdobas (C$) o Dólares ($)
// -------------------------------------------------------------
const BRANDS = [
  "Samsung",
  "Apple (iPhone)",
  "Xiaomi",
  "Motorola",
  "Huawei",
  "Honor",
  "Oppo",
  "Tecno",
  "Infinix",
  "ZTE",
  "Nokia",
  "LG",
  "Alcatel",
  "Otra",
];
const ISSUES = [
  "Pantalla rota / sin imagen",
  "Cambio de batería",
  "No carga / puerto dañado",
  "No enciende",
  "Daño por agua / mojado",
  "Cámara no funciona",
  "Sin audio / altavoz",
  "Micrófono",
  "Botones",
  "Software / se reinicia",
  "Desbloqueo de cuenta",
  "Falla de señal / WiFi",
  "Tapa trasera",
  "Otra",
];

function NewRepairDialog({
  open,
  onOpenChange,
  rate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rate: number;
}) {
  const { tenant } = useActiveTenant();
  const { branchId } = useActiveBranch();
  const { data: customers = [], refetch } = useCustomers();
  const action = useRepairAction();
  const { data: openCashSession } = useOpenCashSession();

  const empty = {
    name: "",
    phone: "",
    brand: "",
    brandText: "",
    model: "",
    color: "",
    imei: "",
    issue: "",
    issueText: "",
    details: "",
    accessories: "",
    delivery: "",
    cost: "",
    advance: "",
    method: "cash_usd",
  };
  const [f, setF] = useState(empty);
  const [orderCurrency, setOrderCurrency] = useState<"USD" | "NIO">("USD");
  const set = (k: keyof typeof empty) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const [lockType, setLockType] = useState<LockType>("none");
  const [lockText, setLockText] = useState("");
  const [pattern, setPattern] = useState<number[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    ticket: RepairTicketData;
    waMessage: string;
    phone: string;
  } | null>(null);

  const getQuickDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  function reset() {
    setF(empty);
    setOrderCurrency("USD");
    setLockType("none");
    setLockText("");
    setPattern([]);
    setFiles([]);
  }

  // Conversión automática a USD para base de datos
  const rawCost = Number(f.cost) || 0;
  const costUsd = orderCurrency === "NIO" ? rawCost / rate : rawCost;

  const rawAdvance = Number(f.advance) || 0;
  const advanceUsd = orderCurrency === "NIO" ? rawAdvance / rate : rawAdvance;

  const currentBrand = f.brandText.trim() || (f.brand !== "Otra" ? f.brand : "") || "Marca";
  const currentIssue =
    f.issueText.trim() || (f.issue !== "Otra" ? f.issue : "") || "Por diagnosticar";

  const previewTicketData: RepairTicketData = useMemo(
    () => ({
      storeName: tenant?.name || "NICA-POS",
      orderNumberText: "PRE-TICKET",
      dateText: new Date().toLocaleString(),
      customerName: f.name.trim() || "Cliente Particular",
      customerPhone: f.phone.trim() || undefined,
      deviceBrand: currentBrand,
      deviceModel: f.model.trim() || "Modelo no especificado",
      deviceColor: f.color.trim() || undefined,
      deviceImei: f.imei.trim() || undefined,
      reportedIssue: currentIssue,
      observations: f.details.trim() || undefined,
      accessories: f.accessories.trim() || undefined,
      deliveryDate: f.delivery || undefined,
      totalCostFormatted:
        rawCost > 0
          ? orderCurrency === "NIO"
            ? formatNIO(rawCost)
            : usd(costUsd)
          : "Por diagnosticar",
      advanceFormatted:
        rawAdvance > 0
          ? orderCurrency === "NIO"
            ? formatNIO(rawAdvance)
            : usd(advanceUsd)
          : "$0.00",
      balanceFormatted:
        rawCost - rawAdvance > 0
          ? orderCurrency === "NIO"
            ? formatNIO(rawCost - rawAdvance)
            : usd(Math.max(0, costUsd - advanceUsd))
          : "$0.00",
      currency: orderCurrency,
      isPreliminary: true,
    }),
    [
      tenant,
      f,
      rawCost,
      rawAdvance,
      costUsd,
      advanceUsd,
      orderCurrency,
      currentBrand,
      currentIssue,
    ],
  );

  async function submit() {
    if (!tenant || !branchId) return toast.error("Selecciona una sucursal");
    const b = f.brandText.trim() || (f.brand !== "Otra" ? f.brand : "");
    const i = f.issueText.trim() || (f.issue !== "Otra" ? f.issue : "");
    if (!f.name.trim() || !b || !f.model.trim() || !i)
      return toast.error("Completa cliente, marca, modelo y falla");
    if (lockType === "pattern" && pattern.length < 4)
      return toast.error("El patrón debe tener al menos 4 puntos");
    if ((lockType === "pin" || lockType === "password") && !lockText)
      return toast.error("Escribe el código de bloqueo");
    if (rawAdvance > 0 && rawCost <= 0)
      return toast.error("Indica el costo de la reparación antes del anticipo");
    if (rawAdvance > rawCost) return toast.error("El anticipo no puede superar el costo total");

    setBusy(true);
    try {
      const phone = f.phone.trim();
      let customerId = phone ? customers.find((c) => c.phone === phone)?.id : undefined;
      if (!customerId) {
        const { data: c, error } = await supabase
          .from("customers")
          .insert({ tenant_id: tenant.id, name: f.name.trim(), phone: phone || null })
          .select("id")
          .single();
        if (error) throw error;
        customerId = c.id;
        refetch();
      }

      const photo_paths: string[] = [];
      for (const file of files) {
        const path = `${tenant.id}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
        const up = await supabase.storage.from("repair-photos").upload(path, file);
        if (up.error) throw up.error;
        photo_paths.push(path);
      }

      const code = encodeLock(lockType, lockText, pattern);
      const o = (await action.mutateAsync({
        fn: "create_repair_order",
        args: {
          _branch_id: branchId,
          _customer_id: customerId,
          _unlock_code: code || undefined,
          _data: {
            brand: b,
            model: f.model.trim(),
            reported_issue: i,
            photo_paths,
            color: f.color,
            imei: f.imei,
            accessories: f.accessories,
            observations: f.details,
            estimated_delivery: f.delivery,
          },
        },
      })) as RepairOrder;

      if (costUsd > 0) {
        await action.mutateAsync({
          fn: "save_repair_quote",
          args: {
            _order_id: o.id,
            _labor: Math.round(costUsd * 100) / 100,
            _parts: [],
            _skip_approval: true,
            _note: `Pactado al ingreso en ${orderCurrency}: ${orderCurrency === "NIO" ? formatNIO(rawCost) : usd(rawCost)}`,
          },
        });
      }

      if (rawAdvance > 0) {
        const isCash = f.method === "cash_usd" || f.method === "cash_nio";
        const effectiveMethod = !openCashSession && isCash ? "transfer" : f.method;
        try {
          await action.mutateAsync({
            fn: "record_repair_payment",
            args: {
              _order_id: o.id,
              _amount: rawAdvance,
              _method: effectiveMethod,
              _currency: orderCurrency,
              _kind: "advance",
            },
          });
        } catch (payErr: any) {
          const errText = payErr?.message || "";
          if (errText.includes("caja") || errText.includes("Abrí la caja") || isCash) {
            await action.mutateAsync({
              fn: "record_repair_payment",
              args: {
                _order_id: o.id,
                _amount: rawAdvance,
                _method: "transfer",
                _currency: orderCurrency,
                _kind: "advance",
              },
            });
          } else {
            throw payErr;
          }
        }

        if (!openCashSession && isCash) {
          await supabase.from("repair_notes").insert({
            tenant_id: tenant.id,
            order_id: o.id,
            note: `Anticipo recibido en efectivo en el taller: ${orderCurrency === "NIO" ? formatNIO(rawAdvance) : usd(advanceUsd)} (independiente de caja POS)`,
          });
        }
      }

      // Preparar ticket final y mensaje de WhatsApp para el cliente
      const ticketInfo: RepairTicketData = {
        storeName: tenant.name || "NICA-POS",
        orderNumber: o.order_number,
        orderNumberText: repairNumber(o.order_number),
        dateText: new Date().toLocaleString(),
        customerName: f.name.trim(),
        customerPhone: f.phone.trim() || undefined,
        deviceBrand: b,
        deviceModel: f.model.trim(),
        deviceColor: f.color.trim() || undefined,
        deviceImei: f.imei.trim() || undefined,
        reportedIssue: i,
        observations: f.details.trim() || undefined,
        accessories: f.accessories.trim() || undefined,
        deliveryDate: f.delivery ? f.delivery : undefined,
        totalCostFormatted: orderCurrency === "NIO" ? formatNIO(rawCost) : usd(costUsd),
        advanceFormatted:
          rawAdvance > 0
            ? orderCurrency === "NIO"
              ? formatNIO(rawAdvance)
              : usd(advanceUsd)
            : "$0.00",
        balanceFormatted:
          rawCost - rawAdvance > 0
            ? orderCurrency === "NIO"
              ? formatNIO(rawCost - rawAdvance)
              : usd(Math.max(0, costUsd - advanceUsd))
            : "$0.00",
        currency: orderCurrency,
        isPreliminary: false,
      };

      const waMsg = buildRepairWhatsAppMessage({
        order: {
          ...o,
          brand: b,
          model: f.model.trim(),
          reported_issue: i,
          estimated_delivery: f.delivery,
          total_usd: costUsd,
          paid_usd: advanceUsd,
        },
        customerName: f.name.trim(),
        storeName: tenant.name,
        balanceUsd: Math.max(0, costUsd - advanceUsd),
        rate,
      });

      toast.success(`Orden ${repairNumber(o.order_number)} creada con éxito`);
      setSuccessData({ ticket: ticketInfo, waMessage: waMsg, phone: f.phone.trim() });
      setSuccessOpen(true);
      setPreviewOpen(false);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Ingresar Celular a Reparación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nombre del cliente *</Label>
                <Input
                  value={f.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="Ej. Juan López"
                />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input
                  inputMode="tel"
                  value={f.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="Ej. 8888-8888"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Marca *</Label>
                <Select value={f.brand} onValueChange={set("brand")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige la marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANDS.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {f.brand === "Otra" && (
                  <Input
                    placeholder="Escribe la marca…"
                    value={f.brandText}
                    onChange={(e) => set("brandText")(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Modelo *</Label>
                <Input
                  value={f.model}
                  onChange={(e) => set("model")(e.target.value)}
                  placeholder="Ej. Galaxy A54, iPhone 13"
                />
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    placeholder="Color"
                    value={f.color}
                    onChange={(e) => set("color")(e.target.value)}
                  />
                  <Input
                    placeholder="IMEI (opcional)"
                    value={f.imei}
                    onChange={(e) => set("imei")(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Falla reportada *</Label>
              <Select value={f.issue} onValueChange={set("issue")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la falla principal" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {f.issue === "Otra" && (
                <Input
                  placeholder="Describe la falla…"
                  value={f.issueText}
                  onChange={(e) => set("issueText")(e.target.value)}
                  className="mt-1"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label>Detalles / Observaciones físicas</Label>
              <Textarea
                placeholder="Rayones, pantalla estrellada, golpe en la esquina, etc."
                value={f.details}
                onChange={(e) => set("details")(e.target.value)}
              />
            </div>

            {/* SELECTOR DE MONEDA: Córdobas (C$) o Dólares ($) */}
            <div className="rounded-lg border p-3.5 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Moneda del presupuesto y cobro *</Label>
                  <p className="text-xs text-muted-foreground">
                    Elige si cobrarás en Córdobas o en Dólares.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={orderCurrency === "NIO" ? "default" : "outline"}
                    onClick={() => {
                      setOrderCurrency("NIO");
                      set("method")("cash_nio");
                    }}
                    className="gap-1 font-semibold"
                  >
                    C$ Córdobas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={orderCurrency === "USD" ? "default" : "outline"}
                    onClick={() => {
                      setOrderCurrency("USD");
                      set("method")("cash_usd");
                    }}
                    className="gap-1 font-semibold"
                  >
                    $ Dólares
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Precio pactado ({orderCurrency === "NIO" ? "C$" : "$"})
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={f.cost}
                    onChange={(e) => set("cost")(e.target.value)}
                    placeholder="0.00"
                    className="font-semibold"
                  />
                  {orderCurrency === "NIO" && rawCost > 0 && (
                    <p className="text-[11px] text-muted-foreground">≈ {usd(costUsd)}</p>
                  )}
                  {orderCurrency === "USD" && rawCost > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      ≈ {formatNIO(rawCost * rate)}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Anticipo ({orderCurrency === "NIO" ? "C$" : "$"})
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={f.advance}
                    onChange={(e) => set("advance")(e.target.value)}
                    placeholder="0.00"
                  />
                  {orderCurrency === "NIO" && rawAdvance > 0 && (
                    <p className="text-[11px] text-muted-foreground">≈ {usd(advanceUsd)}</p>
                  )}
                </div>
              </div>

              {/* SELECCIÓN ÁGIL DE FECHA DE ENTREGA */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Fecha estimada de entrega</span>
                  </div>
                  {f.delivery && (
                    <button
                      type="button"
                      onClick={() => set("delivery")("")}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      Limpiar fecha
                    </button>
                  )}
                </div>

                {/* Atajos ágiles rápidos */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-muted-foreground mr-0.5">Atajos rápidos:</span>
                  {[
                    { label: "Hoy", days: 0 },
                    { label: "Mañana", days: 1 },
                    { label: "En 2 días", days: 2 },
                    { label: "En 3 días", days: 3 },
                    { label: "1 semana", days: 7 },
                    { label: "2 semanas", days: 14 },
                  ].map((q) => {
                    const qDate = getQuickDate(q.days);
                    const isSel = f.delivery === qDate;
                    return (
                      <Button
                        key={q.label}
                        type="button"
                        size="sm"
                        variant={isSel ? "default" : "outline"}
                        className="h-6 text-[11px] px-2 font-medium"
                        onClick={() => set("delivery")(qDate)}
                      >
                        {q.label}
                      </Button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <Input
                    type="date"
                    value={f.delivery}
                    onChange={(e) => set("delivery")(e.target.value)}
                    className="h-8 text-xs font-medium max-w-[200px]"
                  />
                  {f.delivery && (
                    <Badge variant="secondary" className="font-normal text-xs">
                      Prometido: {f.delivery}
                    </Badge>
                  )}
                </div>
              </div>

              {rawAdvance > 0 && (
                <div className="space-y-1 pt-2 border-t">
                  <Label className="text-xs">Forma de pago del anticipo</Label>
                  <Select value={f.method} onValueChange={set("method")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash_nio">Efectivo Córdobas (C$)</SelectItem>
                      <SelectItem value="cash_usd">Efectivo USD ($)</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">
                    Saldo pendiente:{" "}
                    {orderCurrency === "NIO"
                      ? formatNIO(Math.max(0, rawCost - rawAdvance))
                      : usd(Math.max(0, rawCost - rawAdvance))}
                  </p>
                </div>
              )}
            </div>

            {/* Bloqueo / Patrón */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Código o Patrón de desbloqueo (opcional)
              </Label>
              <Select
                value={lockType}
                onValueChange={(v) => {
                  setLockType(v as LockType);
                  setLockText("");
                  setPattern([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin bloqueo</SelectItem>
                  <SelectItem value="pin">PIN numérico</SelectItem>
                  <SelectItem value="pattern">Patrón gráfico</SelectItem>
                  <SelectItem value="password">Contraseña</SelectItem>
                </SelectContent>
              </Select>
              {lockType === "pin" && (
                <Input
                  inputMode="numeric"
                  placeholder="Ingresa el PIN"
                  value={lockText}
                  onChange={(e) => setLockText(e.target.value.replace(/\D/g, ""))}
                />
              )}
              {lockType === "password" && (
                <Input
                  placeholder="Contraseña de desbloqueo"
                  value={lockText}
                  onChange={(e) => setLockText(e.target.value)}
                />
              )}
              {lockType === "pattern" && <PatternInput value={pattern} onChange={setPattern} />}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              className="gap-1.5 border-dashed"
            >
              <Eye className="h-4 w-4 text-primary" /> Ver Vista Previa del Ticket
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={busy} className="gap-2">
                <Plus className="h-4 w-4" /> {busy ? "Guardando…" : "Ingresar a Pendientes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vista Previa del Ticket antes de confirmar */}
      <PreviewRepairTicketDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        ticketData={previewTicketData}
        onConfirmOrder={submit}
        confirmBusy={busy}
      />

      {/* Modal de Éxito: Imprimir comprobante o enviar por WhatsApp */}
      <OrderCreatedSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        ticketData={successData?.ticket || null}
        whatsappMessage={successData?.waMessage}
        phone={successData?.phone}
      />
    </>
  );
}
