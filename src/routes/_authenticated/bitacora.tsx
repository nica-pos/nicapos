import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Loader2 } from "lucide-react";
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
import { useAuditLogs, type AuditLog } from "@/hooks/use-analytics";

export const Route = createFileRoute("/_authenticated/bitacora")({
  component: BitacoraPage,
  head: () => ({ meta: [{ title: "Bitácora de auditoría — Nica-POS" }] }),
});

const entityLabels: Record<string, string> = {
  sales: "Venta",
  cash_movements: "Movimiento de caja",
  products: "Producto",
  receivable_payments: "Abono cliente",
  payable_payments: "Pago proveedor",
  stock_audits: "Auditoría de stock",
};

const actionVariant: Record<string, "default" | "secondary" | "destructive"> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
};

const actionLabels: Record<string, string> = {
  insert: "Creación",
  update: "Modificación",
  delete: "Eliminación",
};

function describe(log: AuditLog): string {
  const d = (log.details ?? {}) as Record<string, unknown>;
  switch (log.entity) {
    case "sales":
      return `Venta #${d.sale_number} · $${Number(d.total_usd ?? 0).toFixed(2)}`;
    case "cash_movements":
      return `${d.type} · ${d.currency} ${Number(d.amount ?? 0).toFixed(2)}${d.reason ? ` · ${d.reason}` : ""}`;
    case "products":
      return `${d.name}: precio $${d.old_price}→$${d.new_price}, costo $${d.old_cost}→$${d.new_cost}`;
    case "receivable_payments":
    case "payable_payments":
      return `$${Number(d.amount_usd ?? 0).toFixed(2)} (${d.method})`;
    default:
      return "";
  }
}

function BitacoraPage() {
  const { data: logs, isLoading, error } = useAuditLogs();

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" /> Bitácora de auditoría
          </h1>
          <p className="text-muted-foreground">
            Registro antifraude de acciones sensibles en tu tienda.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Eventos recientes</CardTitle>
            <CardDescription>Últimos 200 registros</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : error ? (
              <p className="text-sm text-muted-foreground">
                Solo los administradores pueden ver la bitácora.
              </p>
            ) : !logs?.length ? (
              <p className="text-sm text-muted-foreground">Aún no hay eventos registrados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("es-NI")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionVariant[log.action] ?? "default"}>
                          {actionLabels[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{entityLabels[log.entity] ?? log.entity}</TableCell>
                      <TableCell className="text-sm">{describe(log)}</TableCell>
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
