import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Coins, Percent, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  useEffect(() => {
    if (settings) {
      setIvaRate((Number(settings.iva_rate) * 100).toString());
      setIvaEnabled(settings.iva_enabled);
      setIrRate((Number(settings.ir_rate) * 100).toString());
      setIrEnabled(settings.ir_enabled);
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
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
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
                    <Switch checked={ivaEnabled} disabled={!canEdit} onCheckedChange={setIvaEnabled} />
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
                    <Switch checked={irEnabled} disabled={!canEdit} onCheckedChange={setIrEnabled} />
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
                  if (latestRate) setNioInput(usdToNio(Number(e.target.value) || 0, latestRate).toFixed(2));
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
                  if (latestRate) setUsdInput(nioToUsd(Number(e.target.value) || 0, latestRate).toFixed(2));
                }}
              />
            </div>
            {latestRate && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{formatUSD(Number(usdInput) || 0)}</span>
                  <span className="font-semibold text-foreground">{formatNIO(Number(nioInput) || 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exchange rate history */}
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
