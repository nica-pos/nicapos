import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ShieldAlert, ArrowLeft, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useIsSuperadmin } from "@/hooks/use-tenant";
import { saveBankAccount, deleteBankAccount } from "@/lib/transfer-billing.functions";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin_/bancos")({
  component: BancosPage,
  head: () => ({ meta: [{ title: "Cuentas bancarias — Nica-POS" }] }),
});

type Bank = {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type: "savings" | "checking";
  currency: "NIO" | "USD";
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

function BancosPage() {
  const { data: isSuper, isLoading: loadingRole } = useIsSuperadmin();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Bank> | null>(null);
  const save = useServerFn(saveBankAccount);
  const del = useServerFn(deleteBankAccount);

  const banks = useQuery({
    queryKey: ["bank-accounts", "all"],
    enabled: !!isSuper,
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Bank[];
    },
  });

  const saveMut = useMutation({
    mutationFn: (b: any) => save({ data: b }),
    onSuccess: () => {
      toast.success("Cuenta guardada");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Cuenta eliminada");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (loadingRole) {
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
        <div className="mx-auto max-w-md py-16 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Acceso denegado</h1>
        </div>
      </DashboardShell>
    );
  }

  const rows = banks.data ?? [];

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" /> Admin
            </Link>
          </Button>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cuentas bancarias</h1>
            <p className="text-muted-foreground">
              Configura las cuentas donde tus clientes pueden transferir para pagar sus planes.
            </p>
          </div>
          <Button
            onClick={() =>
              setEditing({
                bank_name: "",
                account_holder: "",
                account_number: "",
                account_type: "savings",
                currency: "NIO",
                is_active: true,
                sort_order: rows.length,
                instructions: "",
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva cuenta
          </Button>
        </div>

        {banks.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium">Sin cuentas bancarias</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Agrega al menos una para que los clientes puedan pagar.
            </div>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{b.bank_name}</div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                          {b.currency}
                        </span>
                        {!b.is_active && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {b.account_holder} · {b.account_type === "savings" ? "Ahorro" : "Corriente"}
                      </div>
                      <div className="mt-1 font-mono text-sm">{b.account_number}</div>
                      {b.instructions && (
                        <p className="mt-1 text-xs text-muted-foreground">{b.instructions}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("¿Eliminar esta cuenta?")) delMut.mutate(b.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BankDialog
        bank={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => saveMut.mutate(v)}
        saving={saveMut.isPending}
      />
    </DashboardShell>
  );
}

function BankDialog({
  bank,
  onClose,
  onSave,
  saving,
}: {
  bank: Partial<Bank> | null;
  onClose: () => void;
  onSave: (v: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Bank>>({});
  useEffect(() => {
    if (bank) setForm(bank);
  }, [bank]);

  const open = !!bank;

  const upd = (k: keyof Bank, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bank?.id ? "Editar cuenta" : "Nueva cuenta bancaria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Input
              value={form.bank_name ?? ""}
              onChange={(e) => upd("bank_name", e.target.value)}
              placeholder="Banco de la Producción (BANPRO)"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Titular de la cuenta</Label>
            <Input
              value={form.account_holder ?? ""}
              onChange={(e) => upd("account_holder", e.target.value)}
              placeholder="Nica-POS S.A."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Número de cuenta</Label>
            <Input
              value={form.account_number ?? ""}
              onChange={(e) => upd("account_number", e.target.value)}
              placeholder="1000-2000-3000-4000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.account_type ?? "savings"}
                onValueChange={(v) => upd("account_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Ahorro</SelectItem>
                  <SelectItem value="checking">Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={form.currency ?? "NIO"} onValueChange={(v) => upd("currency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NIO">Córdobas (NIO)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Instrucciones (opcional)</Label>
            <Textarea
              rows={2}
              value={form.instructions ?? ""}
              onChange={(e) => upd("instructions", e.target.value)}
              placeholder="Ej: incluir tu nombre en el concepto"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Cuenta activa</div>
              <div className="text-xs text-muted-foreground">
                Solo las cuentas activas se muestran a los clientes.
              </div>
            </div>
            <Switch checked={form.is_active ?? true} onCheckedChange={(v) => upd("is_active", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={() =>
              onSave({
                id: form.id,
                bank_name: (form.bank_name ?? "").trim(),
                account_holder: (form.account_holder ?? "").trim(),
                account_number: (form.account_number ?? "").trim(),
                account_type: form.account_type ?? "savings",
                currency: form.currency ?? "NIO",
                instructions: form.instructions?.trim() || null,
                is_active: form.is_active ?? true,
                sort_order: form.sort_order ?? 0,
              })
            }
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
