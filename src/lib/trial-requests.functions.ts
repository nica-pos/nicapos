import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperadmin } from "@/lib/tenant-admin.server";

const approveInput = z.object({
  requestId: z.string().uuid(),
  planId: z.string().uuid(),
  trialDays: z.number().int().min(1).max(90).default(7),
  password: z.string().min(6).max(72).optional(),
  tenantName: z.string().min(2).max(80).optional(),
});

const rejectInput = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(2).max(500),
});

const requestTrialInput = z.object({
  tenantName: z.string().min(2).max(80),
  phone: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  locationAccuracy: z.number().nullable().optional(),
  notes: z.string().max(500).optional(),
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

/**
 * Called from /onboarding when a signed-in user chooses the "7-day trial" option.
 * Creates the tenant in `pending_trial_approval` and inserts the trial_request.
 * Captures the request IP + user agent from the incoming request headers.
 */
export const requestTrialForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => requestTrialInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: tenantId, error } = await context.supabase.rpc(
      "request_trial_for_current_user",
      {
        _tenant_name: data.tenantName,
        _phone: data.phone ?? "",
        _city: data.city ?? "",
        _country: data.country ?? "",
        _ip_address: "",
        _user_agent: "",
        _latitude: data.latitude ?? (null as unknown as number),
        _longitude: data.longitude ?? (null as unknown as number),
        _location_accuracy: data.locationAccuracy ?? (null as unknown as number),
        _notes: data.notes ?? "",
      },
    );
    if (error) throw new Error(error.message);


    // Send confirmation email (fire-and-forget)
    try {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.email) {
        const { sendEmail, emailTemplates } = await import("@/lib/email.server");
        const t = emailTemplates.trialReceived(profile.full_name ?? "");
        await sendEmail({ to: profile.email, subject: t.subject, html: t.html });
      }
    } catch (e) {
      console.warn("[trial] confirmation email failed", e);
    }

    return { tenantId };
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

    let userId: string | null = reqRow.owner_user_id ?? null;
    let generatedPassword: string | null = null;

    // If the request came from an anonymous form (no owner_user_id), create/update the auth user.
    if (!userId) {
      if (!data.password) throw new Error("Se requiere contraseña para crear el usuario");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", reqRow.email)
        .maybeSingle();
      if (existing?.id) {
        userId = existing.id;
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
      generatedPassword = data.password;
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

    // Notify user
    try {
      const { sendEmail, emailTemplates } = await import("@/lib/email.server");
      const t = emailTemplates.trialApproved(reqRow.full_name ?? "", data.trialDays);
      await sendEmail({ to: reqRow.email, subject: t.subject, html: t.html });
    } catch (e) {
      console.warn("[trial] approval email failed", e);
    }

    return {
      tenantId,
      email: reqRow.email,
      password: generatedPassword,
    };
  });

export const rejectTrialRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rejectInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);

    const { data: reqRow } = await context.supabase
      .from("trial_requests")
      .select("email, full_name")
      .eq("id", data.requestId)
      .maybeSingle();

    const { error } = await context.supabase.rpc("reject_trial_request", {
      _request_id: data.requestId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);

    if (reqRow?.email) {
      try {
        const { sendEmail, emailTemplates } = await import("@/lib/email.server");
        const t = emailTemplates.trialRejected(reqRow.full_name ?? "", data.reason);
        await sendEmail({ to: reqRow.email, subject: t.subject, html: t.html });
      } catch (e) {
        console.warn("[trial] rejection email failed", e);
      }
    }
    return { ok: true };
  });
