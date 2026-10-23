import {
  ScanLine,
  Banknote,
  FileText,
  Package,
  Users,
  BarChart3,
  Receipt,
  Calculator,
  ArrowUpRight,
} from "lucide-react";

type Feature = {
  icon: typeof ScanLine;
  title: string;
  description: string;
  /** Clases de posicionamiento dentro del bento grid */
  span: string;
  highlight?: boolean;
};

const features: Feature[] = [
  {
    icon: ScanLine,
    title: "POS ultrarrápido",
    description:
      "Buscador predictivo por código, nombre, categoría o marca. Atajos de teclado F1-F12 para operar sin mouse y cobrar en segundos.",
    span: "md:col-span-2 md:row-span-2",
    highlight: true,
  },
  {
    icon: Banknote,
    title: "Multimoneda NIO/USD",
    description: "Córdobas y Dólares con tasa del día, pagos mixtos y vuelto inteligente.",
    span: "md:col-span-2",
  },
  {
    icon: FileText,
    title: "Facturación legal",
    description: "Tickets 80mm, carta y proformas PDF con RUC, IVA e IR desglosados.",
    span: "md:col-span-1",
  },
  {
    icon: Package,
    title: "Inventario con CPP",
    description: "Kardex con costo promedio, alertas de stock y auditoría física.",
    span: "md:col-span-1",
  },
  {
    icon: Users,
    title: "Créditos y apartados",
    description: "Cuentas por cobrar, abonos y apartados con stock congelado.",
    span: "md:col-span-1",
  },
  {
    icon: BarChart3,
    title: "Dashboard financiero",
    description: "Ventas, costo de mercancía, gastos y utilidad neta real.",
    span: "md:col-span-1",
  },
  {
    icon: Receipt,
    title: "Cajas inteligentes",
    description: "Arqueo ciego, egresos e ingresos y pulso al cajón monedero.",
    span: "md:col-span-1",
  },
  {
    icon: Calculator,
    title: "Contabilidad localizada",
    description: "IVA 15%, retención IR 2%, multi-sucursal y white-label.",
    span: "md:col-span-1",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Plataforma completa
            </p>
            <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Todo lo que tu tienda
              <br className="hidden sm:block" /> necesita, en un solo lugar
            </h2>
          </div>
          <p className="max-w-sm text-base text-muted-foreground">
            Diseñado desde cero para el ritmo del mostrador nicaragüense: rápido, seguro y
            fiscalmente correcto.
          </p>
        </div>

        <div className="mt-14 grid auto-rows-[minmax(11rem,auto)] grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 ${
                feature.highlight ? "bg-gradient-to-br from-primary/15 via-card to-card" : "bg-card"
              } ${feature.span}`}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex items-start justify-between">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 -translate-y-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
              </div>

              <div className="relative mt-6">
                <h3
                  className={`font-semibold text-card-foreground ${
                    feature.highlight ? "text-2xl" : "text-lg"
                  }`}
                >
                  {feature.title}
                </h3>
                <p
                  className={`mt-2 text-muted-foreground ${
                    feature.highlight ? "text-base" : "text-sm"
                  }`}
                >
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
