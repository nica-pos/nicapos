import { useState } from "react";
import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  usePlans,
  setActiveTenantId,
  useMyMemberships,
} from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";

const PLAN_META: Record<
  string,
  { description: string; features: string[]; popular?: boolean }
> = {
  basico: {
    description: "Ideal para tiendas de un solo mostrador.",
    features: [
      "1 sucursal",
      "2 cajeros activos",
      "Hasta 500 productos",
      "Facturación e impresión térmica",
      "Caja y arqueo básico",
      "Soporte por email",
    ],
  },
  negocio: {
    description: "Para comercios en crecimiento con múltiples cajas.",
    popular: true,
    features: [
      "3 sucursales",
      "8 cajeros activos",
      "Productos ilimitados",
      "Multimoneda NIO/USD y pagos mixtos",
      "Créditos, apartados y cuentas por cobrar",
      "Dashboard y reportes financieros",
      "Soporte prioritario",
    ],
  },
  empresarial: {
    description: "Multi-tienda con administración centralizada.",
    features: [
      "Sucursales ilimitadas",
      "Cajeros ilimitados",
      "Productos ilimitados",
      "Consola de superadmin",
      "White-label y API de integración",
      "Auditoría antifraude avanzada",
      "Soporte dedicado",
    ],
  },
};

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [{ title: "Crear tu tienda — Nica-POS" }],
  }),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plans } = usePlans();
  const [name, setName] = useState("");
  const [ruc, setRuc] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);

  const selectedPlan = (plans ?? []).find((p) => p.id === planId);
  const isPaidPlan = !!selectedPlan && Number(selectedPlan.price_usd) > 0;

  const createTenant = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no válida");

      const baseSlug = slugify(name) || "tienda";
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data, error } = await supabase
        .from("tenants")
        .insert({
          name: name.trim(),
          slug,
          ruc: ruc.trim() || null,
          owner_id: uid,
          plan_id: planId,
          status: (isPaidPlan ? "pending_payment" : "trial") as any,
          trial_ends_at: isPaidPlan
            ? null
            : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (tenant) => {
      setActiveTenantId(tenant.id);
      queryClient.invalidateQueries();
      if (isPaidPlan) {
        toast.success("Tienda creada. Realiza el pago para activarla.");
        navigate({ to: "/pago-pendiente" });
      } else {
        toast.success("¡Tienda creada! Bienvenido a Nica-POS.");
        navigate({ to: "/dashboard" });
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo crear la tienda"),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Crea tu tienda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configura tu negocio para empezar. Tienes 14 días de prueba gratis.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del negocio</Label>
              <Input
                id="name"
                placeholder="Pulpería La Esquina"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruc">RUC (opcional)</Label>
              <Input
                id="ruc"
                placeholder="J0310000000000"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Elige un plan</Label>
              <div className="grid gap-3">
                {(plans ?? []).map((plan) => {
                  const meta = PLAN_META[plan.slug] ?? {
                    description: "",
                    features: [],
                  };
                  const selected = planId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setPlanId(plan.id)}
                      className={cn(
                        "relative rounded-xl border p-4 text-left transition-all",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      {meta.popular && (
                        <span className="absolute -top-2 right-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                          Más popular
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 font-semibold text-foreground">
                            {plan.name}
                            {selected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          {meta.description && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {meta.description}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-foreground">
                            ${Number(plan.price_usd)}
                          </div>
                          <div className="text-xs text-muted-foreground">/mes</div>
                        </div>
                      </div>
                      {meta.features.length > 0 && (
                        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                          {meta.features.map((f) => (
                            <li
                              key={f}
                              className="flex items-start gap-1.5 text-xs text-muted-foreground"
                            >
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!name.trim() || createTenant.isPending}
              onClick={() => createTenant.mutate()}
            >
              {createTenant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear tienda
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
