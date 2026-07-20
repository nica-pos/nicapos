import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Receivable = Database["public"]["Tables"]["receivables"]["Row"];
export type Layaway = Database["public"]["Tables"]["layaways"]["Row"];
export type LayawayItem = Database["public"]["Tables"]["layaway_items"]["Row"];
export type PurchaseOrder =
  Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderItem =
  Database["public"]["Tables"]["purchase_order_items"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];

// ---------- Customers ----------
export function useCustomers() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["customers", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useUpsertCustomer() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Customer> & { name: string }) => {
      if (v.id) {
        const { data, error } = await supabase
          .from("customers")
          .update({
            name: v.name,
            ruc: v.ruc ?? null,
            phone: v.phone ?? null,
            email: v.email ?? null,
            address: v.address ?? null,
            credit_limit_usd: v.credit_limit_usd ?? 0,
            is_active: v.is_active ?? true,
          })
          .eq("id", v.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenant!.id,
          name: v.name,
          ruc: v.ruc ?? null,
          phone: v.phone ?? null,
          email: v.email ?? null,
          address: v.address ?? null,
          credit_limit_usd: v.credit_limit_usd ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

// ---------- Suppliers ----------
export function useSuppliers() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["suppliers", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useUpsertSupplier() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Supplier> & { name: string }) => {
      if (v.id) {
        const { data, error } = await supabase
          .from("suppliers")
          .update({
            name: v.name,
            ruc: v.ruc ?? null,
            phone: v.phone ?? null,
            email: v.email ?? null,
            contact_name: v.contact_name ?? null,
            address: v.address ?? null,
            is_active: v.is_active ?? true,
          })
          .eq("id", v.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          tenant_id: tenant!.id,
          name: v.name,
          ruc: v.ruc ?? null,
          phone: v.phone ?? null,
          email: v.email ?? null,
          contact_name: v.contact_name ?? null,
          address: v.address ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

// ---------- Receivables ----------
export type ReceivableWithCustomer = Receivable & { customer: Customer | null };

export function useReceivables() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["receivables", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*, customer:customers(*)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReceivableWithCustomer[];
    },
  });
}

export function useCreateReceivable() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      customer_id: string;
      total_usd: number;
      description?: string;
      due_date?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("receivables")
        .insert({
          tenant_id: tenant!.id,
          customer_id: v.customer_id,
          total_usd: v.total_usd,
          description: v.description ?? null,
          due_date: v.due_date || null,
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receivables"] }),
  });
}

export function useRecordReceivablePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      receivable_id: string;
      amount: number;
      method?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase.rpc("record_receivable_payment", {
        _receivable_id: v.receivable_id,
        _amount: v.amount,
        _method: v.method ?? "cash",
        _note: v.note ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receivables"] });
    },
  });
}

// ---------- Layaways ----------
export type LayawayWithCustomer = Layaway & { customer: Customer | null };

export function useLayaways() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["layaways", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layaways")
        .select("*, customer:customers(*)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LayawayWithCustomer[];
    },
  });
}

export function useLayawayItems(layawayId: string | null) {
  return useQuery({
    queryKey: ["layaway_items", layawayId],
    enabled: !!layawayId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layaway_items")
        .select("*")
        .eq("layaway_id", layawayId!);
      if (error) throw error;
      return data as LayawayItem[];
    },
  });
}

export function useCreateLayaway() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      customer_id: string;
      expires_at?: string | null;
      deposit: number;
      items: { name: string; quantity: number; unit_price_usd: number; product_id?: string | null }[];
    }) => {
      const total = v.items.reduce(
        (s, i) => s + i.quantity * i.unit_price_usd,
        0,
      );
      const { data: userData } = await supabase.auth.getUser();
      const { data: layaway, error } = await supabase
        .from("layaways")
        .insert({
          tenant_id: tenant!.id,
          customer_id: v.customer_id,
          total_usd: total,
          expires_at: v.expires_at || null,
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const items = v.items.map((i) => ({
        tenant_id: tenant!.id,
        layaway_id: layaway.id,
        product_id: i.product_id ?? null,
        name: i.name,
        quantity: i.quantity,
        unit_price_usd: i.unit_price_usd,
      }));
      const { error: itemsError } = await supabase
        .from("layaway_items")
        .insert(items);
      if (itemsError) throw itemsError;

      if (v.deposit > 0) {
        const { error: payError } = await supabase.rpc(
          "record_layaway_payment",
          { _layaway_id: layaway.id, _amount: v.deposit, _method: "cash", _note: "Abono inicial" },
        );
        if (payError) throw payError;
      }
      return layaway;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layaways"] }),
  });
}

export function useRecordLayawayPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      layaway_id: string;
      amount: number;
      method?: string;
    }) => {
      const { data, error } = await supabase.rpc("record_layaway_payment", {
        _layaway_id: v.layaway_id,
        _amount: v.amount,
        _method: v.method ?? "cash",
        _note: undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layaways"] }),
  });
}

// ---------- Purchase Orders ----------
export type PurchaseOrderWithSupplier = PurchaseOrder & {
  supplier: Supplier | null;
};

export function usePurchaseOrders() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["purchase_orders", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, supplier:suppliers(*)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PurchaseOrderWithSupplier[];
    },
  });
}

export function usePurchaseOrderItems(poId: string | null) {
  return useQuery({
    queryKey: ["purchase_order_items", poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", poId!);
      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
  });
}

export function useCreatePurchaseOrder() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      supplier_id: string;
      expected_at?: string | null;
      notes?: string;
      items: { product_id?: string | null; name: string; quantity: number; unit_cost_usd: number }[];
    }) => {
      const total = v.items.reduce(
        (s, i) => s + i.quantity * i.unit_cost_usd,
        0,
      );
      const { data: userData } = await supabase.auth.getUser();
      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({
          tenant_id: tenant!.id,
          supplier_id: v.supplier_id,
          total_usd: total,
          expected_at: v.expected_at || null,
          notes: v.notes ?? null,
          status: "ordered",
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const items = v.items.map((i) => ({
        tenant_id: tenant!.id,
        purchase_order_id: po.id,
        product_id: i.product_id ?? null,
        name: i.name,
        quantity: i.quantity,
        unit_cost_usd: i.unit_cost_usd,
      }));
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(items);
      if (itemsError) throw itemsError;
      return po;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase_orders"] }),
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (poId: string) => {
      const { data, error } = await supabase.rpc("receive_purchase_order", {
        _po_id: poId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useRecordPayablePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      po_id: string;
      amount: number;
      method?: string;
    }) => {
      const { data, error } = await supabase.rpc("record_payable_payment", {
        _po_id: v.po_id,
        _amount: v.amount,
        _method: v.method ?? "cash",
        _note: undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase_orders"] }),
  });
}

// ---------- Purchase suggestions (below min stock) ----------
export function usePurchaseSuggestions() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["purchase_suggestions", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("is_active", true);
      if (error) throw error;
      return (data as Product[]).filter(
        (p) => !p.is_combo && Number(p.min_stock) > 0 && Number(p.stock) <= Number(p.min_stock),
      );
    },
  });
}

// ---------- Products for pickers ----------
export function useProductsList() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["products", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });
}
