import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, ShieldCheck, TrendingUp, Store } from "lucide-react";
import heroImage from "@/assets/hero-pos.jpg";

const marquee = [
  "Boutiques",
  "Ferreterías",
  "Farmacias",
  "Minimarkets",
  "Distribuidoras",
  "Repuestos",
  "Panaderías",
  "Librerías",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fondos decorativos */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-[var(--brand-violet)]/20 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 md:pt-20 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Columna de texto */}
          <div className="flex flex-col items-start gap-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium tracking-wide text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Hecho en Nicaragua, para Nicaragua
            </div>

            <h1 className="text-[2.75rem] font-bold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]">
              El punto de venta
              <br />
              que <span className="text-gradient">no te frena</span>.
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Factura en segundos, controla inventario por sucursal y mira tu utilidad real —
              en Córdobas y Dólares, con IVA e IR listos para la DGI.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="group h-12 px-6 text-base">
                <Link to="/auth">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
                <Link to="/precios">Ver planes</Link>
              </Button>
            </div>

            {/* Métricas rápidas */}
            <dl className="grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60">
              {[
                { k: "+500", v: "negocios activos" },
                { k: "99.9%", v: "de disponibilidad" },
                { k: "<3s", v: "por factura" },
              ].map((m) => (
                <div key={m.k} className="bg-card px-4 py-4">
                  <dt className="text-2xl font-bold text-foreground">{m.k}</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{m.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Columna visual */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-primary/20 via-transparent to-[var(--brand-violet)]/25 blur-2xl" />

            <div className="relative rotate-[1.2deg] overflow-hidden rounded-[1.75rem] border border-border/70 shadow-2xl transition-transform duration-500 hover:rotate-0">
              <img
                src={heroImage}
                alt="Cajera usando Nica-POS en una tablet dentro de una boutique"
                width={1600}
                height={1200}
                className="block h-auto w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
            </div>

            {/* Tarjetas flotantes */}
            <div className="absolute -left-3 bottom-10 hidden w-52 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-xl backdrop-blur-md sm:block">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-success" />
                Utilidad de hoy
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">C$ 18,420</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-3/4 rounded-full bg-success" />
              </div>
            </div>

            <div className="absolute -right-2 top-8 hidden items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-2 text-xs font-medium shadow-xl backdrop-blur-md sm:flex">
              <Store className="h-4 w-4 text-primary" />
              3 sucursales sincronizadas
            </div>
          </div>
        </div>

        {/* Beneficios en línea */}
        <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Atajos F1–F12, sin mouse
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Datos aislados por tienda
          </span>
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Utilidad neta en tiempo real
          </span>
        </div>
      </div>

      {/* Marquesina de rubros */}
      <div className="relative border-y border-border/60 bg-card/30 py-4">
        <div className="marquee-mask flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
            {[...marquee, ...marquee].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="whitespace-nowrap text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground/70"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10" aria-hidden>
            {[...marquee, ...marquee].map((item, i) => (
              <span
                key={`b-${item}-${i}`}
                className="whitespace-nowrap text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
