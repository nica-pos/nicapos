import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function assertSuperadmin(context: any, message = "Solo el superadmin puede realizar esta acción.") {
  const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "superadmin",
  });
  if (roleError) throw new Error(roleError.message);
  if (!isSuper) throw new Error(message);
}

async function isUserSuperadmin(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "superadmin",
  });
  if (error) throw new Error(error.message);
  return !!data;
}

async function userStillHasTenantAccess(supabaseAdmin: any, userId: string) {
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);
  if (ownedError) throw new Error(ownedError.message);

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("tenant_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (membershipsError) throw new Error(membershipsError.message);

  return (owned?.length ?? 0) > 0 || (memberships?.length ?? 0) > 0;
}

async function deleteAuthUserIfOrphan(supabaseAdmin: any, userId: string, currentUserId: string) {
  if (userId === currentUserId) return { status: "skipped" as const, reason: "current_user" };
  if (await isUserSuperadmin(supabaseAdmin, userId)) return { status: "skipped" as const, reason: "superadmin" };
  if (await userStillHasTenantAccess(supabaseAdmin, userId)) return { status: "skipped" as const, reason: "has_tenant" };

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { status: "failed" as const, reason: error.message };
  return { status: "deleted" as const };
}

async function removeTenantStorage(supabaseAdmin: any, tenantId: string) {
  const buckets = ["branding", "payment-receipts", "product-images"];
  const removed: Record<string, number> = {};
  const errors: string[] = [];

  async function collect(bucket: string, prefix: string): Promise<string[]> {
    const paths: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
      });
      if (error) {
        errors.push(`${bucket}: ${error.message}`);
        return paths;
      }

      const items = data ?? [];
      for (const item of items) {
        const objectPath = `${prefix}/${item.name}`;
        if (item.id || item.metadata) {
          paths.push(objectPath);
        } else {
          paths.push(...(await collect(bucket, objectPath)));
        }
      }

      if (items.length < 1000) break;
    }
    return paths;
  }

  for (const bucket of buckets) {
    const paths = await collect(bucket, tenantId);
    removed[bucket] = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      if (chunk.length === 0) continue;
      const { error } = await supabaseAdmin.storage.from(bucket).remove(chunk);
      if (error) errors.push(`${bucket}: ${error.message}`);
      else removed[bucket] += chunk.length;
    }
  }

  return { removed, errors };
}

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
      .select("id, status, created_at, owner_id, plan:plans(name, price_usd)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((data ?? []).map((t) => t.owner_id).filter(Boolean))) as string[];
    let superOwners = new Set<string>();
    if (ownerIds.length > 0) {
      const { data: roles, error: rolesError } = await context.supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "superadmin")
        .in("user_id", ownerIds);
      if (rolesError) throw new Error(rolesError.message);
      superOwners = new Set((roles ?? []).map((r) => r.user_id));
    }

    return (data ?? [])
      .filter((t) => !t.owner_id || !superOwners.has(t.owner_id))
      .map(({ owner_id: _o, ...rest }) => rest);
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
