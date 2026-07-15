import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  listPendingSubmissions,
  getReceiptSignedUrl,
  reviewSubmission,
} from "@/lib/transfer-billing.functions";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/pagos-pendientes")({
  component: PagosPendientesPage,
  head: () => ({ meta: [{ title: "Pagos pendientes — Nica-POS" }] }),
});

function PagosPendientesPage() {
  const { data: isSuper, isLoading: loadingRole } = useIsSuperadmin();
  const qc = useQueryClient();
  const fetchList = useServerFn(listPendingSubmissions);
  const signUrl = useServerFn(getReceiptSignedUrl);
  const review = useServerFn(reviewSubmission);

  const [viewing, setViewing] = useState<any | null>(null);
  const [months, setMonths] = useState("1");
  const [rejectReason, setRejectReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const list = useQuery({
    queryKey: ["admin-pending-submissions"],
    enabled: !!isSuper,
    queryFn: () => fetchList(),
  });

  const reviewMut = useMutation({
    mutationFn: (v: {
      submissionId: string;
      approve: boolean;
      months?: number;
      rejectionReason?: string;
    }) => review({ data: v }),
    onSuccess: (_, v) => {
      toast.success(v.approve ? "Pago aprobado y tienda activada" : "Comprobante rechazado");
      setViewing(null);
      setRejectReason("");
      setReceiptUrl(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-submissions"] });
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const openReview = async (sub: any) => {
    setViewing(sub);
    setMonths("1");
    setRejectReason("");
    setReceiptUrl(null);
    setLoadingReceipt(true);
    try {
      const { url } = await signUrl({ data: { path: sub.receipt_url } });
      setReceiptUrl(url);
    } catch (e: any) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoadingReceipt(false);
    }
  };

  if (loadingRole) {
    return (
      <DashboardShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
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

  const rows = (list.data ?? []) as any[];

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" /> Admin
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagos pendientes</h1>
          <p className="text-muted-foreground">
            Revisa y aprueba los comprobantes de transferencia enviados por los clientes.
          </p>
        </div>

        {list.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="mb-3 h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium">Nada por revisar</div>
            <div className="mt-1 text-xs text-muted-foreground">
              No hay comprobantes pendientes en este momento.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{s.tenant?.name}</div>
                      {s.tenant?.ruc && (
                        <span className="text-xs text-muted-foreground">RUC {s.tenant.ruc}</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Plan <span className="font-medium text-foreground">{s.plan?.name}</span> ·
                      Transferido a{" "}
                      <span className="font-medium text-foreground">
                        {s.bank?.bank_name} ({s.bank?.currency})
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono tabular-nums">
                        {s.currency} {Number(s.amount).toLocaleString()}
                      </span>
                      {s.reference && (
                        <span className="text-xs text-muted-foreground">
                          Ref: <span className="font-mono">{s.reference}</span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => openReview(s)}>
                    <FileText className="mr-2 h-4 w-4" /> Revisar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar comprobante</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Tienda</div>
                  <div className="font-medium">{viewing.tenant?.name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Plan</div>
                  <div className="font-medium">
                    {viewing.plan?.name} · ${Number(viewing.plan?.price_usd)}/mes
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Monto transferido</div>
                  <div className="font-mono font-medium">
                    {viewing.currency} {Number(viewing.amount).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Banco destino</div>
                  <div className="font-medium">
                    {viewing.bank?.bank_name} · {viewing.bank?.account_number}
                  </div>
                </div>
                {viewing.reference && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Referencia</div>
                    <div className="font-mono">{viewing.reference}</div>
                  </div>
                )}
              </div>

              <div>
                <Label>Comprobante</Label>
                <div className="mt-1 rounded-lg border bg-muted/30 p-2">
                  {loadingReceipt ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : receiptUrl ? (
                    receiptUrl.match(/\.pdf(\?|$)/i) ? (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-4 text-center text-sm text-primary underline"
                      >
                        Abrir PDF del comprobante
                      </a>
                    ) : (
                      <a href={receiptUrl} target="_blank" rel="noreferrer">
                        <img
                          src={receiptUrl}
                          alt="Comprobante"
                          className="mx-auto max-h-96 rounded"
                        />
                      </a>
                    )
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No se pudo cargar
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Aprobar por</Label>
                  <Select value={months} onValueChange={setMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mes</SelectItem>
                      <SelectItem value="3">3 meses</SelectItem>
                      <SelectItem value="6">6 meses</SelectItem>
                      <SelectItem value="12">12 meses</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    disabled={reviewMut.isPending}
                    onClick={() =>
                      reviewMut.mutate({
                        submissionId: viewing.id,
                        approve: true,
                        months: Number(months),
                      })
                    }
                  >
                    {reviewMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Motivo de rechazo</Label>
                  <Textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ej: monto no coincide"
                  />
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={reviewMut.isPending || !rejectReason.trim()}
                    onClick={() =>
                      reviewMut.mutate({
                        submissionId: viewing.id,
                        approve: false,
                        rejectionReason: rejectReason.trim(),
                      })
                    }
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Rechazar
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
