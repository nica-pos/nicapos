import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Package, Users, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant } from "@/hooks/use-tenant";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Panel — Nica-POS" },
      { name: "description", content: "Panel de control de tu tienda en Nica-POS." },
      { property: "og:title", content: "Panel — Nica-POS" },
      { property: "og:description", content: "Panel de control de tu tienda en Nica-POS." },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
});

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  trial: { label: "Prueba", variant: "secondary" },
  active: { label: "Activa", variant: "default" },
  suspended: { label: "Suspendida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function DashboardPage() {
  const navigate = useNavigate();
  const { isLoading, hasTenant, tenant, role } = useActiveTenant();

  useEffect(() => {
    if (!isLoading && !hasTenant) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, hasTenant, navigate]);

  if (isLoading || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { title: "Ventas de hoy", value: "C$ 0.00", icon: TrendingUp, change: "Sin ventas aún" },
    { title: "Utilidad neta", value: "C$ 0.00", icon: DollarSign, change: "0% vs ayer" },
    { title: "Productos", value: "0", icon: Package, change: "Agrega tu inventario" },
    { title: "Clientes", value: "0", icon: Users, change: "Registra clientes" },
  ];

  const status = statusLabels[tenant.status] ?? statusLabels.trial;

  return (
    <DashboardShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{tenant.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            Tu rol: <span className="capitalize">{role}</span>
            {tenant.ruc ? ` · RUC ${tenant.ruc}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border/60 bg-card p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">Tu tienda está lista para configurarse</h2>
        <p className="mt-2 text-muted-foreground">
          Próximamente: productos, ventas, caja, clientes, proveedores y reportes financieros.
        </p>
      </div>
    </DashboardShell>
  );
}
