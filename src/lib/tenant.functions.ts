import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addMemberInput = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "cashier", "accountant"]),
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
      throw new Error("No existe un usuario registrado con ese correo.");
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

    return { ok: true };
  });
