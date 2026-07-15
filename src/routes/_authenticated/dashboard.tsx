import { useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertTriangle,
  Clock,
  RefreshCcw,
  ArrowUpRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";
import { useFinancials } from "@/hooks/use-analytics";
import { useLatestRate } from "@/hooks/use-fiscal";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Panel — Nica-POS" },
      { name: "description", content: "Panel de control de tu tienda en Nica-POS." },
      { property: "og:title", content: "Panel — Nica-POS" },
      { property: "og:description", content: "Panel de control de tu tienda en Nica-POS." },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
});

function DashboardPage() {
  const navigate = useNavigate();
  const { isLoading, hasTenant, tenant } = useActiveTenant();
  const { data: isSuperadmin, isLoading: saLoading } = useIsSuperadmin();
  const { data: fin } = useFinancials();
  const latestRate = useLatestRate();

  useEffect(() => {
    if (isLoading || saLoading) return;
    if (!hasTenant) navigate({ to: isSuperadmin ? "/admin" : "/onboarding" });
  }, [isLoading, saLoading, hasTenant, isSuperadmin, navigate]);

  // Bajo stock, agrupado por severidad
  const lowStock = useQuery({
    queryKey: ["dash-lowstock", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, min_stock, category_id, categories(name)")
        .eq("tenant_id", tenant!.id)
        .eq("is_active", true);
      if (error) throw error;
      let out = 0, low = 0, warn = 0;
      const items: { name: string; qty: number; level: "out" | "low" | "warn" }[] = [];
      for (const p of data ?? []) {
        const stock = Number(p.stock ?? 0);
        const min = Number(p.min_stock ?? 0);
        if (stock <= 0) { out++; items.push({ name: p.name, qty: stock, level: "out" }); }
        else if (min > 0 && stock <= min) { low++; items.push({ name: p.name, qty: stock, level: "low" }); }
        else if (min > 0 && stock <= min * 2) { warn++; items.push({ name: p.name, qty: stock, level: "warn" }); }
      }
      return { out, low, warn, items: items.slice(0, 6) };
    },
  });

  // Top categorías (últimos 30 días por USD vendido)
  const topCats = useQuery({
    queryKey: ["dash-topcats", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("sale_items")
        .select("subtotal_usd, products(category_id, categories(name))")
        .eq("tenant_id", tenant!.id)
        .gte("created_at", since.toISOString());
      if (error) throw error;
      const totals = new Map<string, number>();
      let grand = 0;
      for (const it of (data ?? []) as any[]) {
        const catName = it.products?.categories?.name ?? "Sin categoría";
        const v = Number(it.subtotal_usd ?? 0);
        totals.set(catName, (totals.get(catName) ?? 0) + v);
        grand += v;
      }
      const arr = Array.from(totals.entries())
        .map(([name, total]) => ({ name, total, pct: grand > 0 ? (total / grand) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 4);
      return { rows: arr, grand };
    },
  });

  // Últimas transacciones
  const recent = useQuery({
    queryKey: ["dash-recent", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, total_usd, created_at, customers(name)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const heroData = fin?.chart ?? [];
  const heroTotal = useMemo(
    () => heroData.reduce((acc, d) => acc + Number(d.sales || 0), 0),
    [heroData],
  );

  const catColors = ["bg-cyan-400", "bg-violet-500", "bg-orange-400", "bg-emerald-400"];

  return (
    <DashboardShell>
      {/* Hero chart */}
      <section className="rounded-3xl border border-white/5 bg-card p-6 shadow-2xl shadow-black/40">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Ventas · últimos 14 días
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-white tabular-nums">
              {nio(heroTotal)}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {usd(heroTotal)} · hoy {nio(fin?.todaySalesUsd ?? 0)} ({fin?.todayCount ?? 0} ventas)
            </p>
          </div>
          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
          >
            Nueva venta <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={heroData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="salesStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(13,15,20,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "white",
                }}
                formatter={(value: number) => [`$${Number(value).toFixed(2)}`, "Ventas"]}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="url(#salesStroke)"
                strokeWidth={3}
                fill="url(#salesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Secondary grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Categorías */}
        <section className="rounded-2xl border border-white/5 bg-card p-5 lg:col-span-4">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Ventas por categoría</h3>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">30d</span>
          </div>
          {topCats.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (topCats.data?.rows.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sin ventas registradas.</p>
          ) : (
            <div className="space-y-4">
              {topCats.data!.rows.map((c, i) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{c.name}</span>
                    <span className="text-white tabular-nums">{c.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn("h-full rounded-full", catColors[i % catColors.length])}
                      style={{ width: `${Math.max(2, c.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Alertas inventario */}
        <section className="grid grid-rows-3 gap-3 lg:col-span-4">
          <AlertCard
            tone="red"
            title="Sin stock"
            value={`${lowStock.data?.out ?? 0} productos`}
            icon={AlertTriangle}
            href="/inventario"
          />
          <AlertCard
            tone="orange"
            title="Stock bajo"
            value={`${lowStock.data?.low ?? 0} productos`}
            icon={Clock}
            href="/inventario"
          />
          <AlertCard
            tone="violet"
            title="Reposición sugerida"
            value={`${lowStock.data?.warn ?? 0} productos`}
            icon={RefreshCcw}
            href="/proveedores"
          />
        </section>

        {/* Últimas transacciones */}
        <section className="rounded-2xl border border-white/5 bg-card p-5 lg:col-span-4">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Últimas transacciones</h3>
            <Link to="/bitacora" className="text-[10px] uppercase tracking-widest text-primary hover:underline">
              Ver todo
            </Link>
          </div>
          {recent.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (recent.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sin ventas todavía.</p>
          ) : (
            <div className="space-y-4">
              {recent.data!.map((s: any) => {
                const name = s.customers?.name ?? `Venta ${s.sale_number ?? "#" + s.id.slice(0, 6)}`;
                const initials = name
                  .split(" ")
                  .map((p: string) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-[11px] font-semibold text-muted-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {relTime(s.created_at)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      +{usd(Number(s.total_usd))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function AlertCard({
  tone,
  title,
  value,
  icon: Icon,
  href,
}: {
  tone: "red" | "orange" | "violet";
  title: string;
  value: string;
  icon: typeof AlertTriangle;
  href: string;
}) {
  const styles = {
    red: {
      wrap: "bg-[#1c0d0d] border-red-900/30 shadow-red-500/5",
      label: "text-red-400",
      value: "text-red-100",
      iconWrap: "bg-red-500/15 text-red-400",
    },
    orange: {
      wrap: "bg-[#1c150d] border-orange-900/30 shadow-orange-500/5",
      label: "text-orange-400",
      value: "text-orange-100",
      iconWrap: "bg-orange-500/15 text-orange-400",
    },
    violet: {
      wrap: "bg-[#150d1c] border-violet-900/30 shadow-violet-500/5",
      label: "text-violet-400",
      value: "text-violet-100",
      iconWrap: "bg-violet-500/15 text-violet-400",
    },
  }[tone];

  return (
    <Link
      to={href}
      className={cn(
        "group flex items-center justify-between rounded-2xl border p-4 shadow-lg transition-transform hover:-translate-y-0.5",
        styles.wrap,
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-[10px] font-bold uppercase tracking-wider", styles.label)}>{title}</p>
        <p className={cn("mt-0.5 truncate text-sm font-medium", styles.value)}>{value}</p>
      </div>
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", styles.iconWrap)}>
        <Icon className="h-5 w-5" />
      </div>
    </Link>
  );
}

function relTime(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}
