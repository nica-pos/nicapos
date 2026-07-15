import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Loader2,
  PiggyBank,
  ArrowUpRight,
  ShoppingCart,
  Package,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";
import { useFinancials } from "@/hooks/use-analytics";
import { useLatestRate } from "@/hooks/use-fiscal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Panel — Nica-POS" },
      { name: "description", content: "Panel de control de tu tienda en Nica-POS." },
      { property: "og:title", content: "Panel — Nica-POS" },
      { property: "og:description", content: "Panel de control de tu tienda en Nica-POS." },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
});

const statusStyles: Record<string, string> = {
  trial: "border-warning/30 bg-warning/10 text-warning",
  active: "border-success/30 bg-success/10 text-success",
  suspended: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
};
const statusLabels: Record<string, string> = {
  trial: "Periodo de prueba",
  active: "Suscripción activa",
  suspended: "Cuenta suspendida",
  cancelled: "Cuenta cancelada",
};

function DashboardPage() {
  const navigate = useNavigate();
  const { isLoading, hasTenant, tenant, role } = useActiveTenant();
  const { data: isSuperadmin, isLoading: saLoading } = useIsSuperadmin();
  const { data: fin } = useFinancials();
  const latestRate = useLatestRate();

  useEffect(() => {
    if (isLoading || saLoading) return;
    if (!hasTenant) {
      navigate({ to: isSuperadmin ? "/admin" : "/onboarding" });
    }
  }, [isLoading, saLoading, hasTenant, isSuperadmin, navigate]);

  if (isLoading || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const rate = latestRate ?? 36.6;
  const nio = (v: number) =>
    `C$ ${(v * rate).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const usd = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const grossProfit = fin?.grossProfitUsd ?? 0;
  const netProfit = fin?.netProfitUsd ?? 0;
  const profitPositive = netProfit >= 0;

  const stats = [
    {
      title: "Ventas de hoy",
      value: nio(fin?.todaySalesUsd ?? 0),
      secondary: usd(fin?.todaySalesUsd ?? 0),
      hint: `${fin?.todayCount ?? 0} venta(s) registradas`,
      icon: TrendingUp,
      accent: "text-primary bg-primary/10",
    },
    {
      title: "Costo de ventas",
      value: nio(fin?.cogsUsd ?? 0),
      secondary: usd(fin?.cogsUsd ?? 0),
      hint: `Utilidad bruta ${usd(grossProfit)}`,
      icon: Receipt,
      accent: "text-warning bg-warning/10",
    },
    {
      title: "Gastos de hoy",
      value: nio(fin?.expensesUsd ?? 0),
      secondary: usd(fin?.expensesUsd ?? 0),
      hint: "Egresos de caja",
      icon: Wallet,
      accent: "text-destructive bg-destructive/10",
    },
    {
      title: "Utilidad neta",
      value: nio(netProfit),
      secondary: usd(netProfit),
      hint: profitPositive ? "Después de COGS y gastos" : "Revisa costos y gastos",
      icon: PiggyBank,
      accent: profitPositive
        ? "text-success bg-success/10"
        : "text-destructive bg-destructive/10",
      trendIcon: profitPositive ? TrendingUp : TrendingDown,
    },
  ];

  const quickActions = [
    { to: "/pos", label: "Nueva venta", icon: ShoppingCart },
    { to: "/productos", label: "Agregar producto", icon: Package },
    { to: "/clientes", label: "Nuevo cliente", icon: Users },
    { to: "/caja", label: "Abrir caja", icon: Wallet },
  ] as const;

  return (
    <DashboardShell>
      {/* Encabezado */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{role ?? "usuario"}</span>
            {tenant.ruc && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>RUC {tenant.ruc}</span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span>Tipo cambio C${rate.toFixed(2)}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hola, {tenant.name}
          </h1>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              statusStyles[tenant.status] ?? statusStyles.trial,
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusLabels[tenant.status] ?? "Estado"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/productos">
              <Package className="h-4 w-4" />
              Productos
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/pos">
              Ir al POS <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card
            key={s.title}
            className="group relative overflow-hidden border-border/60 bg-card/60 p-5 transition-all hover:border-primary/30 hover:bg-card"
          >
            <div className="flex items-start justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.title}
              </div>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", s.accent)}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {s.value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {s.secondary}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              {s.trendIcon ? (
                <s.trendIcon className={cn("h-3 w-3", s.accent.split(" ")[0])} />
              ) : null}
              <span>{s.hint}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Ventas</div>
              <div className="text-xs text-muted-foreground">Últimos 14 días · USD</div>
            </div>
            <div className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
              14D
            </div>
          </div>
          <ChartArea data={fin?.chart ?? []} dataKey="sales" color="var(--primary)" />
        </Card>
        <Card className="border-border/60 bg-card/60 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Utilidad bruta</div>
              <div className="text-xs text-muted-foreground">Últimos 14 días · USD</div>
            </div>
            <div className="rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
              14D
            </div>
          </div>
          <ChartArea data={fin?.chart ?? []} dataKey="profit" color="oklch(0.7 0.15 155)" />
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card className="mt-6 border-border/60 bg-card/60 p-6">
        <div className="mb-4">
          <div className="text-sm font-semibold text-foreground">Acciones rápidas</div>
          <div className="text-xs text-muted-foreground">Los atajos que más usás</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3 transition-all hover:border-primary/40 hover:bg-background"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <a.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 text-sm font-medium text-foreground">{a.label}</div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}

function ChartArea({
  data,
  dataKey,
  color,
}: {
  data: { date: string; sales: number; profit: number }[];
  dataKey: "sales" | "profit";
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => v.slice(5)}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [`$${Number(value).toFixed(2)}`, ""]}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#g-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
