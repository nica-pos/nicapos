import { getFriendlyErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Loader2,
  ClipboardCheck,
  Plus,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  useAudits,
  useAuditItems,
  useCreateAudit,
  useUpdateAuditCount,
  useCompleteAudit,
} from "@/hooks/use-inventory";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: AuditPage,
  head: () => ({ meta: [{ title: "Auditoría física — Nica-POS" }] }),
});

function AuditPage() {
  const { data: audits, isLoading } = useAudits();
  const createAudit = useCreateAudit();
  const [activeId, setActiveId] = useState<string | null>(null);

  async function startAudit() {
    try {
      const a = await createAudit.mutateAsync(undefined);
      setActiveId(a.id);
      toast.success("Auditoría iniciada");
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  if (activeId) {
    return <AuditDetail auditId={activeId} onBack={() => setActiveId(null)} />;
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <ClipboardCheck className="h-6 w-6 text-primary" /> Auditoría física
            </h1>
            <p className="text-muted-foreground">
              Conteo físico y cuadre de faltantes/sobrantes.
            </p>
          </div>
          <Button onClick={startAudit} disabled={createAudit.isPending}>
            {createAudit.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Nueva auditoría
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>Auditorías realizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (audits?.length ?? 0) === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                No hay auditorías todavía.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(audits ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {new Date(a.created_at).toLocaleString("es-NI")}
                      </TableCell>
                      <TableCell>
                        {a.status === "completed" ? (
                          <Badge variant="secondary">Completada</Badge>
                        ) : (
                          <Badge variant="outline">Borrador</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveId(a.id)}
                        >
                          {a.status === "completed" ? "Ver" : "Continuar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function AuditDetail({
  auditId,
  onBack,
}: {
  auditId: string;
  onBack: () => void;
}) {
  const { data: audits } = useAudits();
  const audit = audits?.find((a) => a.id === auditId);
  const { data: items, isLoading } = useAuditItems(auditId);
  const updateCount = useUpdateAuditCount();
  const complete = useCompleteAudit();

  const completed = audit?.status === "completed";

  async function finish() {
    if (!items) return;
    if (!audit?.branch_id) {
      toast.error("Esta auditoría no tiene sucursal asociada");
      return;
    }
    try {
      await complete.mutateAsync({
        auditId,
        branchId: audit.branch_id,
        items: items.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          system_qty: Number(it.system_qty),
          counted_qty: Number(it.counted_qty),
        })),
      });
      toast.success("Auditoría completada y stock ajustado");
      onBack();
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="h-6 w-6 text-primary" /> Conteo físico
          </h1>
          <p className="text-muted-foreground">
            Ingresa el conteo real de cada producto. La diferencia se calcula
            automáticamente.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Sistema</TableHead>
                    <TableHead className="text-right">Conteo físico</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items ?? []).map((it) => {
                    const diff =
                      Number(it.counted_qty) - Number(it.system_qty);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">
                          {(it as { product?: { name?: string } }).product?.name ?? "—"}
                        </TableCell>

                        <TableCell className="text-right text-muted-foreground">
                          {Number(it.system_qty)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            disabled={completed}
                            defaultValue={Number(it.counted_qty)}
                            className="ml-auto w-24 text-right"
                            onBlur={(e) =>
                              updateCount.mutate({
                                id: it.id,
                                counted_qty: Number(e.target.value),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              diff === 0
                                ? "text-muted-foreground"
                                : diff > 0
                                  ? "font-semibold text-primary"
                                  : "font-semibold text-destructive"
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!completed && (
          <Button onClick={finish} disabled={complete.isPending}>
            {complete.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Cerrar auditoría y ajustar stock
          </Button>
        )}
      </div>
    </DashboardShell>
  );
}
