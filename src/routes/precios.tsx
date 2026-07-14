import { createFileRoute } from "@tanstack/react-router";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";

export const Route = createFileRoute("/precios")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Precios — Nica-POS" },
      {
        name: "description",
        content:
          "Planes de Nica-POS para tiendas, negocios en crecimiento y empresas multi-sucursal en Nicaragua.",
      },
      { property: "og:title", content: "Precios — Nica-POS" },
      {
        property: "og:description",
        content:
          "Planes de Nica-POS para tiendas, negocios en crecimiento y empresas multi-sucursal en Nicaragua.",
      },
      { property: "og:url", content: "/precios" },
    ],
    links: [{ rel: "canonical", href: "/precios" }],
  }),
});

function PricingPage() {
  return (
    <LandingLayout>
      <div className="bg-radial-glow pt-10 pb-4">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Planes y precios
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Elige el plan que se ajuste al tamaño de tu operación.
          </p>
        </div>
      </div>
      <Pricing />
      <CTA />
    </LandingLayout>
  );
}
