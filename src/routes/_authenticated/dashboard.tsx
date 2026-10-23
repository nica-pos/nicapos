import { useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertTriangle,
  Clock,
  RefreshCcw,
  ArrowUpRight,
  Wrench,
  Coins,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";

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
  const { scopeBranchId, scopeKey } = useActiveBranch();
  const latestRate = useLatestRate();

  useEffect(() => {
    if (isLoading || saLoading) return;
    if (!hasTenant) navigate({ to: isSuperadmin ? "/admin" : "/onboarding" });
  }, [isLoading, saLoading, hasTenant, isSuperadmin, navigate]);

  // Bajo stock de la sucursal activa (o consolidado), agrupado por severidad
  const lowStock = useQuery({
    queryKey: ["dash-lowstock", tenant?.id, scopeKey],
    enabled: !!tenant && !!scopeKey,
    queryFn: async () => {
      let q = supabase
        .from("product_stock")
        .select("stock, products!inner(id, name, min_stock, is_active)")
        .eq("tenant_id", tenant!.id)
        .eq("products.is_active", true);
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q;
      if (error) throw error;
      let out = 0,
        low = 0,
        warn = 0;
      const items: { name: string; qty: number; level: "out" | "low" | "warn" }[] = [];
      // En consolidado se suma el stock de todas las sucursales por producto.
      const byProduct = new Map<string, { name: string; stock: number; min: number }>();
      for (const row of (data ?? []) as any[]) {
        const p = row.products;
        if (!p) continue;
        const prev = byProduct.get(p.id);
        const stock = Number(row.stock ?? 0);
        if (prev) prev.stock += stock;
        else byProduct.set(p.id, { name: p.name, stock, min: Number(p.min_stock ?? 0) });
      }
      for (const p of byProduct.values()) {
        const stock = p.stock;
        const min = p.min;
        if (stock <= 0) {
          out++;
          items.push({ name: p.name, qty: stock, level: "out" });
        } else if (min > 0 && stock <= min) {
          low++;
          items.push({ name: p.name, qty: stock, level: "low" });
        } else if (min > 0 && stock <= min * 2) {
          warn++;
          items.push({ name: p.name, qty: stock, level: "warn" });
        }
      }
      return { out, low, warn, items: items.slice(0, 6) };
    },
  });

  // Top categorías (últimos 30 días por USD vendido)
  const topCats = useQuery({
    queryKey: ["dash-topcats", tenant?.id, scopeKey],
    enabled: !!tenant && !!scopeKey,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      let q = supabase
        .from("sale_items")
        .select(
          "quantity, unit_price_usd, line_total_usd, tax_usd, sales!inner(branch_id), products(category_id, categories(name))",
        )
        .eq("tenant_id", tenant!.id)
        .gte("created_at", since.toISOString());
      if (scopeBranchId) q = q.eq("sales.branch_id", scopeBranchId);
      const { data, error } = await q;
      if (error) throw error;
      const totals = new Map<string, number>();
      let grand = 0;
      for (const it of (data ?? []) as any[]) {
        const catName = it.products?.categories?.name ?? "Sin categoría";
        const v = Number(it.line_total_usd ?? 0) - Number(it.tax_usd ?? 0);
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
    queryKey: ["dash-recent", tenant?.id, scopeKey],
    enabled: !!tenant && !!scopeKey,
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("id, sale_number, total_usd, created_at")
        .eq("tenant_id", tenant!.id)
        .is("voided_at", null);
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Historial de aperturas y cierres de caja (owner/admin)
  const cashHistory = useQuery({
    queryKey: ["dash-cash-history", tenant?.id, scopeKey],
    enabled: !!tenant && !!scopeKey,
    queryFn: async () => {
      let q = supabase
        .from("cash_sessions")
        .select(
          "id, status, opened_at, closed_at, opening_nio, opening_usd, counted_nio, counted_usd, opened_by, closed_by",
        )
        .eq("tenant_id", tenant!.id);
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q.order("opened_at", { ascending: false }).limit(10);

      if (error) throw error;
      const rows = data ?? [];
      const userIds = Array.from(
        new Set(rows.flatMap((r) => [r.opened_by, r.closed_by]).filter(Boolean)),
      ) as string[];
      let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        profiles = Object.fromEntries(
          (profs ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
        );
      }
      return { rows, profiles };
    },
  });

  // Finanzas exclusivas del taller de reparaciones (separadas de ventas POS)
  const repairsSummary = useQuery({
    queryKey: ["dash-repairs-summary", tenant?.id, scopeKey],
    enabled: !!tenant && !!scopeKey,
    queryFn: async () => {
      let q = supabase
        .from("repair_orders")
        .select("id, status, total_usd, parts_cost_usd, paid_usd, created_at")
        .eq("tenant_id", tenant!.id)
        .neq("status", "cancelled");
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      const revenueUsd = rows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
      const partsCostUsd = rows.reduce((s, r) => s + Number(r.parts_cost_usd || 0), 0);
      const profitUsd = Math.max(0, revenueUsd - partsCostUsd);
      const activeCount = rows.filter((r) =>
        ["received", "diagnosing", "waiting_approval", "in_repair", "waiting_parts"].includes(
          r.status,
        ),
      ).length;
      const readyCount = rows.filter((r) => r.status === "ready").length;
      const deliveredCount = rows.filter((r) => r.status === "delivered").length;
      return {
        revenueUsd,
        partsCostUsd,
        profitUsd,
        activeCount,
        readyCount,
        deliveredCount,
        total: rows.length,
      };
    },
  });

  const heroData = fin?.chart ?? [];
  const heroTotal = useMemo(
    () => heroData.reduce((acc, d) => acc + Number(d.sales || 0), 0),
    [heroData],
  );

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

      {/* Finanzas separadas: Taller de Reparaciones */}
      <section className="mt-6 rounded-2xl border border-primary/20 bg-card p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Finanzas del Taller de Reparaciones
                <span className="text-[10px] font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Separado de Ventas POS
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Control exclusivo de ingresos por mano de obra, costos de refacciones y ganancia
                neta.
              </p>
            </div>
          </div>
          <Link
            to="/reparaciones"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
          >
            Ir a Reparaciones <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-3.5">
            <span className="text-xs text-muted-foreground block">Ingresos Taller</span>
            <span className="text-xl font-bold text-white block mt-1">
              {usd(repairsSummary.data?.revenueUsd ?? 0)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {nio(repairsSummary.data?.revenueUsd ?? 0)}
            </span>
          </div>

          <div className="rounded-xl bg-rose-500/10 p-3.5">
            <span className="text-xs text-rose-400 font-medium block">Costo de Refacciones</span>
            <span className="text-xl font-bold text-rose-400 block mt-1">
              {usd(repairsSummary.data?.partsCostUsd ?? 0)}
            </span>
            <span className="text-[11px] text-muted-foreground">Piezas compradas</span>
          </div>

          <div className="rounded-xl bg-emerald-500/10 p-3.5">
            <span className="text-xs text-emerald-400 font-medium block flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ganancia Neta Taller
            </span>
            <span className="text-xl font-extrabold text-emerald-400 block mt-1">
              +{usd(repairsSummary.data?.profitUsd ?? 0)}
            </span>
            <span className="text-[11px] text-emerald-400/80">
              {nio(repairsSummary.data?.profitUsd ?? 0)}
            </span>
          </div>

          <div className="rounded-xl bg-blue-500/10 p-3.5">
            <span className="text-xs text-blue-400 font-medium block">Celulares en Taller</span>
            <span className="text-xl font-bold text-blue-400 block mt-1">
              {(repairsSummary.data?.activeCount ?? 0) + (repairsSummary.data?.readyCount ?? 0)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {repairsSummary.data?.activeCount ?? 0} en proceso ·{" "}
              {repairsSummary.data?.readyCount ?? 0} listos
            </span>
          </div>
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
            <p className="py-8 text-center text-xs text-muted-foreground">
              Sin ventas registradas.
            </p>
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
            <Link
              to="/bitacora"
              className="text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
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
                const name =
                  s.customers?.name ?? `Venta ${s.sale_number ?? "#" + s.id.slice(0, 6)}`;
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
                      <p className="text-[10px] text-muted-foreground">{relTime(s.created_at)}</p>
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

      {/* Aperturas y cierres de caja (histórico) */}
      <section className="mt-6 rounded-2xl border border-white/5 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Aperturas y cierres de caja</h3>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Registro no editable · empleados y administración
            </p>
          </div>
          <Link
            to="/caja"
            className="text-[10px] uppercase tracking-widest text-primary hover:underline"
          >
            Ir a caja
          </Link>
        </div>
        {cashHistory.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (cashHistory.data?.rows.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Sin turnos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-white/5">
                  <th className="py-2 text-left font-medium">Estado</th>
                  <th className="py-2 text-left font-medium">Abierta</th>
                  <th className="py-2 text-left font-medium">Abrió</th>
                  <th className="py-2 text-left font-medium">Cerrada</th>
                  <th className="py-2 text-left font-medium">Cerró</th>
                  <th className="py-2 text-right font-medium">Apertura</th>
                  <th className="py-2 text-right font-medium">Contado</th>
                </tr>
              </thead>
              <tbody>
                {cashHistory.data!.rows.map((s: any) => {
                  const openBy = s.opened_by ? cashHistory.data!.profiles[s.opened_by] : null;
                  const closeBy = s.closed_by ? cashHistory.data!.profiles[s.closed_by] : null;
                  const nameOf = (p: any) => p?.full_name || p?.email || "—";
                  return (
                    <tr key={s.id} className="border-b border-white/5 text-white">
                      <td className="py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            s.status === "open"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-white/5 text-muted-foreground",
                          )}
                        >
                          {s.status === "open" ? "Abierta" : "Cerrada"}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(s.opened_at).toLocaleString("es-NI")}
                      </td>
                      <td className="py-2">{nameOf(openBy)}</td>
                      <td className="py-2 text-muted-foreground">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString("es-NI") : "—"}
                      </td>
                      <td className="py-2">{s.closed_at ? nameOf(closeBy) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">
                        C${Number(s.opening_nio ?? 0).toFixed(0)} · $
                        {Number(s.opening_usd ?? 0).toFixed(0)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {s.closed_at
                          ? `C$${Number(s.counted_nio ?? 0).toFixed(0)} · $${Number(s.counted_usd ?? 0).toFixed(0)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
        <p className={cn("text-[10px] font-bold uppercase tracking-wider", styles.label)}>
          {title}
        </p>
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
