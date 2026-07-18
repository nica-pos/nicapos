import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Sparkles, MapPin, CheckCircle2 } from "lucide-react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/prueba-gratis")({
  component: TrialRequestPage,
  head: () => ({
    meta: [
      { title: "Prueba gratis 7 días — Nica-POS" },
      {
        name: "description",
        content:
          "Solicita tu prueba gratuita de 7 días de Nica-POS. Sin tarjeta de crédito. Activación tras verificación manual del equipo.",
      },
      { property: "og:title", content: "Prueba gratis 7 días — Nica-POS" },
      {
        property: "og:description",
        content:
          "Sin tarjeta. Solicita tu prueba y el equipo la aprobará manualmente en pocas horas.",
      },
      { property: "og:url", content: "/prueba-gratis" },
    ],
    links: [{ rel: "canonical", href: "/prueba-gratis" }],
  }),
});

function TrialRequestPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [locStatus, setLocStatus] = useState<"idle" | "asking" | "ok" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  async function askLocation() {
    if (!("geolocation" in navigator)) {
      setLocStatus("denied");
      return;
    }
    setLocStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        });
        setLocStatus("ok");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/trial-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? "") || null,
          businessName: String(form.get("businessName") ?? ""),
          city: String(form.get("city") ?? "") || null,
          country: String(form.get("country") ?? "Nicaragua") || null,
          notes: String(form.get("notes") ?? "") || null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          locationAccuracy: coords?.acc ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo enviar la solicitud");
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LandingLayout>
      <section className="bg-radial-glow py-16 md:py-24">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Prueba gratis 7 días
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Prueba Nica-POS sin pagar nada
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Envía tu solicitud y el equipo la revisará manualmente. Una vez aprobada,
              recibirás tus credenciales de acceso y tendrás 7 días completos para usar
              todas las funciones.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                "Sin tarjeta de crédito",
                "Todas las funciones activas durante 7 días",
                "Aprobación manual del equipo para evitar cuentas duplicadas",
                "Al terminar, eliges plan y sigues sin perder datos",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              ¿Prefieres pagar y arrancar ya?{" "}
              <Link to="/precios" className="text-primary underline">
                Ver planes
              </Link>
              .
            </p>
          </div>

          <Card className="p-6">
            {done ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <h2 className="text-xl font-semibold">¡Solicitud enviada!</h2>
                <p className="text-sm text-muted-foreground">
                  Nuestro equipo la revisará y te contactará por correo con tus credenciales
                  de acceso. Suele tardar pocas horas.
                </p>
                <Button asChild variant="outline">
                  <Link to="/">Volver al inicio</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <h2 className="text-lg font-semibold">Datos del solicitante</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName">Nombre completo *</Label>
                    <Input id="fullName" name="fullName" required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor="email">Correo *</Label>
                    <Input id="email" name="email" type="email" required maxLength={255} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" name="phone" maxLength={40} />
                  </div>
                  <div>
                    <Label htmlFor="businessName">Nombre del negocio *</Label>
                    <Input id="businessName" name="businessName" required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor="city">Ciudad</Label>
                    <Input id="city" name="city" placeholder="Managua" maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor="country">País</Label>
                    <Input id="country" name="country" defaultValue="Nicaragua" maxLength={120} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">¿Qué vendes? (opcional)</Label>
                  <Textarea id="notes" name="notes" rows={2} maxLength={1000} />
                </div>

                <div className="rounded-lg border border-dashed border-border/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Comparte tu ubicación aproximada</p>
                        <p className="text-xs text-muted-foreground">
                          Nos ayuda a validar la solicitud y evitar cuentas duplicadas.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={locStatus === "ok" ? "outline" : "secondary"}
                      onClick={askLocation}
                      disabled={locStatus === "asking"}
                    >
                      {locStatus === "asking" && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      {locStatus === "ok" ? "Ubicación compartida" : "Compartir"}
                    </Button>
                  </div>
                  {locStatus === "denied" && (
                    <p className="mt-2 text-xs text-warning">
                      No pudimos obtener tu ubicación. Puedes continuar sin ella.
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar solicitud
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Al enviar aceptas que registremos tu IP y agente de navegador para
                  prevenir abuso.
                </p>
              </form>
            )}
          </Card>
        </div>
      </section>
    </LandingLayout>
  );
}
