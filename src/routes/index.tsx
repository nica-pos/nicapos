import { createFileRoute } from "@tanstack/react-router";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { Testimonials } from "@/components/landing/Testimonials";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Nica-POS — Punto de Venta y Contabilidad para Nicaragua" },
      {
        name: "description",
        content:
          "Sistema POS y contable SaaS multi-tenant para Nicaragua. Facturación, inventario, Córdobas y Dólares, IVA e IR, cajas e informes financieros.",
      },
      {
        property: "og:title",
        content: "Nica-POS — Punto de Venta y Contabilidad para Nicaragua",
      },
      {
        property: "og:description",
        content:
          "Sistema POS y contable SaaS multi-tenant para Nicaragua. Facturación, inventario, Córdobas y Dólares, IVA e IR, cajas e informes financieros.",
      },
    ],
  }),
});

function Home() {
  return (
    <LandingLayout>
      <Hero />
      <Features />
      <Testimonials />
      <Pricing />
      <CTA />
    </LandingLayout>
  );
}
