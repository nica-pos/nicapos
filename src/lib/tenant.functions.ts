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
    const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isSuper) throw new Error("Solo el superadmin puede ver esta consola.");

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
    const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isSuper) throw new Error("Solo el superadmin puede cambiar estados de tiendas.");

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
    const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isSuper) throw new Error("Solo el superadmin puede eliminar tiendas.");

    // RLS: "Owner or superadmin can delete tenant" permite este DELETE.
    // Los datos hijos caen en CASCADE.
    const { error: delErr } = await context.supabase
      .from("tenants")
      .delete()
      .eq("id", data.tenantId);
    if (delErr) throw new Error(delErr.message);

    // Nota: el borrado de usuarios huérfanos requiere Supabase Auth Admin API
    // (service role). Se omite mientras SERVICE_ROLE_KEY no esté configurado.
    // Los usuarios sin tienda quedan en el sistema de auth pero sin acceso.
    return { ok: true, deletedUserIds: [] as string[] };
  });
