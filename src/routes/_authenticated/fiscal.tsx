import { getFriendlyErrorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Coins, Percent, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant } from "@/hooks/use-tenant";
import {
  useFiscalSettings,
  useExchangeRates,
  useLatestRate,
  usdToNio,
  nioToUsd,
  formatNIO,
  formatUSD,
} from "@/hooks/use-fiscal";

export const Route = createFileRoute("/_authenticated/fiscal")({
  component: FiscalPage,
  head: () => ({ meta: [{ title: "Moneda e impuestos — Nica-POS" }] }),
});

function FiscalPage() {
  const queryClient = useQueryClient();
  const { tenant, role } = useActiveTenant();
  const canEdit = role === "owner" || role === "admin";
  const { data: settings, isLoading: loadingSettings } = useFiscalSettings();
  const { data: rates, isLoading: loadingRates } = useExchangeRates();
  const latestRate = useLatestRate();

  // Fiscal settings form
  const [ivaRate, setIvaRate] = useState("15");
  const [ivaEnabled, setIvaEnabled] = useState(true);
  const [irRate, setIrRate] = useState("2");
  const [irEnabled, setIrEnabled] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");

  // Document customization
  const [showLogo, setShowLogo] = useState(true);
  const [ticketPrefix, setTicketPrefix] = useState("TKT-");
  const [nextTicket, setNextTicket] = useState("1");
  const [invoicePrefix, setInvoicePrefix] = useState("FAC-");
  const [nextInvoice, setNextInvoice] = useState("1");
  const [proformaPrefix, setProformaPrefix] = useState("PRO-");
  const [nextProforma, setNextProforma] = useState("1");
  const [ticketHeader, setTicketHeader] = useState("");
  const [thankYou, setThankYou] = useState("¡Gracias por su compra!");

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setIvaRate((Number(settings.iva_rate) * 100).toString());
      setIvaEnabled(settings.iva_enabled);
      setIrRate((Number(settings.ir_rate) * 100).toString());
      setIrEnabled(settings.ir_enabled);
      setLegalName(settings.legal_name ?? "");
      setAddress(settings.address ?? "");
      setPhone(settings.phone ?? "");
      setEmail(settings.email ?? "");
      setInvoiceFooter(settings.invoice_footer ?? "");
      setShowLogo(s.show_logo ?? true);
      setTicketPrefix(s.ticket_prefix ?? "TKT-");
      setNextTicket(String(s.next_ticket_number ?? 1));
      setInvoicePrefix(s.invoice_prefix ?? "FAC-");
      setNextInvoice(String(s.next_invoice_number ?? 1));
      setProformaPrefix(s.proforma_prefix ?? "PRO-");
      setNextProforma(String(s.next_proforma_number ?? 1));
      setTicketHeader(s.ticket_header ?? "");
      setThankYou(s.thank_you_message ?? "¡Gracias por su compra!");
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      const payload = {
        tenant_id: tenant.id,
        iva_rate: Number(ivaRate) / 100,
        iva_enabled: ivaEnabled,
        ir_rate: Number(irRate) / 100,
        ir_enabled: irEnabled,
      };
      const { error } = await supabase
        .from("fiscal_settings")
        .upsert(payload, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-settings", tenant?.id] });
      toast.success("Impuestos actualizados");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const saveInvoiceData = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      const { error } = await supabase.from("fiscal_settings").upsert(
        {
          tenant_id: tenant.id,
          legal_name: legalName.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          invoice_footer: invoiceFooter.trim() || null,
        },
        { onConflict: "tenant_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-settings", tenant?.id] });
      toast.success("Datos de facturación guardados");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const saveDocCustomization = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      const { error } = await supabase.from("fiscal_settings").upsert(
        {
          tenant_id: tenant.id,
          show_logo: showLogo,
          ticket_prefix: ticketPrefix.trim() || "TKT-",
          next_ticket_number: Math.max(1, parseInt(nextTicket) || 1),
          invoice_prefix: invoicePrefix.trim() || "FAC-",
          next_invoice_number: Math.max(1, parseInt(nextInvoice) || 1),
          proforma_prefix: proformaPrefix.trim() || "PRO-",
          next_proforma_number: Math.max(1, parseInt(nextProforma) || 1),
          ticket_header: ticketHeader.trim() || null,
          thank_you_message: thankYou.trim() || null,
        },
        { onConflict: "tenant_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-settings", tenant?.id] });
      toast.success("Personalización de documentos guardada");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  // New exchange rate
  const [newRate, setNewRate] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));

  const addRate = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("exchange_rates").upsert(
        {
          tenant_id: tenant.id,
          rate: Number(newRate),
          effective_date: newDate,
          created_by: userData.user?.id ?? null,
        },
        { onConflict: "tenant_id,effective_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setNewRate("");
      queryClient.invalidateQueries({ queryKey: ["exchange-rates", tenant?.id] });
      toast.success("Tasa de cambio registrada");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exchange_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates", tenant?.id] });
      toast.success("Tasa eliminada");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  // Live converter
  const [usdInput, setUsdInput] = useState("1");
  const [nioInput, setNioInput] = useState("");
  useEffect(() => {
    if (latestRate) setNioInput(usdToNio(Number(usdInput) || 0, latestRate).toFixed(2));
  }, [latestRate]);

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Moneda e impuestos</h1>
        <p className="text-muted-foreground">
          Tasa de cambio córdoba/dólar e impuestos parametrizables para Nicaragua.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tax settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" /> Impuestos y retenciones
            </CardTitle>
            <CardDescription>Configura el IVA y la retención en la fuente (IR).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingSettings ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="iva">IVA (%)</Label>
                    <Input
                      id="iva"
                      type="number"
                      step="0.01"
                      value={ivaRate}
                      disabled={!canEdit}
                      onChange={(e) => setIvaRate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      checked={ivaEnabled}
                      disabled={!canEdit}
                      onCheckedChange={setIvaEnabled}
                    />
                    <span className="text-sm text-muted-foreground">Aplicar IVA</span>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="ir">Retención IR (%)</Label>
                    <Input
                      id="ir"
                      type="number"
                      step="0.01"
                      value={irRate}
                      disabled={!canEdit}
                      onChange={(e) => setIrRate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      checked={irEnabled}
                      disabled={!canEdit}
                      onCheckedChange={setIrEnabled}
                    />
                    <span className="text-sm text-muted-foreground">Aplicar IR</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  El IVA (15% estándar) se aplica a productos gravados. El IR (2%) es una retención
                  para grandes contribuyentes; actívalo solo cuando corresponda.
                </p>
                {canEdit && (
                  <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                    {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar impuestos
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Converter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Convertidor en tiempo real
            </CardTitle>
            <CardDescription>
              {latestRate
                ? `Tasa activa: C$ ${latestRate.toFixed(4)} por US$ 1.00`
                : "Registra una tasa de cambio para activar el convertidor."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usd">Dólares (USD)</Label>
              <Input
                id="usd"
                type="number"
                value={usdInput}
                onChange={(e) => {
                  setUsdInput(e.target.value);
                  if (latestRate)
                    setNioInput(usdToNio(Number(e.target.value) || 0, latestRate).toFixed(2));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nio">Córdobas (NIO)</Label>
              <Input
                id="nio"
                type="number"
                value={nioInput}
                onChange={(e) => {
                  setNioInput(e.target.value);
                  if (latestRate)
                    setUsdInput(nioToUsd(Number(e.target.value) || 0, latestRate).toFixed(2));
                }}
              />
            </div>
            {latestRate && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{formatUSD(Number(usdInput) || 0)}</span>
                  <span className="font-semibold text-foreground">
                    {formatNIO(Number(nioInput) || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice legal data */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Datos legales para documentos</CardTitle>
          <CardDescription>
            Aparecen en tickets, facturas y proformas (razón social, RUC de la tienda en
            Configuración).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal">Razón social</Label>
            <Input
              id="legal"
              value={legalName}
              disabled={!canEdit}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              disabled={!canEdit}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr">Dirección</Label>
            <Input
              id="addr"
              value={address}
              disabled={!canEdit}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail">Correo</Label>
            <Input
              id="mail"
              type="email"
              value={email}
              disabled={!canEdit}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="footer">Nota de pie de página (políticas de devolución, etc.)</Label>
            <Textarea
              id="footer"
              value={invoiceFooter}
              disabled={!canEdit}
              onChange={(e) => setInvoiceFooter(e.target.value)}
            />
          </div>
          {canEdit && (
            <div className="sm:col-span-2">
              <Button onClick={() => saveInvoiceData.mutate()} disabled={saveInvoiceData.isPending}>
                {saveInvoiceData.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar datos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Personalización de documentos</CardTitle>
          <CardDescription>
            Logo, prefijos y correlativos que se muestran en tickets, facturas y proformas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch checked={showLogo} disabled={!canEdit} onCheckedChange={setShowLogo} />
            <div>
              <div className="text-sm font-medium">Mostrar logo de la tienda</div>
              <div className="text-xs text-muted-foreground">
                Se toma el logo configurado en Configuración › Identidad de marca.
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prefijo ticket</Label>
              <Input
                value={ticketPrefix}
                disabled={!canEdit}
                onChange={(e) => setTicketPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Siguiente número ticket</Label>
              <Input
                type="number"
                min="1"
                value={nextTicket}
                disabled={!canEdit}
                onChange={(e) => setNextTicket(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prefijo factura</Label>
              <Input
                value={invoicePrefix}
                disabled={!canEdit}
                onChange={(e) => setInvoicePrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Siguiente número factura</Label>
              <Input
                type="number"
                min="1"
                value={nextInvoice}
                disabled={!canEdit}
                onChange={(e) => setNextInvoice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prefijo proforma</Label>
              <Input
                value={proformaPrefix}
                disabled={!canEdit}
                onChange={(e) => setProformaPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Siguiente número proforma</Label>
              <Input
                type="number"
                min="1"
                value={nextProforma}
                disabled={!canEdit}
                onChange={(e) => setNextProforma(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Encabezado extra del ticket</Label>
            <Textarea
              value={ticketHeader}
              disabled={!canEdit}
              placeholder="Ej. Facebook: @mitienda"
              onChange={(e) => setTicketHeader(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensaje de agradecimiento</Label>
            <Textarea
              value={thankYou}
              disabled={!canEdit}
              onChange={(e) => setThankYou(e.target.value)}
            />
          </div>

          {canEdit && (
            <Button
              onClick={() => saveDocCustomization.mutate()}
              disabled={saveDocCustomization.isPending}
            >
              {saveDocCustomization.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar personalización
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Historial de tasa de cambio
          </CardTitle>
          <CardDescription>Córdobas por 1 dólar. Una tasa por día.</CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="rate">Tasa (C$ por US$1)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.0001"
                  placeholder="36.6250"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="sm:w-40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha de vigencia</Label>
                <Input
                  id="date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="sm:w-44"
                />
              </div>
              <Button onClick={() => addRate.mutate()} disabled={!newRate || addRate.isPending}>
                {addRate.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Registrar
              </Button>
            </div>
          )}

          {loadingRates ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (rates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay tasas registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tasa (C$/US$)</TableHead>
                  <TableHead></TableHead>
                  {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.effective_date}</TableCell>
                    <TableCell className="font-medium">C$ {Number(r.rate).toFixed(4)}</TableCell>
                    <TableCell>{i === 0 && <Badge>Activa</Badge>}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRate.mutate(r.id)}
                          disabled={deleteRate.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
