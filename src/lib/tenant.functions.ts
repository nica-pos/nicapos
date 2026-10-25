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
  password: z.string().min(6).max(72).optional(),
  fullName: z.string().max(80).optional(),
});

const forceDeleteAuthUserInput = z.object({
  userId: z.string().uuid(),
});

const removeMemberInput = z.object({
  tenantId: z.string().uuid(),
  memberId: z.string().uuid(),
  deleteAuthIfOrphan: z.boolean().default(true),
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

    const emailLower = data.email.toLowerCase();

    // Look up the target user by email via RLS (profiles has superadmin/self read policy).
    let { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();

    // Si no existe y el dueño proveyó contraseña, creamos la cuenta directamente.
    if (!profile && data.password) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: data.password,
        email_confirm: true,
        user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
      });
      if (createErr) {
        const msg = createErr.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exist")) {
          throw new Error(
            "Ya existe una cuenta con ese correo. Pídele que inicie sesión y quítale la contraseña de este formulario.",
          );
        }
        throw new Error(createErr.message);
      }
      profile = { id: created.user!.id };
    }

    if (!profile) {
      // Sin contraseña y usuario no existe → invitación pendiente (auto-acepta al registrarse).
      const { error: invErr } = await supabase.from("tenant_invitations").insert({
        tenant_id: data.tenantId,
        email: emailLower,
        role: data.role,
        invited_by: userId,
      });
      if (invErr) {
        if (invErr.code === "23505")
          throw new Error("Ya existe una invitación pendiente para ese correo.");
        throw new Error(invErr.message);
      }
      return { ok: true, invited: true, created: false };
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

    return { ok: true, invited: false, created: !!data.password };
  });

export const adminForceDeleteAuthUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => forceDeleteAuthUserInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context, "Solo el superadmin puede eliminar cuentas de Auth.");
    if (data.userId === context.userId) {
      throw new Error("No puedes eliminar tu propia cuenta desde aquí.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bloqueo: nunca borrar a otro superadmin desde aquí.
    const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
      _user_id: data.userId,
      _role: "superadmin",
    });
    if (isSuper) throw new Error("No se puede eliminar la cuenta de otro superadmin.");

    // Borrar membresías, tiendas propias e invitaciones, luego la cuenta Auth.
    await supabaseAdmin.from("tenant_members").delete().eq("user_id", data.userId);
    const { data: ownedTenants } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("owner_id", data.userId);
    for (const t of ownedTenants ?? []) {
      await removeTenantStorage(supabaseAdmin, t.id);
      await supabaseAdmin.from("tenants").delete().eq("id", t.id);
    }
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (authErr) throw new Error(`No se pudo eliminar de Auth: ${authErr.message}`);
    return { ok: true };
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

    const ownerIds = Array.from(
      new Set((data ?? []).map((t) => t.owner_id).filter(Boolean)),
    ) as string[];
    let superOwners = new Set<string>();
    const ownerInfo = new Map<string, { email: string | null; full_name: string | null }>();
    if (ownerIds.length > 0) {
      const [rolesRes, profRes] = await Promise.all([
        context.supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "superadmin")
          .in("user_id", ownerIds),
        context.supabase.from("profiles").select("id, email, full_name").in("id", ownerIds),
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
          owner_id: t.owner_id ?? null,
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
    const { error: delErr } = await (supabaseAdmin as any).rpc("admin_purge_tenant", {
      _tenant_id: data.tenantId,
    });
    if (delErr) throw new Error(delErr.message);

    const deletedUserIds: string[] = [];
    const skippedUserIds: string[] = [];
    const failedUserDeletes: { userId: string; reason: string }[] = [];

    if (data.deleteOrphanUsers) {
      for (const userId of candidateUserIds) {
        const result = await deleteAuthUserIfOrphan(supabaseAdmin, userId, context.userId);
        if (result.status === "deleted") deletedUserIds.push(userId);
        else if (result.status === "failed")
          failedUserDeletes.push({ userId, reason: result.reason });
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
        else if (result.status === "failed")
          failedUserDeletes.push({ userId, reason: result.reason });
        else skippedUserIds.push(userId);
      }

      if (users.length < 1000) break;
    }

    return { ok: true, deletedUserIds, skippedUserIds, failedUserDeletes };
  });

export const removeTenantMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => removeMemberInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be owner/admin of the tenant, OR superadmin.
    const { data: caller } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });

    const canManage = isSuper || (caller && (caller.role === "owner" || caller.role === "admin"));
    if (!canManage) {
      throw new Error("No tienes permiso para eliminar miembros de esta tienda.");
    }

    // Fetch the target member to know which user we're removing.
    const { data: member, error: mErr } = await supabase
      .from("tenant_members")
      .select("id, user_id, role, tenant_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member || member.tenant_id !== data.tenantId) {
      throw new Error("Miembro no encontrado.");
    }
    if (member.role === "owner") {
      throw new Error("No se puede eliminar al dueño de la tienda.");
    }
    if (member.user_id === userId) {
      throw new Error("No puedes eliminarte a ti mismo desde aquí.");
    }

    // Remove membership via RLS.
    const { error: delErr } = await supabase
      .from("tenant_members")
      .delete()
      .eq("id", data.memberId);
    if (delErr) throw new Error(delErr.message);

    let authDeleted = false;
    let authSkippedReason: string | null = null;

    if (data.deleteAuthIfOrphan) {
      // Use admin client to fully wipe the auth user if they have no other access.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const result = await deleteAuthUserIfOrphan(supabaseAdmin, member.user_id, userId);
      if (result.status === "deleted") {
        // Also drop the profile row so no residual email lingers.
        await supabaseAdmin.from("profiles").delete().eq("id", member.user_id);
        authDeleted = true;
      } else {
        authSkippedReason = result.reason;
      }
    }

    return { ok: true, authDeleted, authSkippedReason };
  });
