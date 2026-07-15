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

const createClientInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantName: z.string().min(2).max(80),
  planId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(3650),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "tienda";
}

export const adminCreateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createClientInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isSuper, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isSuper) throw new Error("Solo el superadmin puede crear clientes.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Crear usuario en Auth (email confirmado)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "No se pudo crear el usuario.");
    }
    const newUserId = created.user.id;

    // 2) Crear tenant activo con plan asignado
    const slug = `${slugify(data.tenantName)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.tenantName,
        slug,
        owner_id: newUserId,
        plan_id: data.planId,
        status: "active",
        trial_ends_at: null,
      })
      .select("id")
      .single();
    if (tErr || !tenant) {
      // Rollback: eliminar usuario si falló el tenant
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(tErr?.message ?? "No se pudo crear la tienda.");
    }

    // 3) Registrar suscripción manual con duración
    const endsAt = new Date(Date.now() + data.durationDays * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from("tenant_subscriptions").insert({
      tenant_id: tenant.id,
      plan_id: data.planId,
      provider: "manual",
      status: "active",
      current_period_end: endsAt,
      raw: { created_by: context.userId, duration_days: data.durationDays },
    });

    return { ok: true, tenantId: tenant.id, userId: newUserId };
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

    // Look up the target user by email using privileged access.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
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

    // Insert membership as the authenticated caller so RLS applies.
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
    const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isSuper) throw new Error("Solo el superadmin puede ver esta consola.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id, status, created_at, owner_id, plan:plans(name, price_usd)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((data ?? []).map((t) => t.owner_id).filter(Boolean))) as string[];
    let superOwners = new Set<string>();
    if (ownerIds.length > 0) {
      const { data: roles, error: rolesError } = await supabaseAdmin
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
    const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isSuper) throw new Error("Solo el superadmin puede cambiar estados de tiendas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ status: data.status })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
