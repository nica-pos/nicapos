import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { XCircle, Mail, Loader2, LogOut, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveTenant } from "@/hooks/use-tenant";
import { supabase } from "@/integrations/supabase/client";

const SUPPORT_EMAIL = "soporte@nicapos.com";

export const Route = createFileRoute("/_authenticated/prueba-rechazada")({
  component: RejectedPage,
  head: () => ({ meta: [{ title: "Solicitud rechazada — Nica-POS" }] }),
});

function RejectedPage() {
  const navigate = useNavigate();
  const { tenant, isLoading } = useActiveTenant();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const reason =
    (tenant as any)?.cancellation_reason ??
    "Tu solicitud no fue aprobada por el equipo administrativo.";
  const tenantName = tenant?.name ?? "tu tienda";

  const mailto = (kind: "apelacion" | "reembolso") => {
    const subject =
      kind === "apelacion"
        ? `Apelación de rechazo — ${tenantName}`
        : `Solicitud de reembolso — ${tenantName}`;
    const body = `Hola equipo Nica-POS,

Mi tienda "${tenantName}" fue marcada como rechazada con el siguiente motivo:
"${reason}"

${
  kind === "apelacion"
    ? "Quisiera apelar esta decisión. Adjunto/explico a continuación la evidencia de mi caso (por ejemplo comprobante de pago, aclaración, etc.):"
    : "Solicito el reembolso del pago realizado. Adjunto comprobante y datos para la devolución:"
}

- Nombre completo:
- Correo:
- Teléfono:
- Detalle:

Gracias.`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Tu solicitud fue rechazada
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisa el motivo y elige una opción a continuación.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-destructive">
                Motivo del rechazo
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {reason}
              </p>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <b className="text-foreground">¿Ya habías pagado?</b> Si tu pago
                no fue visible o crees que hubo un error, puedes apelar o pedir
                el reembolso al superadmin.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="default" onClick={() => mailto("apelacion")}>
                <Mail className="mr-2 h-4 w-4" />
                Apelar rechazo
              </Button>
              <Button variant="outline" onClick={() => mailto("reembolso")}>
                <Mail className="mr-2 h-4 w-4" />
                Pedir reembolso
              </Button>
            </div>

            <div className="border-t pt-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate({ to: "/onboarding" })}
              >
                <Store className="mr-2 h-4 w-4" />
                Crear otra tienda
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
