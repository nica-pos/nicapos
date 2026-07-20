import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type ProductModel = Database["public"]["Tables"]["product_models"]["Row"];
export type Promotion = Database["public"]["Tables"]["promotions"]["Row"];
export type InventoryMovement =
  Database["public"]["Tables"]["inventory_movements"]["Row"];
export type ComboComponent =
  Database["public"]["Tables"]["combo_components"]["Row"];
export type StockAudit = Database["public"]["Tables"]["stock_audits"]["Row"];
export type StockAuditItem =
  Database["public"]["Tables"]["stock_audit_items"]["Row"];

// ---------- Simple lookups (categories/brands/models) ----------
function useLookup<T>(table: "categories" | "brands" | "product_models") {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: [table, tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export const useCategories = () => useLookup<Category>("categories");
export const useBrands = () => useLookup<Brand>("brands");
export const useModels = () => useLookup<ProductModel>("product_models");

export function useCreateLookup(
  table: "categories" | "brands" | "product_models",
) {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; brand_id?: string | null }) => {
      if (table === "product_models") {
        const { data, error } = await supabase
          .from("product_models")
          .insert({ tenant_id: tenant!.id, name: v.name, brand_id: v.brand_id ?? null })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from(table)
        .insert({ tenant_id: tenant!.id, name: v.name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}


export function useDeleteLookup(
  table: "categories" | "brands" | "product_models",
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

// ---------- Kardex ----------
export function useKardex(productId?: string) {
  return useQuery({
    queryKey: ["kardex", productId],
    enabled: !!productId,
    queryFn: async (): Promise<InventoryMovement[]> => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      product_id: string;
      movement_type:
        | "purchase"
        | "sale"
        | "adjustment_in"
        | "adjustment_out"
        | "audit";
      quantity: number;
      unit_cost?: number;
      reference?: string;
    }) => {
      const { data, error } = await supabase.rpc("record_inventory_movement", {
        _product_id: v.product_id,
        _movement_type: v.movement_type,
        _quantity: v.quantity,
        _unit_cost: v.unit_cost ?? 0,
        _reference: v.reference ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["kardex"] });
    },
  });
}

// ---------- Combos ----------
export function useComboComponents(comboId?: string) {
  return useQuery({
    queryKey: ["combo-components", comboId],
    enabled: !!comboId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combo_components")
        .select("*, component:products!combo_components_component_id_fkey(id,name,price_usd,stock)")
        .eq("combo_id", comboId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddComboComponent() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      combo_id: string;
      component_id: string;
      quantity: number;
    }) => {
      const { error } = await supabase.from("combo_components").insert({
        tenant_id: tenant!.id,
        combo_id: v.combo_id,
        component_id: v.component_id,
        quantity: v.quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combo-components"] }),
  });
}

export function useRemoveComboComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("combo_components")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combo-components"] }),
  });
}

// ---------- Physical audits ----------
export function useAudits() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["stock-audits", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<StockAudit[]> => {
      const { data, error } = await supabase
        .from("stock_audits")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAuditItems(auditId?: string) {
  return useQuery({
    queryKey: ["audit-items", auditId],
    enabled: !!auditId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_audit_items")
        .select("*, product:products(id,name,barcode)")
        .eq("audit_id", auditId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAudit() {
  const { tenant } = useActiveTenant();
  const { branchId } = useActiveBranch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notes?: string) => {
      if (!branchId) throw new Error("Selecciona una sucursal primero");
      const { data: userData } = await supabase.auth.getUser();
      const { data: audit, error } = await supabase
        .from("stock_audits")
        .insert({
          tenant_id: tenant!.id,
          branch_id: branchId,
          created_by: userData.user!.id,
          notes: notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      // snapshot all products
      const { data: products } = await supabase
        .from("products")
        .select("id,stock")
        .eq("tenant_id", tenant!.id)
        .eq("is_active", true);
      if (products && products.length > 0) {
        await supabase.from("stock_audit_items").insert(
          products.map((p) => ({
            tenant_id: tenant!.id,
            audit_id: audit.id,
            product_id: p.id,
            system_qty: Number(p.stock),
            counted_qty: Number(p.stock),
          })),
        );
      }
      return audit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-audits"] }),
  });
}

export function useUpdateAuditCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; counted_qty: number }) => {
      const { error } = await supabase
        .from("stock_audit_items")
        .update({ counted_qty: v.counted_qty })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-items"] }),
  });
}

export function useCompleteAudit() {
  const qc = useQueryClient();
  const record = useRecordMovement();
  return useMutation_completeAudit(qc, record);
}

// helper to keep the mutation typed
function useMutation_completeAudit(
  qc: ReturnType<typeof useQueryClient>,
  record: ReturnType<typeof useRecordMovement>,
) {
  return useMutation({
    mutationFn: async (v: {
      auditId: string;
      items: { id: string; product_id: string; system_qty: number; counted_qty: number }[];
    }) => {
      // apply adjustments for each mismatch through the CPP function
      for (const it of v.items) {
        const diff = it.counted_qty - it.system_qty;
        if (diff !== 0) {
          await record.mutateAsync({
            product_id: it.product_id,
            movement_type: diff > 0 ? "adjustment_in" : "adjustment_out",
            quantity: Math.abs(diff),
            reference: `Auditoría ${v.auditId.slice(0, 8)}`,
          });
        }
      }
      const { error } = await supabase
        .from("stock_audits")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", v.auditId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-audits"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// ---------- Promotions ----------
export function usePromotions() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["promotions", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSavePromotion() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      p: Partial<Promotion> & { name: string },
    ): Promise<Promotion> => {
      const payload = { ...p, tenant_id: tenant!.id };
      if (p.id) {
        const { data, error } = await supabase
          .from("promotions")
          .update(payload)
          .eq("id", p.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("promotions")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

export function useDeletePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

// Compute the effective unit price for a product given active promotions.
export function applyPromotions(
  basePrice: number,
  product: { id: string; category_id: string | null },
  promotions: Promotion[],
): { price: number; promo: Promotion | null } {
  const today = new Date().toISOString().slice(0, 10);
  const applicable = promotions.filter((pr) => {
    if (!pr.is_active) return false;
    if (pr.starts_at && pr.starts_at > today) return false;
    if (pr.ends_at && pr.ends_at < today) return false;
    if (pr.product_id && pr.product_id !== product.id) return false;
    if (pr.category_id && pr.category_id !== product.category_id) return false;
    if (!pr.product_id && !pr.category_id) return false;
    return true;
  });
  if (applicable.length === 0) return { price: basePrice, promo: null };

  let best = basePrice;
  let bestPromo: Promotion | null = null;
  for (const pr of applicable) {
    const val = Number(pr.discount_value);
    const discounted =
      pr.discount_type === "percent"
        ? basePrice * (1 - val / 100)
        : basePrice - val;
    const finalPrice = Math.max(0, Number(discounted.toFixed(2)));
    if (finalPrice < best) {
      best = finalPrice;
      bestPromo = pr;
    }
  }
  return { price: best, promo: bestPromo };
}
