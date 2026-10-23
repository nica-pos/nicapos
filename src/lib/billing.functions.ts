import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const providerEnum = z.enum(["stripe", "paypal"]);

// ---------- Helpers ----------

async function assertSuperadmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "superadmin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo el superadmin puede realizar esta acción.");
}

async function getProviderConfig(supabase: any, provider: "stripe" | "paypal") {
  const { data, error } = await supabase
    .from("payment_provider_settings")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function decryptStoredSecret(row: any): Promise<string | null> {
  if (!row?.client_secret_ciphertext) return null;
  const { decryptSecret } = await import("@/lib/paymentCrypto.server");
  return decryptSecret(row.client_secret_ciphertext);
}

async function paypalBaseUrl(mode: string) {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken(clientId: string, clientSecret: string, mode: string) {
  const base = await paypalBaseUrl(mode);
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json.error_description || "Error autenticando con PayPal");
  return json.access_token as string;
}

// ---------- Read settings (superadmin) ----------

export const getPaymentProviderSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payment_provider_settings")
      .select("provider, is_enabled, mode, client_id, client_secret_ciphertext, updated_at")
      .order("provider");
    if (error) throw new Error(error.message);
    const { maskSecret } = await import("@/lib/paymentCrypto.server");
    return (data || []).map((r: any) => ({
      provider: r.provider,
      is_enabled: r.is_enabled,
      mode: r.mode,
      client_id: r.client_id,
      secret_preview: maskSecret(r.client_secret_ciphertext),
      has_secret: !!r.client_secret_ciphertext,
      updated_at: r.updated_at,
    }));
  });

// ---------- Save settings (superadmin) ----------

const saveInput = z.object({
  provider: providerEnum,
  is_enabled: z.boolean(),
  mode: z.enum(["sandbox", "live"]),
  client_id: z.string().trim().max(500).optional().nullable(),
  client_secret: z.string().trim().max(500).optional().nullable(),
});

export const savePaymentProviderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.supabase, context.userId);

    let ciphertext: string | undefined;
    if (data.client_secret && data.client_secret.length > 0) {
      const { encryptSecret } = await import("@/lib/paymentCrypto.server");
      ciphertext = encryptSecret(data.client_secret);
    }

    const { error } = await context.supabase
      .from("payment_provider_settings")
      .update({
        is_enabled: data.is_enabled,
        mode: data.mode,
        client_id: data.client_id || null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
        ...(ciphertext ? { client_secret_ciphertext: ciphertext } : {}),
      })
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Test connection (superadmin) ----------

export const testProviderConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ provider: providerEnum }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    const row = await getProviderConfig(context.supabase, data.provider);
    if (!row?.client_id) throw new Error("Falta el Client ID.");
    const secret = await decryptStoredSecret(row);
    if (!secret) throw new Error("Falta el Client Secret.");

    if (data.provider === "paypal") {
      const token = await paypalAccessToken(row.client_id, secret, row.mode);
      return { ok: true, message: `Conexión OK (token de ${token.length} caracteres)` };
    }
    // Stripe test: hit /v1/balance
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(json.error?.message || "Error autenticando con Stripe");
    return { ok: true, message: "Conexión OK con Stripe" };
  });

// ---------- Public: which providers are enabled ----------

export const getEnabledPaymentProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payment_provider_settings")
      .select("provider, is_enabled")
      .eq("is_enabled", true);
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => r.provider);
  });

// ---------- Create Stripe Checkout Session ----------

