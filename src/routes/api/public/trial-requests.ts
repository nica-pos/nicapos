import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  businessName: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  latitude: z.number().finite().gte(-90).lte(90).optional().nullable(),
  longitude: z.number().finite().gte(-180).lte(180).optional().nullable(),
  locationAccuracy: z.number().finite().nonnegative().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  } as Record<string, string>;
}

export const Route = createFileRoute("/api/public/trial-requests")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "JSON inválido" }), {
            status: 400,
            headers: { "content-type": "application/json", ...corsHeaders() },
          });
        }

        const parsed = bodySchema.safeParse(payload);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
            { status: 400, headers: { "content-type": "application/json", ...corsHeaders() } },
          );
        }

        const data = parsed.data;

        // Extract IP from common proxy headers
        const fwd = request.headers.get("cf-connecting-ip")
          ?? request.headers.get("x-real-ip")
          ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? null;
        const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;

        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: id, error } = await supabase.rpc("submit_trial_request", {
          _full_name: data.fullName,
          _email: data.email,
          _phone: data.phone ?? null,
          _business_name: data.businessName,
          _city: data.city ?? null,
          _country: data.country ?? null,
          _ip_address: fwd,
          _user_agent: ua,
          _latitude: data.latitude ?? null,
          _longitude: data.longitude ?? null,
          _location_accuracy: data.locationAccuracy ?? null,
          _notes: data.notes ?? null,
        });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "content-type": "application/json", ...corsHeaders() },
          });
        }

        return new Response(JSON.stringify({ id }), {
          status: 200,
          headers: { "content-type": "application/json", ...corsHeaders() },
        });
      },
    },
  },
});
