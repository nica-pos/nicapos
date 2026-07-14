import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section id="support" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 px-6 py-16 text-center md:px-12">
          <div className="absolute inset-0 bg-radial-glow" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Listo para modernizar tu caja?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Únete a las tiendas que ya venden más rápido con Nica-POS. Configura tu cuenta en
              minutos y empieza a facturar hoy.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Crear cuenta gratis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/precios">Ver planes</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
