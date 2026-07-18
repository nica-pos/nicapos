import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertSuperadmin,
  deleteAuthUserIfOrphan,
  removeTenantStorage,
} from "@/lib/tenant-admin.server";

const addMemberInput = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "cashier", "accountant"]),
});

const tenantStatusInput = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["trial", "active", "suspended", "cancelled"]),
});

const deleteTenantInput = z.object({
  tenantId: z.string().uuid(),
  deleteOrphanUsers: z.boolean().default(true),
});

const createClientInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantName: z.string().min(2).max(80),
  planId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(3650),
});

const cleanupOrphanUsersInput = z.object({
  confirm: z.literal(true),
});

// NOTE: adminCreateClient requiere Supabase Auth Admin API (service role).
// Está deshabilitado temporalmente hasta configurar SUPABASE_SERVICE_ROLE_KEY
// en el entorno de despliegue. Los clientes se crean manualmente por ahora
// (el usuario se registra normalmente y luego el superadmin le asigna plan/estado).
export const adminCreateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createClientInput.parse(input))
  .handler(async () => {
    throw new Error(
      "La creación automática de clientes está temporalmente deshabilitada. " +
      "Pide al cliente que se registre en /auth y luego asígnale plan y estado desde esta consola.",
    );
  });

export const addTenantMemberByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addMemberInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be owner or admin of the tenant (RLS-backed check).
    const { data: caller } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
      throw new Error("No tienes permiso para agregar miembros a esta tienda.");
    }

    // Look up the target user by email via RLS (profiles has superadmin/self read policy).
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();

    if (!profile) {
      // No user with that email yet — create a pending invitation so it auto-joins on signup.
      const { error: invErr } = await supabase.from("tenant_invitations").insert({
        tenant_id: data.tenantId,
        email: data.email.toLowerCase(),
        role: data.role,
        invited_by: userId,
      });
      if (invErr) {
        if (invErr.code === "23505") throw new Error("Ya existe una invitación pendiente para ese correo.");
        throw new Error(invErr.message);
      }
      return { ok: true, invited: true };
    }

    const { error } = await supabase.from("tenant_members").insert({
      tenant_id: data.tenantId,
      user_id: profile.id,
      role: data.role,
    });

    if (error) {
      if (error.code === "23505") throw new Error("Ese usuario ya es miembro de la tienda.");
      throw new Error(error.message);
    }

    return { ok: true, invited: false };
  });

export const getAdminTenantSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context, "Solo el superadmin puede ver esta consola.");

    // RLS: superadmin puede leer todos los tenants.
    const { data, error } = await context.supabase
      .from("tenants")
      .select("id, name, status, created_at, owner_id, plan:plans(name, price_usd)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((data ?? []).map((t) => t.owner_id).filter(Boolean))) as string[];
    let superOwners = new Set<string>();
    const ownerInfo = new Map<string, { email: string | null; full_name: string | null }>();
    if (ownerIds.length > 0) {
      const [rolesRes, profRes] = await Promise.all([
        context.supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "superadmin")
          .in("user_id", ownerIds),
        context.supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", ownerIds),
      ]);
      if (rolesRes.error) throw new Error(rolesRes.error.message);
      if (profRes.error) throw new Error(profRes.error.message);
      superOwners = new Set((rolesRes.data ?? []).map((r: any) => r.user_id));
      for (const p of profRes.data ?? []) {
        ownerInfo.set((p as any).id, {
          email: (p as any).email ?? null,
          full_name: (p as any).full_name ?? null,
        });
      }
    }

    return (data ?? [])
      .filter((t) => !t.owner_id || !superOwners.has(t.owner_id))
      .map((t) => {
        const info = t.owner_id ? ownerInfo.get(t.owner_id) : undefined;
        return {
          id: t.id,
          name: t.name,
          status: t.status,
          created_at: t.created_at,
          plan: t.plan,
          owner_email: info?.email ?? null,
          owner_name: info?.full_name ?? null,
        };
      });
  });

export const setAdminTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "Solo el superadmin puede cambiar estados de tiendas.");

    // RLS: "Owner, tenant admin or superadmin can update tenant" permite este UPDATE.
    const { error } = await context.supabase
      .from("tenants")
      .update({ status: data.status })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteTenantInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "Solo el superadmin puede eliminar tiendas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, owner_id")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (tenantError) throw new Error(tenantError.message);
    if (!tenant) throw new Error("La tienda ya no existe.");

    const { data: members, error: membersError } = await supabaseAdmin
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", data.tenantId);
    if (membersError) throw new Error(membersError.message);

    const candidateUserIds = Array.from(
      new Set([tenant.owner_id, ...(members ?? []).map((m: any) => m.user_id)].filter(Boolean)),
    ) as string[];

    const storage = await removeTenantStorage(supabaseAdmin, data.tenantId);

    // Borrado real de la tienda con cliente administrativo: los datos hijos caen en CASCADE.
    const { error: delErr } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", data.tenantId);
    if (delErr) throw new Error(delErr.message);

    const deletedUserIds: string[] = [];
    const skippedUserIds: string[] = [];
    const failedUserDeletes: { userId: string; reason: string }[] = [];

    if (data.deleteOrphanUsers) {
      for (const userId of candidateUserIds) {
        const result = await deleteAuthUserIfOrphan(supabaseAdmin, userId, context.userId);
        if (result.status === "deleted") deletedUserIds.push(userId);
        else if (result.status === "failed") failedUserDeletes.push({ userId, reason: result.reason });
        else skippedUserIds.push(userId);
      }
    }

    return { ok: true, deletedUserIds, skippedUserIds, failedUserDeletes, storage };
  });

export const cleanupOrphanAuthUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cleanupOrphanUsersInput.parse(input))
  .handler(async ({ context }) => {
    await assertSuperadmin(context, "Solo el superadmin puede limpiar usuarios sin tienda.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const deletedUserIds: string[] = [];
    const skippedUserIds: string[] = [];
    const failedUserDeletes: { userId: string; reason: string }[] = [];

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];

      for (const user of users) {
        const userId = user.id;
        const result = await deleteAuthUserIfOrphan(supabaseAdmin, userId, context.userId);
        if (result.status === "deleted") deletedUserIds.push(userId);
        else if (result.status === "failed") failedUserDeletes.push({ userId, reason: result.reason });
        else skippedUserIds.push(userId);
      }

      if (users.length < 1000) break;
    }

    return { ok: true, deletedUserIds, skippedUserIds, failedUserDeletes };
  });
