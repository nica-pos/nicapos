import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Store, LogOut, TrendingUp, DollarSign, Package, Users } from "lucide-react";

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

function DashboardPage() {
  const route = Route.useRouteContext();
  const userEmail = route.user.email;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const stats = [
    { title: "Ventas de hoy", value: "C$ 0.00", icon: TrendingUp, change: "Sin ventas aún" },
    { title: "Utilidad neta", value: "C$ 0.00", icon: DollarSign, change: "0% vs ayer" },
    { title: "Productos", value: "0", icon: Package, change: "Agrega tu inventario" },
    { title: "Clientes", value: "0", icon: Users, change: "Registra clientes" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Store className="h-6 w-6 text-primary" />
            <span className="text-gradient">Nica-POS</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Panel de control</h1>
          <p className="text-muted-foreground">
            Bienvenido a tu tienda. Desde aquí podrás gestionar ventas, inventario y finanzas.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
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
      </main>
    </div>
  );
}
