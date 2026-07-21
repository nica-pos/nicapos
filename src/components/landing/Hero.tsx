import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";
import heroImage from "@/assets/hero-pos.jpg";
import heroVideo from "@/assets/landing-hero.mp4.asset.json";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
      <div className="absolute inset-0 bg-radial-glow" />
      <div className="absolute inset-0 bg-grid opacity-[0.03]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Hecho para comercios nicaragüenses
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Vende más rápido. <br />
              <span className="text-gradient">Controla tu negocio.</span>
            </h1>

            <p className="max-w-xl text-lg text-muted-foreground">
              Nica-POS es el punto de venta y sistema contable en la nube diseñado para el mercado de
              Nicaragua: Córdobas y Dólares, IVA e IR, inventario con costo promedio, cajas, créditos y
              facturación legal.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Empezar gratis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/precios">Ver planes</Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span>Ventas con atajos de teclado</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Datos aislados por tienda</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>Utilidad neta en tiempo real</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-2xl">
              <video
                src={heroVideo.url}
                poster={heroImage}
                autoPlay
                muted
                loop
                playsInline
                width={1920}
                height={1088}
                className="w-full h-auto block"
                aria-label="Demostración de Nica-POS en uso"
              />

              {/* Overlay de texto en español legible */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-background/60" />

              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6 md:p-8">
                <div className="flex flex-wrap gap-2 animate-fade-in">
                  <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg backdrop-blur">
                    Facturación legal
                  </span>
                  <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-lg backdrop-blur border border-border/60">
                    IVA + IR
                  </span>
                  <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-lg backdrop-blur border border-border/60">
                    Multi-sucursal
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-background/85 px-4 py-2 backdrop-blur border border-border/60 shadow-xl">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ventas de hoy</div>
                    <div className="text-2xl sm:text-3xl font-bold text-gradient">C$ 48,320</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-background/85 px-2.5 py-1 backdrop-blur border border-border/60 shadow font-medium text-foreground">
                      📊 Inventario en tiempo real
                    </span>
                    <span className="rounded-md bg-background/85 px-2.5 py-1 backdrop-blur border border-border/60 shadow font-medium text-foreground">
                      💳 Créditos y cobros
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
