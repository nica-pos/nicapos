import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const PUBLIC_SUPABASE_URL = "https://hhbcetordirxhkrzybjv.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYmNldG9yZGlyeGhrcnp5Ymp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTM2MzAsImV4cCI6MjA5OTU2OTYzMH0.NC8R6UUD0rLfEYlEKz7PmJPkIKocGzwI0F3IH3VK-jo";

function hydrateServerEnv(env: unknown) {
  if (typeof process === "undefined" || !process.env) return;
  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      if (typeof value === "string" && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  process.env.SUPABASE_URL ||= PUBLIC_SUPABASE_URL;
  process.env.VITE_SUPABASE_URL ||= PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY ||= PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

hydrateServerEnv(undefined);

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      hydrateServerEnv(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

