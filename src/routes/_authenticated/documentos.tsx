import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Printer, FileSearch } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant } from "@/hooks/use-tenant";
import {
  useFiscalSettings,
  useLatestRate,
  computeTaxes,
  usdToNio,
  formatNIO,
  formatUSD,
} from "@/hooks/use-fiscal";

export const Route = createFileRoute("/_authenticated/documentos")({
  component: DocumentsPage,
  head: () => ({ meta: [{ title: "Documentos — Nica-POS" }] }),
});

type DocType = "ticket" | "factura" | "proforma";
interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitUsd: number;
  taxable: boolean;
}

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", qty: 1, unitUsd: 0, taxable: true };
}

function DocumentsPage() {
  const queryClient = useQueryClient();
  const { tenant } = useActiveTenant();
  const { data: settings } = useFiscalSettings();
  const rate = useLatestRate();
  const [docType, setDocType] = useState<DocType>("ticket");
  const [customer, setCustomer] = useState("");
  const [customerRuc, setCustomerRuc] = useState("");
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [loadOpen, setLoadOpen] = useState(false);


  const recentSales = useQuery({
    queryKey: ["documentos-recent-sales", tenant?.id],
    enabled: !!tenant && loadOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, total_usd, created_at")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function loadSale(saleId: string) {
    try {
      const { data, error } = await supabase
        .from("sale_items")
        .select("name, quantity, unit_price_usd, tax_usd")
        .eq("sale_id", saleId);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("Esa venta no tiene líneas");
        return;
      }
      setItems(
        data.map((it) => ({
          id: crypto.randomUUID(),
          description: it.name,
          qty: Number(it.quantity),
          unitUsd: Number(it.unit_price_usd),
          taxable: Number(it.tax_usd) > 0,
        })),
      );
      setLoadOpen(false);
      toast.success("Venta cargada al documento");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  const ivaRate = settings ? Number(settings.iva_rate) : 0.15;
  const ivaEnabled = settings?.iva_enabled ?? true;
  const irRate = settings ? Number(settings.ir_rate) : 0.02;
  const irEnabled = settings?.ir_enabled ?? false;

  const breakdown = useMemo(() => {
    const taxable = items.filter((i) => i.taxable).reduce((s, i) => s + i.qty * i.unitUsd, 0);
    const exempt = items.filter((i) => !i.taxable).reduce((s, i) => s + i.qty * i.unitUsd, 0);
    return computeTaxes(taxable, exempt, { ivaRate, ivaEnabled, irRate, irEnabled });
  }, [items, ivaRate, ivaEnabled, irRate, irEnabled]);

  const usableRate = rate ?? 1;
  const nio = (usd: number) => (rate ? usdToNio(usd, usableRate) : usd);

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  const legalName = settings?.legal_name || tenant?.name || "Mi Negocio";
  const docTitle =
    docType === "ticket" ? "TICKET DE VENTA" : docType === "factura" ? "FACTURA" : "PROFORMA / COTIZACIÓN";

  return (
    <DashboardShell>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        #print-area.ticket { width: 80mm; }
      `}</style>

      <div className="mb-8 no-print">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Documentos</h1>
        <p className="text-muted-foreground">
          Genera tickets térmicos (80mm), facturas legales y proformas con desglose de impuestos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-6 no-print">
          <Card>
            <CardHeader>
              <CardTitle>Tipo de documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ticket">Ticket 80mm</TabsTrigger>
                  <TabsTrigger value="factura">Factura</TabsTrigger>
                  <TabsTrigger value="proforma">Proforma</TabsTrigger>
                </TabsList>
              </Tabs>

              {docType !== "ticket" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nombre del cliente" />
                  </div>
                  <div className="space-y-2">
                    <Label>RUC / Cédula</Label>
                    <Input value={customerRuc} onChange={(e) => setCustomerRuc(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Líneas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <Input
                    className="mb-2"
                    placeholder="Descripción"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-20">
                      <Label className="text-xs">Cant.</Label>
                      <Input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })}
                      />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Precio USD</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitUsd}
                        onChange={(e) => updateItem(item.id, { unitUsd: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <Switch
                        checked={item.taxable}
                        onCheckedChange={(v) => updateItem(item.id, { taxable: v })}
                      />
                      <span className="text-xs text-muted-foreground">Grava IVA</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto mt-4"
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, newItem()])}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar línea
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLoadOpen(true)}>
                  <FileSearch className="mr-2 h-4 w-4" /> Cargar desde venta
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => window.print()} className="w-full" disabled={items.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
        </div>

        <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cargar desde venta</DialogTitle>
              <DialogDescription>
                Selecciona una venta reciente para reimprimir su comprobante.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {recentSales.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
              ) : (recentSales.data ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay ventas registradas.
                </div>
              ) : (
                <div className="divide-y">
                  {(recentSales.data ?? []).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadSale(s.id)}
                      className="flex w-full items-center justify-between py-2.5 text-left hover:bg-muted/30"
                    >
                      <div>
                        <div className="text-sm font-medium">Venta #{s.sale_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("es-NI")}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatUSD(Number(s.total_usd))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>


        {/* Preview / printable area */}
        <div>
          <div
            id="print-area"
            className={docType === "ticket" ? "ticket mx-auto max-w-[320px] bg-white p-4 text-black shadow" : "bg-white p-8 text-black shadow"}
            style={docType === "ticket" ? { fontFamily: "monospace", fontSize: "12px" } : {}}
          >
            {docType === "ticket" ? (
              <TicketView
                legalName={legalName}
                settings={settings}
                items={items}
                breakdown={breakdown}
                rate={rate}
                nio={nio}
              />
            ) : (
              <InvoiceView
                title={docTitle}
                legalName={legalName}
                settings={settings}
                tenantRuc={tenant?.ruc ?? null}
                customer={customer}
                customerRuc={customerRuc}
                items={items}
                breakdown={breakdown}
                rate={rate}
                nio={nio}
                isProforma={docType === "proforma"}
              />
            )}
          </div>
          {!rate && (
            <p className="mt-3 text-sm text-muted-foreground no-print">
              Registra una tasa de cambio en “Moneda e impuestos” para mostrar los montos en córdobas.
            </p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function Row({ label, usd, nio, bold }: { label: string; usd: string; nio: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="text-right">
        {nio}
        <span className="ml-2 opacity-60">{usd}</span>
      </span>
    </div>
  );
}

function TicketView({ legalName, settings, items, breakdown, rate, nio }: any) {
  return (
    <div className="space-y-1">
      <div className="text-center">
        <div className="text-sm font-bold uppercase">{legalName}</div>
        {settings?.address && <div>{settings.address}</div>}
        {settings?.phone && <div>Tel: {settings.phone}</div>}
        <div>{new Date().toLocaleString("es-NI")}</div>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      {items.map((i: LineItem) => (
        <div key={i.id} className="flex justify-between">
          <span>
            {i.qty} x {i.description || "—"}
          </span>
          <span>{formatNIO(nio(i.qty * i.unitUsd))}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-1" />
      <Row label="Subtotal" usd={formatUSD(breakdown.subtotal)} nio={formatNIO(nio(breakdown.subtotal))} />
      {breakdown.ivaAmount > 0 && (
        <Row label="IVA" usd={formatUSD(breakdown.ivaAmount)} nio={formatNIO(nio(breakdown.ivaAmount))} />
      )}
      {breakdown.irAmount > 0 && (
        <Row label="Retención IR" usd={`-${formatUSD(breakdown.irAmount)}`} nio={`-${formatNIO(nio(breakdown.irAmount))}`} />
      )}
      <Row label="TOTAL" usd={formatUSD(breakdown.total)} nio={formatNIO(nio(breakdown.total))} bold />
      {rate && <div className="mt-1 text-center">Tasa: C$ {rate.toFixed(4)} / US$1</div>}
      <div className="mt-2 text-center">¡Gracias por su compra!</div>
    </div>
  );
}

function InvoiceView({
  title,
  legalName,
  settings,
  tenantRuc,
  customer,
  customerRuc,
  items,
  breakdown,
  rate,
  nio,
  isProforma,
}: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-bold uppercase">{legalName}</div>
          {tenantRuc && <div className="text-sm">RUC: {tenantRuc}</div>}
          {settings?.address && <div className="text-sm">{settings.address}</div>}
          {settings?.phone && <div className="text-sm">Tel: {settings.phone}</div>}
          {settings?.email && <div className="text-sm">{settings.email}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{title}</div>
          <div className="text-sm">Fecha: {new Date().toLocaleDateString("es-NI")}</div>
          {rate && <div className="text-sm">Tasa: C$ {rate.toFixed(4)}/US$1</div>}
        </div>
      </div>

      <div className="border-t pt-2 text-sm">
        <div><span className="font-semibold">Cliente:</span> {customer || "—"}</div>
        <div><span className="font-semibold">RUC/Cédula:</span> {customerRuc || "—"}</div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Descripción</th>
            <th className="py-1 text-center">Cant.</th>
            <th className="py-1 text-right">P. Unit (C$)</th>
            <th className="py-1 text-right">Total (C$)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i: LineItem) => (
            <tr key={i.id} className="border-b">
              <td className="py-1">
                {i.description || "—"} {!i.taxable && <span className="text-xs opacity-60">(exento)</span>}
              </td>
              <td className="py-1 text-center">{i.qty}</td>
              <td className="py-1 text-right">{formatNIO(nio(i.unitUsd))}</td>
              <td className="py-1 text-right">{formatNIO(nio(i.qty * i.unitUsd))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-sm">
        <Row label="Subtotal" usd={formatUSD(breakdown.subtotal)} nio={formatNIO(nio(breakdown.subtotal))} />
        {breakdown.ivaAmount > 0 && (
          <Row label="IVA (15%)" usd={formatUSD(breakdown.ivaAmount)} nio={formatNIO(nio(breakdown.ivaAmount))} />
        )}
        {breakdown.irAmount > 0 && (
          <Row label="Retención IR" usd={`-${formatUSD(breakdown.irAmount)}`} nio={`-${formatNIO(nio(breakdown.irAmount))}`} />
        )}
        <div className="border-t pt-1">
          <Row label="TOTAL" usd={formatUSD(breakdown.total)} nio={formatNIO(nio(breakdown.total))} bold />
        </div>
      </div>

      {isProforma && (
        <div className="text-sm italic">Este documento es una cotización y no tiene validez fiscal.</div>
      )}
      {settings?.invoice_footer && <div className="border-t pt-2 text-xs">{settings.invoice_footer}</div>}
    </div>
  );
}
