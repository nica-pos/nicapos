import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Building2, Copy, CheckCircle2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveTenant } from "@/hooks/use-tenant";
import { submitPaymentProof } from "@/lib/transfer-billing.functions";
import { cn } from "@/lib/utils";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/pago-pendiente")({
  component: PagoPendientePage,
  head: () => ({ meta: [{ title: "Pago pendiente — Nica-POS" }] }),
});

function PagoPendientePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tenant, isLoading } = useActiveTenant();
  const submit = useServerFn(submitPaymentProof);

  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [bankId, setBankId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const banks = useQuery({
    queryKey: ["bank-accounts", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const plan = useQuery({
    queryKey: ["tenant-plan", tenant?.plan_id],
    enabled: !!tenant?.plan_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("id", tenant!.plan_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const filteredBanks = useMemo(
    () => (banks.data ?? []).filter((b) => b.currency === currency),
    [banks.data, currency],
  );

  const selectedBank = filteredBanks.find((b) => b.id === bankId);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      if (!bankId) throw new Error("Selecciona un banco");
      if (!file) throw new Error("Adjunta el comprobante");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Monto inválido");

      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${tenant.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      setUploading(false);
      if (upErr) throw upErr;

      await submit({
        data: {
          tenantId: tenant.id,
          planId: tenant.plan_id!,
          bankAccountId: bankId,
          amount: amt,
          currency,
          reference: reference || null,
          receiptPath: path,
        },
      });
    },
    onSuccess: () => {
      toast.success("Comprobante enviado. Te avisaremos al aprobarlo.");
      qc.invalidateQueries();
      navigate({ to: "/verificacion-pendiente" });
    },
    onError: (e: Error) => {
      setUploading(false);
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return <Navigate to="/onboarding" />;
  const trialEnds = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : null;
  const trialExpired = tenant.status === "trial" && trialEnds !== null && trialEnds < Date.now();
  if (tenant.status === "active") return <Navigate to="/dashboard" />;
  if (tenant.status === "trial" && !trialExpired) return <Navigate to="/dashboard" />;
  if ((tenant.status as string) === "pending_verification") {
    return <Navigate to="/verificacion-pendiente" />;
  }
  if ((tenant.status as string) === "cancelled") return <Navigate to="/onboarding" />;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Realiza tu pago</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Transfiere el monto a una de nuestras cuentas y sube el comprobante para activar tu
              tienda.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>

        {plan.data && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-primary">Plan elegido</div>
                <div className="mt-0.5 text-lg font-semibold">{plan.data.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  ${Number(plan.data.price_usd)}
                </div>
                <div className="text-xs text-muted-foreground">USD / mes</div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label>Moneda a transferir</Label>
              <div className="flex gap-2">
                {(["NIO", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCurrency(c);
                      setBankId("");
                    }}
                    className={cn(
                      "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                      currency === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    {c === "NIO" ? "Córdobas (NIO)" : "Dólares (USD)"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cuenta bancaria</Label>
              {banks.isLoading ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Cargando cuentas…
                </div>
              ) : filteredBanks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No hay cuentas activas en {currency}. Contacta al administrador.
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredBanks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBankId(b.id)}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-all",
                        bankId === b.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                          <div>
                            <div className="text-sm font-semibold">{b.bank_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {b.account_holder} · {b.account_type === "savings" ? "Ahorro" : "Corriente"}
                            </div>
                          </div>
                        </div>
                        {bankId === b.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 font-mono text-sm">
                        <span>{b.account_number}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copy(b.account_number);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {b.instructions && (
                        <p className="mt-2 text-xs text-muted-foreground">{b.instructions}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto transferido ({currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref">Referencia / N° transacción</Label>
                <Input
                  id="ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Comprobante (imagen o PDF)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {file && (
                <div className="text-xs text-muted-foreground">
                  Seleccionado: {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={submitMut.isPending || uploading || !file || !bankId}
              onClick={() => submitMut.mutate()}
            >
              {(submitMut.isPending || uploading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Upload className="mr-2 h-4 w-4" />
              Enviar comprobante
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
