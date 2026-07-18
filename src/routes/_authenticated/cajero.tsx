import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Wallet, HandCoins, LogOut, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/hooks/use-tenant";

export const Route = createFileRoute("/_authenticated/cajero")({
  component: CajeroHome,
});

function CajeroHome() {
  const navigate = useNavigate();
  const { tenant } = useActiveTenant();

  const actions = [
    {
      to: "/pos",
      title: "Nueva venta",
      desc: "Abre el punto de venta y comienza a facturar.",
      icon: ShoppingCart,
    },
    {
      to: "/caja",
      title: "Caja",
      desc: "Apertura, cierre y arqueo de la caja.",
      icon: Wallet,
    },
    {
      to: "/clientes",
      title: "Clientes y créditos",
      desc: "Consulta clientes y cobros pendientes.",
      icon: HandCoins,
    },
  ] as const;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-8 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" /> {tenant?.name ?? "Tu tienda"}
          </div>
          <h1 className="mt-1 text-3xl font-bold">Panel de cajero</h1>
          <p className="text-muted-foreground">
            Elige una acción para comenzar tu turno.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <a.icon className="h-6 w-6" />
                </div>
                <CardTitle className="mt-3">{a.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {a.desc}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
