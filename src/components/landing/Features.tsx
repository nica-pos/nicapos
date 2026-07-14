import {
  ScanLine,
  Banknote,
  FileText,
  Package,
  Users,
  BarChart3,
  Receipt,
  Calculator,
} from "lucide-react";

const features = [
  {
    icon: ScanLine,
    title: "POS ultrarrápido",
    description:
      "Buscador predictivo por código, nombre, categoría o marca. Atajos de teclado F1-F12 para operar sin mouse.",
  },
  {
    icon: Banknote,
    title: "Multimoneda NIO/USD",
    description:
      "Precios en Córdobas y Dólares con tasa de cambio del día. Pagos mixtos y calculadora de vuelto inteligente.",
  },
  {
    icon: FileText,
    title: "Facturación legal",
    description:
      "Tickets térmicos 80mm, facturas carta y proformas en PDF con RUC nicaragüense, IVA e IR desglosados.",
  },
  {
    icon: Package,
    title: "Inventario con CPP",
    description:
      "Kardex histórico con costo promedio ponderado, alertas de stock, combos, auditoría física y ajustes.",
  },
  {
    icon: Users,
    title: "Créditos y apartados",
    description:
      "Cuentas por cobrar con límites de crédito, abonos, apartados con congelamiento de stock y cuentas por pagar.",
  },
  {
    icon: BarChart3,
    title: "Dashboard financiero",
    description:
      "Ventas del día, costo de mercancía vendida, gastos operativos y utilidad neta real con gráficos dinámicos.",
  },
  {
    icon: Receipt,
    title: "Cajas inteligentes",
    description:
      "Apertura y cierre con arqueo ciego, egresos e ingresos extraordinarios, y pulso para cajón monedero.",
  },
  {
    icon: Calculator,
    title: "Contabilidad localizada",
    description:
      "IVA 15% configurable, retención IR 2% por gran contribuyente, múltiples sucursales y white-label.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Todo lo que tu tienda necesita
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Diseñado desde cero para el ritmo del mostrador nicaragüense: rápido, seguro y
            fiscalmente correcto.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
