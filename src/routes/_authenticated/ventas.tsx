import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Eye, Trash2, Ban, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";
import { useFiscalSettings, formatUSD, formatNIO } from "@/hooks/use-fiscal";
import { useVoidSale } from "@/hooks/use-pos";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { printDocument } from "@/lib/desktop-print";

export const Route = createFileRoute("/_authenticated/ventas")({
  component: SalesHistoryPage,
  head: () => ({ meta: [{ title: "Historial de ventas — Nica-POS" }] }),
});

const PAYMENT_LABELS: Record<string, string> = {
  cash_nio: "Efectivo C$",
  cash_usd: "Efectivo $",
  card: "Tarjeta",
  transfer: "Transferencia",
};

type SaleRow = {
  id: string;
  sale_number: number;
  subtotal_usd: number;
  tax_usd: number;
  total_usd: number;
  exchange_rate: number;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  sold_by: string | null;
  branches?: { name: string } | null;

  sale_items: {
    name: string;
    quantity: number;
    unit_price_usd: number;
    tax_usd: number;
    line_total_usd: number;
  }[];
  sale_payments: { method: string; amount: number; currency: string }[];
};

function SalesHistoryPage() {
  const { tenant, role } = useActiveTenant();
  const { scopeBranchId, scopeKey } = useActiveBranch();
  const { data: fiscal } = useFiscalSettings();
  const qc = useQueryClient();
  const voidSale = useVoidSale();
  const canDelete = role === "owner" || role === "admin";
  const canVoid = !!role && role !== "cashier";

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SaleRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SaleRow | null>(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["ventas-history", tenant?.id, scopeKey],
    enabled: !!tenant && !!scopeKey,
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select(
          "id, sale_number, subtotal_usd, tax_usd, total_usd, exchange_rate, created_at, voided_at, void_reason, sold_by, branches(name), sale_items(name, quantity, unit_price_usd, tax_usd, line_total_usd), sale_payments(method, amount, currency)",
        )
        .eq("tenant_id", tenant!.id);
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(300);

      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const sellerIds = useMemo(
    () => Array.from(new Set((sales ?? []).map((s) => s.sold_by).filter(Boolean))) as string[],
    [sales],
  );

  const { data: sellers } = useQuery({
    queryKey: ["ventas-sellers", tenant?.id, sellerIds.join(",")],
    enabled: sellerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", sellerIds);
      if (error) throw error;
      const map: Record<string, { name: string; email: string | null }> = {};
      for (const p of data ?? []) {
        map[p.id] = { name: p.full_name ?? p.email ?? "—", email: p.email };
      }
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales ?? [];
    return (sales ?? []).filter((s) => {
      if (String(s.sale_number).includes(q)) return true;
      const seller = sellers?.[s.sold_by ?? ""]?.name.toLowerCase() ?? "";
      return seller.includes(q);
    });
  }, [sales, search, sellers]);

  async function handleVoid(sale: SaleRow) {
    const reason = window.prompt(
      `¿Anular venta #${sale.sale_number}?\n\nSe devolverá el stock al inventario y se eliminará la cuenta por cobrar si era a crédito.\n\nMotivo (opcional):`,
      "",
    );
    if (reason === null) return;
    try {
      await voidSale.mutateAsync({ saleId: sale.id, reason: reason || undefined });
      toast.success(`Venta #${sale.sale_number} anulada`);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["ventas-history", tenant?.id] });
    } catch (e) {
      toast.error("No se pudo anular", { description: getFriendlyErrorMessage(e) });
    }
  }

  async function handleDelete(sale: SaleRow) {
    try {
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;
      toast.success(`Venta #${sale.sale_number} eliminada del historial`);
      setConfirmDelete(null);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["ventas-history", tenant?.id] });
    } catch (e) {
      toast.error("No se pudo eliminar", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Historial de ventas</h1>
          <p className="text-muted-foreground">
            Consulta el detalle, reimprime la factura o anula ventas registradas.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por # o cajero…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas 300 ventas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando ventas…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Todavía no hay ventas registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Venta #</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Cajero</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const isCredit = (s.sale_payments?.length ?? 0) === 0;
                    const isVoided = !!s.voided_at;
                    const seller = sellers?.[s.sold_by ?? ""]?.name ?? "—";
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 pr-3 font-medium tabular-nums">
                          #{s.sale_number}
                          {!scopeBranchId && s.branches?.name && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                              {s.branches.name}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 pr-3 text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("es-NI")}
                        </td>
                        <td className="py-2.5 pr-3">{seller}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums font-semibold">
                          {formatUSD(Number(s.total_usd))}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant={isCredit ? "outline" : "secondary"}>
                            {isCredit ? "Crédito" : "Contado"}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3">
                          {isVoided ? (
                            <Badge variant="destructive">Anulada</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground">Activa</Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelected(s)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SaleDetailDialog
        sale={selected}
        onClose={() => setSelected(null)}
        sellerName={selected ? (sellers?.[selected.sold_by ?? ""]?.name ?? "—") : ""}
        tenantName={tenant?.name ?? ""}
        tenantRuc={tenant?.ruc ?? null}
        logoUrl={((fiscal as any)?.show_logo ?? true) ? (tenant?.logo_url ?? null) : null}
        primaryColor={tenant?.primary_color ?? "#f59e0b"}
        settings={fiscal}
        canVoid={canVoid}
        canDelete={canDelete}
        onVoid={handleVoid}
        onDelete={(s) => setConfirmDelete(s)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar venta permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la venta #{confirmDelete?.sale_number} del historial junto con sus líneas
              y pagos. Esta acción no se puede deshacer. La venta debe estar <b>anulada</b> primero
              (para revertir stock y créditos).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

function SaleDetailDialog({
  sale,
  onClose,
  sellerName,
  tenantName,
  tenantRuc,
  logoUrl,
  primaryColor,
  settings,
  canVoid,
  canDelete,
  onVoid,
  onDelete,
}: {
  sale: SaleRow | null;
  onClose: () => void;
  sellerName: string;
  tenantName: string;
  tenantRuc: string | null;
  logoUrl: string | null;
  primaryColor: string;
  settings: any;
  canVoid: boolean;
  canDelete: boolean;
  onVoid: (s: SaleRow) => void;
  onDelete: (s: SaleRow) => void;
}) {
  const s = settings ?? {};
  const legalName = s.legal_name || tenantName;
  const thankYou = s.thank_you_message || "¡Gracias por su compra!";

  function doPrint() {
    // Reimprime facturas usando la impresora carta configurada en el equipo.
    void printDocument("carta");
  }

  if (!sale) return null;
  const isCredit = (sale.sale_payments?.length ?? 0) === 0;
  const isVoided = !!sale.voided_at;
  const rate = Number(sale.exchange_rate ?? 0);
  const createdAt = new Date(sale.created_at);

  return (
    <Dialog open={!!sale} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #history-receipt, #history-receipt * { visibility: visible !important; }
            #history-receipt { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            @page { size: letter; margin: 12mm; }
          }
        `}</style>
        <DialogHeader className="no-print">
          <DialogTitle>
            Venta #{sale.sale_number}{" "}
            {isVoided && <span className="text-destructive">(ANULADA)</span>}
          </DialogTitle>
          <DialogDescription>
            {createdAt.toLocaleString("es-NI")} · Cajero: {sellerName}
          </DialogDescription>
        </DialogHeader>

        <div
          id="history-receipt"
          className="mx-auto max-h-[65vh] w-full overflow-auto rounded border bg-white p-6 text-[13px] text-black"
        >
          <div className="flex items-start justify-between border-b border-black/20 pb-3">
            <div className="flex items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" />}
              <div>
                <div className="text-lg font-bold uppercase" style={{ color: primaryColor }}>
                  {legalName}
                </div>
                {tenantRuc && <div className="text-xs">RUC: {tenantRuc}</div>}
                {s.address && <div className="text-xs">{s.address}</div>}
                {s.phone && <div className="text-xs">Tel: {s.phone}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold">
                FACTURA {isCredit ? "DE CRÉDITO" : "DE CONTADO"}
              </div>
              <div className="text-xs">Venta #{sale.sale_number}</div>
              <div className="text-xs">{createdAt.toLocaleString("es-NI")}</div>
              <div className="text-xs">Cajero: {sellerName}</div>
              {isVoided && (
                <div className="mt-1 inline-block rounded border-2 border-red-600 px-2 py-0.5 text-xs font-black uppercase text-red-600">
                  Anulada
                </div>
              )}
            </div>
          </div>

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-black/30 text-left">
                <th className="py-1.5">Cant.</th>
                <th className="py-1.5">Descripción</th>
                <th className="py-1.5 text-right">P. Unit.</th>
                <th className="py-1.5 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {sale.sale_items.map((l, i) => (
                <tr key={i} className="border-b border-black/10">
                  <td className="py-1.5">{Number(l.quantity)}</td>
                  <td className="py-1.5">{l.name}</td>
                  <td className="py-1.5 text-right">{formatUSD(Number(l.unit_price_usd))}</td>
                  <td className="py-1.5 text-right">{formatUSD(Number(l.line_total_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatUSD(Number(sale.subtotal_usd))}</span>
            </div>
            {Number(sale.tax_usd) > 0 && (
              <div className="flex justify-between">
                <span>IVA</span>
                <span>{formatUSD(Number(sale.tax_usd))}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>TOTAL</span>
              <span>{formatUSD(Number(sale.total_usd))}</span>
            </div>
            {rate > 0 && (
              <div className="flex justify-between text-xs opacity-70">
                <span>TOTAL C$</span>
                <span>{formatNIO(Number(sale.total_usd) * rate)}</span>
              </div>
            )}
          </div>

          <div className="mt-4 border-t pt-2 text-sm">
            {isCredit ? (
              <div className="text-center font-bold">*** PENDIENTE DE PAGO — CRÉDITO ***</div>
            ) : (
              <div className="space-y-0.5">
                <div className="font-semibold">Pagos:</div>
                {sale.sale_payments.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
                    <span>
                      {p.currency === "USD"
                        ? formatUSD(Number(p.amount))
                        : formatNIO(Number(p.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {rate > 0 && (
            <div className="mt-2 text-center text-xs">Tasa: C$ {rate.toFixed(4)} / US$1</div>
          )}
          {isVoided && sale.void_reason && (
            <div className="mt-2 text-center text-xs text-red-600">
              Motivo de anulación: {sale.void_reason}
            </div>
          )}
          <div className="mt-3 whitespace-pre-line text-center text-xs">{thankYou}</div>
        </div>

        <DialogFooter className="no-print flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {canVoid && !isVoided && (
              <Button variant="outline" onClick={() => onVoid(sale)}>
                <Ban className="mr-2 h-4 w-4" /> Anular venta
              </Button>
            )}
            {canDelete && isVoided && (
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(sale)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar del historial
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={doPrint}>
              <Printer className="mr-2 h-4 w-4" /> Reimprimir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
