import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useBranches } from "@/hooks/use-branch";

export interface BranchReportRow {
  branchId: string | null;
  branchName: string;
  salesCount: number;
  totalUsd: number;
  cogsUsd: number;
  profitUsd: number;
  avgTicketUsd: number;
  marginPct: number;
}

export interface BranchReport {
  rows: BranchReportRow[];
  totals: Omit<BranchReportRow, "branchId" | "branchName">;
}

/** Comparativa de ventas entre sucursales en un rango de fechas (inclusive). */
export function useBranchComparison(from: string, to: string) {
  const { tenant } = useActiveTenant();
  const { data: branches } = useBranches();

  return useQuery({
    queryKey: ["branch-comparison", tenant?.id, from, to, (branches ?? []).length],
    enabled: !!tenant && !!from && !!to,
    queryFn: async (): Promise<BranchReport> => {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59.999`).toISOString();

      const [{ data: sales, error: se }, { data: items, error: ie }] = await Promise.all([
        supabase
          .from("sales")
          .select("id, branch_id, total_usd, subtotal_usd, created_at")
          .eq("tenant_id", tenant!.id)
          .is("voided_at", null)
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("sale_items")
          .select("sale_id, quantity, unit_cost_usd, created_at")
          .eq("tenant_id", tenant!.id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
      ]);
      if (se) throw se;
      if (ie) throw ie;

      const cogsBySale = new Map<string, number>();
      for (const it of items ?? []) {
        const c = Number(it.unit_cost_usd ?? 0) * Number(it.quantity ?? 0);
        cogsBySale.set(it.sale_id, (cogsBySale.get(it.sale_id) ?? 0) + c);
      }

      const nameOf = new Map<string, string>();
      for (const b of branches ?? []) nameOf.set(b.id, b.name);

      const acc = new Map<string, { count: number; total: number; cogs: number }>();
      for (const s of sales ?? []) {
        const key = s.branch_id ?? "__none__";
        const cur = acc.get(key) ?? { count: 0, total: 0, cogs: 0 };
        cur.count += 1;
        cur.total += Number(s.total_usd ?? 0);
        cur.cogs += cogsBySale.get(s.id) ?? 0;
        acc.set(key, cur);
      }

      const rows: BranchReportRow[] = Array.from(acc.entries()).map(([key, v]) => {
        const profit = v.total - v.cogs;
        return {
          branchId: key === "__none__" ? null : key,
          branchName:
            key === "__none__" ? "Sin sucursal (histórico)" : (nameOf.get(key) ?? "Sucursal eliminada"),
          salesCount: v.count,
          totalUsd: v.total,
          cogsUsd: v.cogs,
          profitUsd: profit,
          avgTicketUsd: v.count > 0 ? v.total / v.count : 0,
          marginPct: v.total > 0 ? (profit / v.total) * 100 : 0,
        };
      });

      // Sucursales activas sin ventas también aparecen (en cero).
      for (const b of branches ?? []) {
        if (!acc.has(b.id)) {
          rows.push({
            branchId: b.id,
            branchName: b.name,
            salesCount: 0,
            totalUsd: 0,
            cogsUsd: 0,
            profitUsd: 0,
            avgTicketUsd: 0,
            marginPct: 0,
          });
        }
      }

      rows.sort((a, b) => b.totalUsd - a.totalUsd);

      const totals = rows.reduce(
        (t, r) => {
          t.salesCount += r.salesCount;
          t.totalUsd += r.totalUsd;
          t.cogsUsd += r.cogsUsd;
          t.profitUsd += r.profitUsd;
          return t;
        },
        { salesCount: 0, totalUsd: 0, cogsUsd: 0, profitUsd: 0, avgTicketUsd: 0, marginPct: 0 },
      );
      totals.avgTicketUsd = totals.salesCount > 0 ? totals.totalUsd / totals.salesCount : 0;
      totals.marginPct = totals.totalUsd > 0 ? (totals.profitUsd / totals.totalUsd) * 100 : 0;

      return { rows, totals };
    },
  });
}

export interface SaleDetailRow {
  sale_number: number | string;
  created_at: string;
  branch_id: string | null;
  total_usd: number;
  subtotal_usd: number;
  payment_method: string | null;
}

/** Detalle de ventas para exportar (opcionalmente filtrado por sucursal). */
export function useSalesExport(from: string, to: string, branchId: string | null) {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["sales-export", tenant?.id, from, to, branchId],
    enabled: false, // se dispara manualmente al exportar
    queryFn: async () => {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59.999`).toISOString();
      let q = supabase
        .from("sales")
        .select("sale_number, created_at, branch_id, total_usd, subtotal_usd, payment_method")
        .eq("tenant_id", tenant!.id)
        .is("voided_at", null)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SaleDetailRow[];
    },
  });
}

/** Genera y descarga un CSV (compatible con Excel, separador coma, BOM UTF-8). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
