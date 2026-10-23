import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  ShoppingCart,
  Wallet,
  HandCoins,
  ArrowUpRight,
  Receipt,
  Lock,
} from "lucide-react";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useLatestRate } from "@/hooks/use-fiscal";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cajero")({
  component: CajeroPage,
  head: () => ({
    meta: [
      { title: "Panel del cajero — Nica-POS" },
      { name: "description", content: "Resumen de ventas y turnos del cajero." },
    ],
  }),
});

function CajeroPage() {
  const { isLoading, tenant } = useActiveTenant();
  const rate = useLatestRate() ?? 36.6;
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const enabled = !!tenant && !!userId;

  // Ventas del cajero (hoy + últimos 14 días para gráfico simple)
  const salesStats = useQuery({
    queryKey: ["cashier-sales", tenant?.id, userId],
    enabled,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, total_usd, created_at")
        .eq("tenant_id", tenant!.id)
        .eq("sold_by", userId!)
        .is("voided_at", null)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const todayISO = new Date().toISOString().slice(0, 10);
      let todayUsd = 0,
        todayCount = 0,
        totalUsd = 0;
      for (const s of rows) {
        totalUsd += Number(s.total_usd ?? 0);
        if (s.created_at.slice(0, 10) === todayISO) {
          todayUsd += Number(s.total_usd ?? 0);
          todayCount++;
        }
      }
      return { rows, todayUsd, todayCount, totalUsd };
    },
  });

  // Historial de turnos (aperturas/cierres) del cajero — solo lectura
  const sessions = useQuery({
    queryKey: ["cashier-sessions", tenant?.id, userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select(
          "id, status, opened_at, closed_at, opening_nio, opening_usd, counted_nio, counted_usd, opened_by, closed_by",
        )
        .eq("tenant_id", tenant!.id)
        .or(`opened_by.eq.${userId},closed_by.eq.${userId}`)
        .order("opened_at", { ascending: false })
        .limit(20);
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

  const usd = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const nio = (v: number) =>
    `C$ ${(v * rate).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const openSession = sessions.data?.find((s) => s.status === "open");

  return (
    <DashboardShell>
      {/* Hero — ventas del día */}
      <section className="rounded-3xl border border-white/5 bg-card p-6 shadow-2xl shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Mis ventas de hoy
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-white tabular-nums">
              {nio(salesStats.data?.todayUsd ?? 0)}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {usd(salesStats.data?.todayUsd ?? 0)} · {salesStats.data?.todayCount ?? 0} ventas hoy
              · {usd(salesStats.data?.totalUsd ?? 0)} en 14 días
            </p>
          </div>
          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
          >
            Nueva venta <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <QuickAction to="/pos" title="Punto de venta" icon={ShoppingCart} tone="cyan" />
          <QuickAction
            to="/caja"
            title={openSession ? "Caja abierta" : "Abrir caja"}
            icon={Wallet}
            tone="violet"
          />
          <QuickAction to="/clientes" title="Clientes y créditos" icon={HandCoins} tone="orange" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Últimas ventas del cajero */}
        <section className="rounded-2xl border border-white/5 bg-card p-5 lg:col-span-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Mis últimas ventas</h3>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </div>
          {salesStats.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (salesStats.data?.rows.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Aún no tienes ventas.</p>
          ) : (
            <div className="space-y-3">
              {salesStats.data!.rows.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">
                      Venta #{s.sale_number ?? s.id.slice(0, 6)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{relTime(s.created_at)}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    +{usd(Number(s.total_usd))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial de turnos — solo lectura */}
        <section className="rounded-2xl border border-white/5 bg-card p-5 lg:col-span-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Historial de mis turnos</h3>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Lock className="h-3 w-3" /> solo lectura
            </span>
          </div>
          {sessions.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (sessions.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Sin aperturas registradas.
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.data!.map((s) => (
                <div key={s.id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        s.status === "open"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {s.status === "open" ? "Abierta" : "Cerrada"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.opened_at).toLocaleString("es-NI")}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Apertura</p>
                      <p className="text-white tabular-nums">
                        C$ {Number(s.opening_nio ?? 0).toFixed(2)} · ${" "}
                        {Number(s.opening_usd ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cierre contado</p>
                      <p className="text-white tabular-nums">
                        {s.closed_at
                          ? `C$ ${Number(s.counted_nio ?? 0).toFixed(2)} · $ ${Number(s.counted_usd ?? 0).toFixed(2)}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {s.closed_at && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Cerrada {new Date(s.closed_at).toLocaleString("es-NI")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function QuickAction({
  to,
  title,
  icon: Icon,
  tone,
}: {
  to: string;
  title: string;
  icon: typeof ShoppingCart;
  tone: "cyan" | "violet" | "orange";
}) {
  const styles = {
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    orange: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  }[tone];
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5",
        styles,
      )}
    >
      <Icon className="h-4 w-4" />
      {title}
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
