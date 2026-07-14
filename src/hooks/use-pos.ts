import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type CashSession = Database["public"]["Tables"]["cash_sessions"]["Row"];
export type CashMovement = Database["public"]["Tables"]["cash_movements"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];

export type PaymentMethod = "cash_nio" | "cash_usd" | "card" | "transfer";

// ---------------- Products ----------------
export function useProducts() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["products", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveProduct() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      p: Partial<Product> & { name: string },
    ): Promise<Product> => {
      const payload = { ...p, tenant_id: tenant!.id };
      if (p.id) {
        const { data, error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", p.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

// ---------------- Cash sessions ----------------
export function useOpenCashSession() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["cash-session-open", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<CashSession | null> => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    meta: { qc },
  });
}

export function useOpenSessionMutation() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { opening_nio: number; opening_usd: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cash_sessions")
        .insert({
          tenant_id: tenant!.id,
          opened_by: userData.user!.id,
          opening_nio: v.opening_nio,
          opening_usd: v.opening_usd,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash-session-open"] }),
  });
}

export function useCloseSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      counted_nio: number;
      counted_usd: number;
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cash_sessions")
        .update({
          status: "closed",
          counted_nio: v.counted_nio,
          counted_usd: v.counted_usd,
          notes: v.notes ?? null,
          closed_by: userData.user!.id,
          closed_at: new Date().toISOString(),
        })
        .eq("id", v.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-session-open"] });
      qc.invalidateQueries({ queryKey: ["cash-movements"] });
    },
  });
}

export function useCashMovements(sessionId?: string) {
  return useQuery({
    queryKey: ["cash-movements", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<CashMovement[]> => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddMovement() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      session_id: string;
      type: "income" | "expense";
      amount: number;
      currency: "NIO" | "USD";
      reason: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("cash_movements").insert({
        tenant_id: tenant!.id,
        session_id: v.session_id,
        type: v.type,
        amount: v.amount,
        currency: v.currency,
        reason: v.reason,
        created_by: userData.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash-movements"] }),
  });
}

// ---------------- Sales ----------------
export interface CartLine {
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price_usd: number;
  is_tax_exempt: boolean;
}

export interface PaymentLine {
  method: PaymentMethod;
  amount: number;
  currency: "NIO" | "USD";
}

export function useCreateSale() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      sessionId: string | null;
      lines: CartLine[];
      payments: PaymentLine[];
      exchangeRate: number;
      ivaRate: number;
      ivaEnabled: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      // next sale number
      const { data: last } = await supabase
        .from("sales")
        .select("sale_number")
        .eq("tenant_id", tenant!.id)
        .order("sale_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const saleNumber = (last?.sale_number ?? 0) + 1;

      let subtotal = 0;
      let tax = 0;
      const itemsPayload = v.lines.map((l) => {
        const lineSubtotal = l.unit_price_usd * l.quantity;
        const lineTax =
          v.ivaEnabled && !l.is_tax_exempt ? lineSubtotal * v.ivaRate : 0;
        subtotal += lineSubtotal;
        tax += lineTax;
        return {
          tenant_id: tenant!.id,
          product_id: l.product_id,
          name: l.name,
          quantity: l.quantity,
          unit_price_usd: l.unit_price_usd,
          tax_usd: Number(lineTax.toFixed(2)),
          line_total_usd: Number((lineSubtotal + lineTax).toFixed(2)),
        };
      });
      const total = subtotal + tax;

      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          tenant_id: tenant!.id,
          session_id: v.sessionId,
          sale_number: saleNumber,
          subtotal_usd: Number(subtotal.toFixed(2)),
          tax_usd: Number(tax.toFixed(2)),
          total_usd: Number(total.toFixed(2)),
          exchange_rate: v.exchangeRate,
          sold_by: uid,
        })
        .select()
        .single();
      if (saleErr) throw saleErr;

      const { error: itemsErr } = await supabase.from("sale_items").insert(
        itemsPayload.map((i) => ({ ...i, sale_id: sale.id })),
      );
      if (itemsErr) throw itemsErr;

      const { error: payErr } = await supabase.from("sale_payments").insert(
        v.payments.map((p) => ({
          sale_id: sale.id,
          tenant_id: tenant!.id,
          method: p.method,
          amount: p.amount,
          currency: p.currency,
        })),
      );
      if (payErr) throw payErr;

      // decrement stock
      for (const l of v.lines) {
        if (l.product_id) {
          const { data: prod } = await supabase
            .from("products")
            .select("stock")
            .eq("id", l.product_id)
            .single();
          if (prod) {
            await supabase
              .from("products")
              .update({ stock: Number(prod.stock) - l.quantity })
              .eq("id", l.product_id);
          }
        }
      }

      return { sale, saleNumber, total };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}
