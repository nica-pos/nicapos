import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useEffect, useState } from "react";

export type Branch = Database["public"]["Tables"]["branches"]["Row"];

const ACTIVE_BRANCH_KEY = "nicapos.active_branch";

function keyFor(tenantId: string) {
  return `${ACTIVE_BRANCH_KEY}.${tenantId}`;
}

export function getActiveBranchId(tenantId: string | null | undefined): string | null {
  if (!tenantId || typeof window === "undefined") return null;
  return window.localStorage.getItem(keyFor(tenantId));
}

export function setActiveBranchId(tenantId: string, branchId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(tenantId), branchId);
  window.dispatchEvent(new CustomEvent("nicapos:branch-changed"));
}

export function useBranches() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["branches", tenant?.id],
    enabled: !!tenant,
    staleTime: 60_000,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActiveBranch() {
  const { tenant } = useActiveTenant();
  const branches = useBranches();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("nicapos:branch-changed", handler);
    return () => window.removeEventListener("nicapos:branch-changed", handler);
  }, []);

  const list = branches.data ?? [];
  const activeList = list.filter((b) => b.is_active);
  const savedId = tenant ? getActiveBranchId(tenant.id) : null;
  const saved = savedId ? activeList.find((b) => b.id === savedId) : null;
  const active = saved ?? activeList.find((b) => b.is_default) ?? activeList[0] ?? null;

  // void tick for re-render dependency
  void tick;

  return {
    ...branches,
    branches: list,
    activeBranches: activeList,
    branch: active,
    branchId: active?.id ?? null,
  };
}

export function useCanCreateBranch() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["can-create-branch", tenant?.id],
    enabled: !!tenant,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("can_create_branch", { _tenant_id: tenant!.id });
      if (error) return false;
      return !!data;
    },
  });
}

export function useSaveBranch() {
  const { tenant } = useActiveTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { id?: string; name: string; address?: string | null; phone?: string | null; is_active?: boolean }): Promise<Branch> => {
      if (b.id) {
        const { data, error } = await supabase
          .from("branches")
          .update({ name: b.name, address: b.address ?? null, phone: b.phone ?? null, is_active: b.is_active ?? true })
          .eq("id", b.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("branches")
        .insert({ tenant_id: tenant!.id, name: b.name, address: b.address ?? null, phone: b.phone ?? null, is_active: true, is_default: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["can-create-branch"] });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["can-create-branch"] });
    },
  });
}
