import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/hooks/use-tenant";

export const Route = createFileRoute("/_authenticated/prueba-en-revision")({
  component: TrialPendingPage,
  head: () => ({ meta: [{ title: "Prueba en revisión — Nica-POS" }] }),
});

function TrialPendingPage() {
  const navigate = useNavigate();
  const { tenant, isLoading } = useActiveTenant();

  useEffect(() => {
    if (isLoading || !tenant) return;
    const s = tenant.status as string;
    if (s === "trial" || s === "active") navigate({ to: "/dashboard", replace: true });
    else if (s === "cancelled") navigate({ to: "/onboarding", replace: true });
  }, [tenant, isLoading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tu solicitud está en revisión</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Solicitaste una prueba gratuita de 7 días. Nuestro equipo la revisará
              en breve (normalmente en menos de 24 horas).
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Te notificaremos por correo tan pronto tu cuenta sea aprobada.
              También recibirás un correo si necesitamos más información.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
