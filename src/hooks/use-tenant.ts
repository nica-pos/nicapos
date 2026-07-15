import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type TenantMember = Database["public"]["Tables"]["tenant_members"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type TenantRole = Database["public"]["Enums"]["tenant_role"];

const ACTIVE_TENANT_KEY = "nicapos.active_tenant";

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_TENANT_KEY);
}

export function setActiveTenantId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_TENANT_KEY, id);
}

export type MembershipWithTenant = TenantMember & { tenant: Tenant };

export function useMyMemberships() {
  return useQuery({
    queryKey: ["my-memberships"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MembershipWithTenant[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      // IMPORTANT: filter explicitly by the current user. The RLS SELECT
      // policy allows superadmins to read ALL memberships, which would
      // otherwise leak other tenants' data into the personal dashboard.
      const { data, error } = await supabase
        .from("tenant_members")
        .select("*, tenant:tenants(*)")
        .eq("user_id", uid)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const real = (data ?? []) as MembershipWithTenant[];
      return real;
    },
  });
}

export function useActiveTenant() {
  const memberships = useMyMemberships();
  const list = memberships.data ?? [];
  const activeId = getActiveTenantId();

  const savedMatch = list.find((m) => m.tenant_id === activeId);
  const active = savedMatch ?? list[0] ?? null;

  return {
    ...memberships,
    tenant: active?.tenant ?? null,
    role: (active?.role ?? null) as TenantRole | null,
    memberships: list,
    hasTenant: list.length > 0,
  };
}

export function useIsSuperadmin() {
  return useQuery({
    queryKey: ["is-superadmin"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "superadmin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });
}

export function usePlans(includeInactive = false) {
  return useQuery({
    queryKey: ["plans", includeInactive],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Plan[]> => {
      let query = supabase.from("plans").select("*").order("sort_order");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
