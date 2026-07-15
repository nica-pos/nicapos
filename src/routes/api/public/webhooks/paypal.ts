import { createFileRoute } from "@tanstack/react-router";

// Minimal PayPal webhook: parses the event and updates tenant_subscriptions.
// TODO: verify signature via /v1/notifications/verify-webhook-signature once
// PAYPAL_WEBHOOK_ID is stored per environment.
export const Route = createFileRoute("/api/public/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        let event: any;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const type = event.event_type as string;
        const resource = event.resource ?? {};
        const subId = resource.id;
        const custom = (resource.custom_id ?? "") as string;
        const [tenantId, planId] = custom.split(":");

        try {
          if (type === "BILLING.SUBSCRIPTION.ACTIVATED") {
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({ status: "active", raw: resource })
              .eq("external_subscription_id", subId);
            if (tenantId && planId) {
              await supabaseAdmin
                .from("tenants")
                .update({ plan_id: planId, status: "active" })
                .eq("id", tenantId);
            }
          } else if (
            type === "BILLING.SUBSCRIPTION.CANCELLED" ||
            type === "BILLING.SUBSCRIPTION.EXPIRED" ||
            type === "BILLING.SUBSCRIPTION.SUSPENDED"
          ) {
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({ status: "canceled", raw: resource })
              .eq("external_subscription_id", subId);
          } else if (type === "PAYMENT.SALE.DENIED") {
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({ status: "past_due", raw: resource })
              .eq("external_subscription_id", resource.billing_agreement_id ?? subId);
          }
        } catch (err) {
          console.error("paypal webhook error", err);
        }

        return Response.json({ received: true });
      },
    },
  },
});
