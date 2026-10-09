import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";

export type RepairOrder = Database["public"]["Tables"]["repair_orders"]["Row"];
export type RepairPart = Database["public"]["Tables"]["repair_parts"]["Row"];

export const REPAIR_STATUSES: { value: string; label: string }[] = [
  { value: "received", label: "Recibido" },
  { value: "diagnosing", label: "En diagnóstico" },
  { value: "waiting_approval", label: "Esperando aprobación" },
  { value: "waiting_parts", label: "Esperando repuestos" },
  { value: "in_repair", label: "En reparación" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];
export const statusLabel = (s: string) => REPAIR_STATUSES.find((x) => x.value === s)?.label ?? s;
export const repairNumber = (n: number) => `REP-${String(n).padStart(4, "0")}`;

/** Saldo pendiente de una orden (nunca negativo). */
export function repairBalance(o: Pick<RepairOrder, "total_usd" | "paid_usd">) {
  return Math.max(0, Math.round((Number(o.total_usd) - Number(o.paid_usd)) * 100) / 100);
}
/** Ganancia = total cobrable − costo de repuestos. */
export function repairProfit(o: Pick<RepairOrder, "total_usd" | "parts_cost_usd">) {
  return Math.round((Number(o.total_usd) - Number(o.parts_cost_usd)) * 100) / 100;
}

export function useRepairOrders() {
  const { tenant } = useActiveTenant();
  const { scopeBranchId, scopeKey } = useActiveBranch();
  return useQuery({
    queryKey: ["repairs", tenant?.id, scopeKey],
    enabled: !!tenant,
    queryFn: async () => {
      let q = supabase.from("repair_orders").select("*").eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false }).limit(1000);
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as RepairOrder[];
    },
  });
}

export function useRepairOrder(id: string) {
  return useQuery({
    queryKey: ["repair", id],
    queryFn: async () => {
      const [o, parts, hist, notes, pays, quotes] = await Promise.all([
        supabase.from("repair_orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("repair_parts").select("*").eq("order_id", id).order("created_at"),
        supabase.from("repair_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false }),
        supabase.from("repair_notes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
        supabase.from("repair_payments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
        supabase.from("repair_quotes").select("*").eq("order_id", id).order("version", { ascending: false }),
      ]);
      if (o.error) throw o.error;
      let customer: { name: string; phone: string | null } | null = null;
      if (o.data) {
        const c = await supabase.from("customers").select("name, phone").eq("id", o.data.customer_id).maybeSingle();
        customer = c.data;
      }
      const secret = await supabase.from("repair_secrets").select("unlock_code").eq("order_id", id).maybeSingle();
      return {
        order: o.data, customer, unlockCode: secret.data?.unlock_code ?? null,
        parts: parts.data ?? [], history: hist.data ?? [], notes: notes.data ?? [],
        payments: pays.data ?? [], quotes: quotes.data ?? [],
      };
    },
  });
}

export function useTechnicians() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["technicians", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data } = await supabase.from("tenant_members").select("user_id, role")
        .eq("tenant_id", tenant!.id).in("role", ["technician", "owner", "admin"]);
      const ids = (data ?? []).map((m) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
      return (data ?? []).map((m) => {
        const p = (profs ?? []).find((x) => x.id === m.user_id);
        return { id: m.user_id, role: m.role, name: p?.full_name || p?.email || m.user_id.slice(0, 8) };
      });
    },
  });
}

/** Ejecuta un RPC de reparaciones e invalida caché. */
export function useRepairAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) throw error;
      return data as unknown;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repair"] });
    },
  });
}
