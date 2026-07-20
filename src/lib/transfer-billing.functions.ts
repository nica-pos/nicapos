import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Bank accounts (superadmin CRUD) ----------

const bankInput = z.object({
  id: z.string().uuid().optional(),
  bank_name: z.string().min(1).max(120),
  account_holder: z.string().min(1).max(160),
  account_number: z.string().min(1).max(60),
  account_type: z.enum(["savings", "checking"]),
  currency: z.enum(["NIO", "USD"]),
  instructions: z.string().max(600).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

async function assertSuperadmin(context: any) {
  const { data: isSuper, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "superadmin",
  });
  if (error) throw new Error(error.message);
  if (!isSuper) throw new Error("Solo el superadmin puede realizar esta acción.");
}

export const saveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bankInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("bank_accounts").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _omit, ...rest } = data;
      const { error } = await context.supabase.from("bank_accounts").insert(rest);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    const { error } = await context.supabase.from("bank_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Payment submissions ----------

const submitInput = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  bankAccountId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(["NIO", "USD"]),
  reference: z.string().max(120).nullable().optional(),
  receiptPath: z.string().min(1),
});

export const submitPaymentProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => submitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: subId, error } = await context.supabase.rpc(
      "submit_payment_and_mark_pending",
      {
        _tenant_id: data.tenantId,
        _plan_id: data.planId,
        _bank_account_id: data.bankAccountId,
        _amount: data.amount,
        _currency: data.currency,
        _reference: data.reference ?? "",
        _receipt_path: data.receiptPath,
      },
    );
    if (error) throw new Error(error.message);
    return { ok: true, submissionId: subId };
  });

export const listPendingSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context);
    const { data, error } = await context.supabase
      .from("payment_submissions")
      .select(
        "id, tenant_id, plan_id, amount, currency, reference, receipt_url, status, created_at, tenant:tenants(name, ruc), plan:plans(name, price_usd), bank:bank_accounts(bank_name, account_number, currency)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    const { data: signed, error } = await context.supabase.storage
      .from("payment-receipts")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        submissionId: z.string().uuid(),
        approve: z.boolean(),
        months: z.number().int().min(1).max(36).optional(),
        rejectionReason: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);

    const { data: sub, error: sErr } = await context.supabase
      .from("payment_submissions")
      .select("id, tenant_id, plan_id, status")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sub) throw new Error("Comprobante no encontrado.");
    if (sub.status !== "pending") throw new Error("Este comprobante ya fue revisado.");

    if (data.approve) {
      const months = data.months ?? 1;
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + months);

      const { error: uErr } = await context.supabase
        .from("payment_submissions")
        .update({
          status: "approved",
          months_covered: months,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      if (uErr) throw new Error(uErr.message);

      const { error: tErr } = await context.supabase
        .from("tenants")
        .update({ status: "active" as any, plan_id: sub.plan_id })
        .eq("id", sub.tenant_id);
      if (tErr) throw new Error(tErr.message);

      const { data: existing } = await context.supabase
        .from("tenant_subscriptions")
        .select("id")
        .eq("tenant_id", sub.tenant_id)
        .maybeSingle();

      if (existing) {
        const { error } = await context.supabase
          .from("tenant_subscriptions")
          .update({
            plan_id: sub.plan_id,
            provider: "bank_transfer",
            status: "active",
            current_period_end: periodEnd.toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase.from("tenant_subscriptions").insert({
          tenant_id: sub.tenant_id,
          plan_id: sub.plan_id,
          provider: "bank_transfer",
          status: "active",
          current_period_end: periodEnd.toISOString(),
        });
        if (error) throw new Error(error.message);
      }
    } else {
      const reason = data.rejectionReason ?? "Comprobante no válido.";
      const { error: uErr } = await context.supabase
        .from("payment_submissions")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      if (uErr) throw new Error(uErr.message);

      // Volver a pending_payment (no cancelar) para que el usuario pueda
      // reenviar un nuevo comprobante. Guardamos el motivo visible.
      const { error: tErr } = await context.supabase
        .from("tenants")
        .update({
          status: "pending_payment" as any,
          cancellation_reason: reason,
        })
        .eq("id", sub.tenant_id);
      if (tErr) throw new Error(tErr.message);
    }

    return { ok: true };
  });
