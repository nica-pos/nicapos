import { getFriendlyErrorMessage } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Building2, CheckCircle2, PauseCircle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useIsSuperadmin, usePlans } from "@/hooks/use-tenant";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Superadmin — Nica-POS" }] }),
});

const statusMeta: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  trial: { label: "Prueba", variant: "secondary" },
  active: { label: "Activa", variant: "default" },
  suspended: { label: "Suspendida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: isSuperadmin, isLoading: checking } = useIsSuperadmin();
  const { data: plans } = usePlans(true);

  const tenants = useQuery({
    queryKey: ["admin-tenants"],
    enabled: !!isSuperadmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, plan:plans(name, price_usd), owner:profiles!tenants_owner_id_fkey(email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tenants")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (checking) {
    return (
      <DashboardShell>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }

  if (!isSuperadmin) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">Acceso restringido</h1>
          <p className="mt-2 text-muted-foreground">Esta sección es solo para superadministradores de la plataforma.</p>
        </div>
      </DashboardShell>
    );
  }

  const list = tenants.data ?? [];
  const active = list.filter((t: any) => t.status === "active").length;
  const suspended = list.filter((t: any) => t.status === "suspended").length;
  const mrr = list
    .filter((t: any) => t.status === "active")
    .reduce((sum: number, t: any) => sum + Number(t.plan?.price_usd ?? 0), 0);

  const metrics = [
    { title: "Tiendas totales", value: list.length, icon: Building2 },
    { title: "Activas", value: active, icon: CheckCircle2 },
    { title: "Suspendidas", value: suspended, icon: PauseCircle },
    { title: "MRR estimado", value: `$${mrr.toFixed(2)}`, icon: DollarSign },
  ];

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Consola de plataforma</h1>
        <p className="text-muted-foreground">Administración central de todas las tiendas y planes.</p>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
              <m.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Tiendas</CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((t: any) => {
                  const meta = statusMeta[t.status] ?? statusMeta.trial;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.owner?.email ?? "—"}</TableCell>
                      <TableCell>{t.plan?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.status === "suspended" ? (
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: t.id, status: "active" })}>
                            Reactivar
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: t.id, status: "suspended" })}>
                            Suspender
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Cajeros</TableHead>
                <TableHead>Sucursales</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>${p.price_usd}/mes</TableCell>
                  <TableCell>{p.max_products.toLocaleString()}</TableCell>
                  <TableCell>{p.max_cashiers}</TableCell>
                  <TableCell>{p.max_branches}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
