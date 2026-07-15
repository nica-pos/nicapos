import { createFileRoute } from "@tanstack/react-router";

// Minimal Stripe webhook: parses the event and updates tenant_subscriptions.
// Signature verification is skipped in this baseline (Stripe secret webhook
// signing requires storing STRIPE_WEBHOOK_SECRET per environment). Add
// verification later once the webhook endpoint is configured in Stripe.
export const Route = createFileRoute("/api/public/webhooks/stripe")({
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

        const type = event.type as string;
        const obj = event.data?.object ?? {};

        try {
          if (type === "checkout.session.completed") {
            const sessionId = obj.id;
            const meta = obj.metadata || {};
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({
                status: "active",
                external_customer_id: obj.customer ?? null,
                external_subscription_id: obj.subscription ?? sessionId,
                raw: obj,
              })
              .eq("external_subscription_id", sessionId);

            if (meta.tenant_id && meta.plan_id) {
              await supabaseAdmin
                .from("tenants")
                .update({ plan_id: meta.plan_id, status: "active" })
                .eq("id", meta.tenant_id);
            }
          } else if (
            type === "customer.subscription.deleted" ||
            type === "customer.subscription.paused"
          ) {
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({ status: "canceled", raw: obj })
              .eq("external_subscription_id", obj.id);
          } else if (type === "invoice.payment_failed") {
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({ status: "past_due", raw: obj })
              .eq("external_subscription_id", obj.subscription);
          }
        } catch (err) {
          console.error("stripe webhook error", err);
        }

        return Response.json({ received: true });
      },
    },
  },
});
