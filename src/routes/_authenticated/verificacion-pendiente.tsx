import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, RefreshCw, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveTenant } from "@/hooks/use-tenant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/verificacion-pendiente")({
  component: VerificacionPendientePage,
  head: () => ({ meta: [{ title: "Verificación pendiente — Nica-POS" }] }),
});

function VerificacionPendientePage() {
  const { tenant, isLoading } = useActiveTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!tenant) return <Navigate to="/onboarding" />;
  const status = tenant.status as string;
  if (status === "active" || status === "trial") return <Navigate to="/dashboard" />;
  if (status === "pending_payment") return <Navigate to="/pago-pendiente" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
            <Clock className="h-7 w-7 text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Verificando tu pago</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Recibimos tu comprobante y lo estamos revisando. Este proceso puede tomar unas horas.
              Te avisaremos por correo cuando tu tienda esté activa.
            </p>
          </div>
          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-left text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Tienda:</span> {tenant.name}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => qc.invalidateQueries({ queryKey: ["my-memberships"] })}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
