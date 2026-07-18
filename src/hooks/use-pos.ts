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
      // Sale number is assigned inside a retry loop below to avoid
      // duplicate-key collisions when several cashiers sell at once
      // (there is a UNIQUE index on tenant_id + sale_number).


      // fetch current costs for COGS capture
      const productIds = v.lines
        .map((l) => l.product_id)
        .filter((id): id is string => !!id);
      const costMap = new Map<string, number>();
      if (productIds.length) {
        const { data: costRows } = await supabase
          .from("products")
          .select("id, cost_usd")
          .in("id", productIds);
        for (const r of costRows ?? []) costMap.set(r.id, Number(r.cost_usd));
      }

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
          unit_cost_usd: l.product_id ? (costMap.get(l.product_id) ?? 0) : 0,
          tax_usd: Number(lineTax.toFixed(2)),
          line_total_usd: Number((lineSubtotal + lineTax).toFixed(2)),
        };
      });
      const total = subtotal + tax;


      // Assign the sale number and insert, retrying on unique-key collision.
      let sale: Sale | null = null;
      let saleNumber = 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: last } = await supabase
          .from("sales")
          .select("sale_number")
          .eq("tenant_id", tenant!.id)
          .order("sale_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        saleNumber = (last?.sale_number ?? 0) + 1;

        const { data, error: saleErr } = await supabase
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

        if (!saleErr && data) {
          sale = data;
          break;
        }
        // 23505 = unique_violation: another cashier took this number, retry.
        if (saleErr && saleErr.code !== "23505") throw saleErr;
      }
      if (!sale) {
        throw new Error(
          "No se pudo asignar el número de venta, intenta de nuevo.",
        );
      }


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

      // record inventory movements (Kardex). Combos auto-decrement components.
      for (const l of v.lines) {
        if (!l.product_id) continue;

        const { data: components } = await supabase
          .from("combo_components")
          .select("component_id, quantity")
          .eq("combo_id", l.product_id);

        if (components && components.length > 0) {
          // Combo: decrement each component, not the combo itself
          for (const c of components) {
            await supabase.rpc("record_inventory_movement", {
              _product_id: c.component_id,
              _movement_type: "sale",
              _quantity: Number(c.quantity) * l.quantity,
              _unit_cost: 0,
              _reference: `Venta #${saleNumber} (combo)`,
            });
          }
        } else {
          await supabase.rpc("record_inventory_movement", {
            _product_id: l.product_id,
            _movement_type: "sale",
            _quantity: l.quantity,
            _unit_cost: 0,
            _reference: `Venta #${saleNumber}`,
          });
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

export function useVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { saleId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("void_sale", {
        _sale_id: v.saleId,
        _reason: v.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["receivables"] });
    },
  });
}
