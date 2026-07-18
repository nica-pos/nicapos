import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperadmin } from "@/lib/tenant-admin.server";

const approveInput = z.object({
  requestId: z.string().uuid(),
  planId: z.string().uuid(),
  trialDays: z.number().int().min(1).max(90).default(7),
  password: z.string().min(6).max(72),
  tenantName: z.string().min(2).max(80).optional(),
});

const rejectInput = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(2).max(500),
});

export const listTrialRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context);
    const { data, error } = await context.supabase
      .from("trial_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const approveTrialRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => approveInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);

    const { data: reqRow, error: reqErr } = await context.supabase
      .from("trial_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!reqRow) throw new Error("Solicitud no encontrada");
    if (reqRow.status !== "pending") throw new Error("La solicitud ya fue procesada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create the auth user by email
    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", reqRow.email)
      .maybeSingle();

    if (existing?.id) {
      userId = existing.id;
      // Reset password so the client can log in with the credentials we return
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
      });
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: reqRow.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: reqRow.full_name },
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user!.id;
    }

    const tenantName = data.tenantName?.trim() || reqRow.business_name;
    const { data: tenantId, error: rpcErr } = await context.supabase.rpc("approve_trial_request", {
      _request_id: data.requestId,
      _owner_user_id: userId,
      _tenant_name: tenantName,
      _plan_id: data.planId,
      _trial_days: data.trialDays,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    return {
      tenantId,
      email: reqRow.email,
      password: data.password,
    };
  });

export const rejectTrialRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rejectInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    const { error } = await context.supabase
      .from("trial_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.requestId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