const checkoutInput = z.object({
  planId: z.string().uuid(),
  tenantId: z.string().uuid(),
  returnUrl: z.string().url(),
});

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Must be tenant member
    const { data: member } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("No perteneces a esta tienda.");
    if (!["owner", "admin"].includes(member.role))
      throw new Error("Solo el dueño o admin puede pagar el plan.");

    const row = await getProviderConfig(context.supabase, "stripe");
    if (!row?.is_enabled) throw new Error("Stripe no está habilitado.");
    const secret = await decryptStoredSecret(row);
    if (!secret || !row.client_id) throw new Error("Credenciales de Stripe incompletas.");

    const { data: plan } = await context.supabase
      .from("plans")
      .select("id, name, price_usd")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("Plan no encontrado.");
    if (!plan.price_usd || Number(plan.price_usd) <= 0)
      throw new Error("Este plan es gratis, no requiere pago.");

    const amountCents = Math.round(Number(plan.price_usd) * 100);

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", `${data.returnUrl}?stripe=success`);
    params.set("cancel_url", `${data.returnUrl}?stripe=cancel`);
    params.set("client_reference_id", `${data.tenantId}:${data.planId}`);
    params.set("metadata[tenant_id]", data.tenantId);
    params.set("metadata[plan_id]", data.planId);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(amountCents));
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("line_items[0][price_data][product_data][name]", `Nica-POS ${plan.name}`);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(json.error?.message || "Stripe rechazó la solicitud.");

    await context.supabase.from("tenant_subscriptions").insert({
      tenant_id: data.tenantId,
      plan_id: data.planId,
      provider: "stripe",
      status: "pending",
      external_subscription_id: json.id,
      raw: { session_id: json.id },
    });

    return { url: json.url as string };
  });

// ---------- Create PayPal subscription ----------

export const createPaypalSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("No perteneces a esta tienda.");
    if (!["owner", "admin"].includes(member.role))
      throw new Error("Solo el dueño o admin puede pagar el plan.");

    const row = await getProviderConfig(context.supabase, "paypal");
    if (!row?.is_enabled) throw new Error("PayPal no está habilitado.");
    const secret = await decryptStoredSecret(row);
    if (!secret || !row.client_id) throw new Error("Credenciales de PayPal incompletas.");

    const { data: plan } = await context.supabase
      .from("plans")
      .select("id, name, price_usd")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("Plan no encontrado.");
    if (!plan.price_usd || Number(plan.price_usd) <= 0)
      throw new Error("Este plan es gratis, no requiere pago.");

    const base = await paypalBaseUrl(row.mode);
    const token = await paypalAccessToken(row.client_id, secret, row.mode);

    // 1) Create Product
    const prodRes = await fetch(`${base}/v1/catalogs/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Nica-POS ${plan.name}`,
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });
    const prod = (await prodRes.json()) as any;
    if (!prodRes.ok) throw new Error(prod.message || "Error creando producto en PayPal");

    // 2) Create Plan
    const planRes = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: prod.id,
        name: `Nica-POS ${plan.name} — Mensual`,
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: Number(plan.price_usd).toFixed(2),
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: { auto_bill_outstanding: true },
      }),
    });
    const ppPlan = (await planRes.json()) as any;
    if (!planRes.ok) throw new Error(ppPlan.message || "Error creando plan en PayPal");

    // 3) Create Subscription
    const subRes = await fetch(`${base}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: ppPlan.id,
        custom_id: `${data.tenantId}:${data.planId}`,
        application_context: {
          brand_name: "Nica-POS",
          return_url: `${data.returnUrl}?paypal=success`,
          cancel_url: `${data.returnUrl}?paypal=cancel`,
          user_action: "SUBSCRIBE_NOW",
        },
      }),
    });
    const sub = (await subRes.json()) as any;
    if (!subRes.ok) throw new Error(sub.message || "Error creando suscripción en PayPal");

    await context.supabase.from("tenant_subscriptions").insert({
      tenant_id: data.tenantId,
      plan_id: data.planId,
      provider: "paypal",
      status: "pending",
      external_subscription_id: sub.id,
      raw: { plan_id: ppPlan.id, product_id: prod.id },
    });

    const approve = (sub.links || []).find((l: any) => l.rel === "approve");
    if (!approve) throw new Error("PayPal no devolvió URL de aprobación.");
    return { url: approve.href as string };
  });

// ---------- Read tenant's current subscription ----------

export const getTenantSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tenant_subscriptions")
      .select("id, plan_id, provider, status, current_period_end, created_at")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });
