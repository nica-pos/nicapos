import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Wallet,
  Loader2,
  PiggyBank,
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

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  trial: { label: "Prueba", variant: "secondary" },
  active: { label: "Activa", variant: "default" },
  suspended: { label: "Suspendida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "destructive" },
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
      // Un superadmin sin tienda va a la consola de administración, no a onboarding.
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
  const nio = (usd: number) => `C$ ${(usd * rate).toFixed(2)}`;
  const usd = (v: number) => `$${v.toFixed(2)}`;

  const stats = [
    {
      title: "Ventas de hoy",
      value: nio(fin?.todaySalesUsd ?? 0),
      icon: TrendingUp,
      change: `${fin?.todayCount ?? 0} venta(s) · ${usd(fin?.todaySalesUsd ?? 0)}`,
    },
    {
      title: "Costo de ventas (COGS)",
      value: nio(fin?.cogsUsd ?? 0),
      icon: Receipt,
      change: `Utilidad bruta ${usd(fin?.grossProfitUsd ?? 0)}`,
    },
    {
      title: "Gastos de hoy",
      value: nio(fin?.expensesUsd ?? 0),
      icon: Wallet,
      change: "Egresos de caja",
    },
    {
      title: "Utilidad neta real",
      value: nio(fin?.netProfitUsd ?? 0),
      icon: PiggyBank,
      change: `${usd(fin?.netProfitUsd ?? 0)} después de COGS y gastos`,
    },
  ];

  const status = statusLabels[tenant.status] ?? statusLabels.trial;

  return (
    <DashboardShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{tenant.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            Tu rol: <span className="capitalize">{role}</span>
            {tenant.ruc ? ` · RUC ${tenant.ruc}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" /> Ventas — últimos 14 días (USD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartArea data={fin?.chart ?? []} dataKey="sales" color="hsl(var(--primary))" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4 text-primary" /> Utilidad bruta — últimos 14 días (USD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartArea data={fin?.chart ?? []} dataKey="profit" color="hsl(142 71% 45%)" />
          </CardContent>
        </Card>
      </div>
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
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
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
        />
        <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
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
