import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

const points = ["Sin tarjeta de crédito", "Configuración en minutos", "Soporte en español"];

export function CTA() {
  return (
    <section id="support" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card px-6 py-16 md:px-14 md:py-20">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.05]" />
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-[110px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[var(--brand-violet)]/25 blur-[110px]" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Moderniza tu caja
                <br />
                <span className="text-gradient">hoy mismo.</span>
              </h2>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Únete a las tiendas que ya venden más rápido con Nica-POS. Crea tu cuenta y empieza
                a facturar en minutos.
              </p>

              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Button size="lg" asChild className="group h-12 w-full px-6 text-base lg:w-auto">
                <Link to="/auth">
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 w-full px-6 text-base lg:w-auto"
              >
                <Link to="/precios">Ver planes</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
