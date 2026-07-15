import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useIsSuperadmin } from "@/hooks/use-tenant";
import {
  getPaymentProviderSettings,
  savePaymentProviderSettings,
  testProviderConnection,
} from "@/lib/billing.functions";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/pagos")({
  component: PagosPage,
  head: () => ({ meta: [{ title: "Configuración de pagos — Nica-POS" }] }),
});

type ProviderRow = {
  provider: "stripe" | "paypal";
  is_enabled: boolean;
  mode: "sandbox" | "live";
  client_id: string | null;
  secret_preview: string | null;
  has_secret: boolean;
  updated_at: string;
};

function PagosPage() {
  const { data: isSuper, isLoading: loadingRole } = useIsSuperadmin();
  const fetchSettings = useServerFn(getPaymentProviderSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["payment-provider-settings"],
    queryFn: () => fetchSettings(),
    enabled: !!isSuper,
  });

  if (loadingRole || (isSuper && isLoading)) {
    return (
      <DashboardShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }

  if (!isSuper) {
    return (
      <DashboardShell>
        <div className="mx-auto max-w-md text-center py-16">
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Acceso denegado</h1>
          <p className="mt-2 text-muted-foreground">
            Solo el superadmin puede configurar métodos de pago.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const rows = (data ?? []) as ProviderRow[];
  const stripe = rows.find((r) => r.provider === "stripe");
  const paypal = rows.find((r) => r.provider === "paypal");

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" /> Admin
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración de pagos</h1>
          <p className="text-muted-foreground">
            Pega aquí tus credenciales de Stripe y/o PayPal. Los secretos se guardan cifrados.
          </p>
        </div>

        <ProviderCard
          provider="stripe"
          title="Stripe"
          clientIdLabel="Publishable Key (pk_...)"
          clientSecretLabel="Secret Key (sk_...)"
          helper="Obtén tus llaves en dashboard.stripe.com → Developers → API keys."
          row={stripe}
        />

        <ProviderCard
          provider="paypal"
          title="PayPal"
          clientIdLabel="Client ID"
          clientSecretLabel="Client Secret"
          helper="Crea una app en developer.paypal.com para obtener tus credenciales."
          row={paypal}
        />
      </div>
    </DashboardShell>
  );
}

function ProviderCard({
  provider,
  title,
  clientIdLabel,
  clientSecretLabel,
  helper,
  row,
}: {
  provider: "stripe" | "paypal";
  title: string;
  clientIdLabel: string;
  clientSecretLabel: string;
  helper: string;
  row: ProviderRow | undefined;
}) {
  const [enabled, setEnabled] = useState(row?.is_enabled ?? false);
  const [mode, setMode] = useState<"sandbox" | "live">(row?.mode ?? "sandbox");
  const [clientId, setClientId] = useState(row?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const qc = useQueryClient();
  const save = useServerFn(savePaymentProviderSettings);
  const test = useServerFn(testProviderConnection);

  useEffect(() => {
    if (row) {
      setEnabled(row.is_enabled);
      setMode(row.mode);
      setClientId(row.client_id ?? "");
    }
  }, [row]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          provider,
          is_enabled: enabled,
          mode,
          client_id: clientId,
          client_secret: clientSecret || null,
        },
      }),
    onSuccess: () => {
      toast.success(`${title} guardado`);
      setClientSecret("");
      qc.invalidateQueries({ queryKey: ["payment-provider-settings"] });
    },
    onError: (e) => toast.error(getFriendlyErrorMessage(e)),
  });

  const testMut = useMutation({
    mutationFn: () => test({ data: { provider } }),
    onSuccess: (r: any) => toast.success(r.message || "Conexión OK"),
    onError: (e) => toast.error(getFriendlyErrorMessage(e)),
  });

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{helper}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${provider}-enabled`} className="text-sm">
            Activo
          </Label>
          <Switch
            id={`${provider}-enabled`}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div>
          <Label>Modo</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (pruebas)</SelectItem>
              <SelectItem value="live">Live (producción)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${provider}-cid`}>{clientIdLabel}</Label>
          <Input
            id={`${provider}-cid`}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="..."
            className="mt-1 font-mono text-sm"
          />
        </div>

        <div>
          <Label htmlFor={`${provider}-sec`}>{clientSecretLabel}</Label>
          <Input
            id={`${provider}-sec`}
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={row?.has_secret ? row.secret_preview ?? "•••• (guardado)" : "Pega tu secreto"}
            className="mt-1 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {row?.has_secret
              ? "Deja vacío para conservar el guardado. Escribe uno nuevo para reemplazarlo."
              : "Se cifra antes de guardarse."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !row?.has_secret}
          >
            {testMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Probar conexión
          </Button>
        </div>
      </div>
    </Card>
  );
}
