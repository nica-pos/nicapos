import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

// ---------- Financial dashboard ----------
export interface FinancialSummary {
  todaySalesUsd: number;
  todayCount: number;
  cogsUsd: number;
  grossProfitUsd: number;
  expensesUsd: number;
  netProfitUsd: number;
  chart: { date: string; sales: number; profit: number }[];
}

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function useFinancials() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["financials", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<FinancialSummary> => {
      const since = startOfLocalDay(new Date());
      since.setDate(since.getDate() - 13); // last 14 days
      const sinceIso = since.toISOString();

      const [{ data: sales }, { data: items }, { data: movements }, { data: rateRow }] =
        await Promise.all([
          supabase
            .from("sales")
            .select("id, total_usd, subtotal_usd, created_at")
            .eq("tenant_id", tenant!.id)
            .gte("created_at", sinceIso),
          supabase
            .from("sale_items")
            .select("sale_id, quantity, unit_cost_usd, created_at")
            .eq("tenant_id", tenant!.id)
            .gte("created_at", sinceIso),
          supabase
            .from("cash_movements")
            .select("type, amount, currency, created_at")
            .eq("tenant_id", tenant!.id)
            .gte("created_at", sinceIso),
          supabase
            .from("exchange_rates")
            .select("rate")
            .eq("tenant_id", tenant!.id)
            .order("effective_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      // Real configured exchange rate (NIO per USD); fallback avoids div-by-zero.
      const nioPerUsd = rateRow?.rate ? Number(rateRow.rate) : 0;

      const todayStart = startOfLocalDay(new Date()).getTime();

      // COGS per sale
      const cogsBySale = new Map<string, number>();
      for (const it of items ?? []) {
        const c = Number(it.unit_cost_usd) * Number(it.quantity);
        cogsBySale.set(it.sale_id, (cogsBySale.get(it.sale_id) ?? 0) + c);
      }

      let todaySalesUsd = 0;
      let todayCount = 0;
      let cogsUsd = 0;
      let grossProfitUsd = 0;

      // build 14-day buckets
      const buckets = new Map<string, { sales: number; profit: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = startOfLocalDay(new Date());
        d.setDate(d.getDate() - i);
        buckets.set(d.toISOString().slice(0, 10), { sales: 0, profit: 0 });
      }

      for (const s of sales ?? []) {
        const ts = new Date(s.created_at).getTime();
        const sub = Number(s.subtotal_usd);
        const cogs = cogsBySale.get(s.id) ?? 0;
        const profit = sub - cogs;
        const key = startOfLocalDay(new Date(s.created_at))
          .toISOString()
          .slice(0, 10);
        const b = buckets.get(key);
        if (b) {
          b.sales += Number(s.total_usd);
          b.profit += profit;
        }
        if (ts >= todayStart) {
          todaySalesUsd += Number(s.total_usd);
          todayCount += 1;
          cogsUsd += cogs;
          grossProfitUsd += profit;
        }
      }

      // today's expenses (cash egresos)
      let expensesUsd = 0;
      for (const m of movements ?? []) {
        if (new Date(m.created_at).getTime() < todayStart) continue;
        if (m.type === "expense" || m.type === "egreso" || m.type === "out") {
          const amt =
            m.currency === "USD" ? Number(m.amount) : Number(m.amount) / 36.6;
          expensesUsd += amt;
        }
      }

      return {
        todaySalesUsd,
        todayCount,
        cogsUsd,
        grossProfitUsd,
        expensesUsd,
        netProfitUsd: grossProfitUsd - expensesUsd,
        chart: Array.from(buckets.entries()).map(([date, v]) => ({
          date,
          sales: Number(v.sales.toFixed(2)),
          profit: Number(v.profit.toFixed(2)),
        })),
      };
    },
  });
}

// ---------- Audit log ----------
export function useAuditLogs() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["audit_logs", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as AuditLog[];
    },
  });
}
