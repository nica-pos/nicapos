import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: "$29",
    period: "/mes",
    description: "Ideal para tiendas de un solo mostrador.",
    features: [
      "1 sucursal",
      "2 cajeros activos",
      "Hasta 500 productos",
      "Facturación e impresión térmica",
      "Caja y arqueo básico",
      "Soporte por email",
    ],
    cta: "Elegir Básico",
    popular: false,
  },
  {
    name: "Negocio",
    price: "$59",
    period: "/mes",
    description: "Para comercios en crecimiento con múltiples cajas.",
    features: [
      "3 sucursales",
      "8 cajeros activos",
      "Productos ilimitados",
      "Multimoneda NIO/USD y pagos mixtos",
      "Créditos, apartados y cuentas por cobrar",
      "Dashboard y reportes financieros",
      "Soporte prioritario",
    ],
    cta: "Elegir Negocio",
    popular: true,
  },
  {
    name: "Empresarial",
    price: "$119",
    period: "/mes",
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
    cta: "Contactar ventas",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Planes simples y transparentes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sin contratos de permanencia. Empieza gratis y escala según tu tienda crezca.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                plan.popular
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-card"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Más popular
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="mb-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button variant={plan.popular ? "default" : "outline"} className="w-full" asChild>
                <Link to="/auth">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
