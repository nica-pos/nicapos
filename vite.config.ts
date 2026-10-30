// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public Supabase project configuration (same values as wrangler.toml).
// Kept here as a fallback because external Git syncs may omit the .env file.
const PUBLIC_SUPABASE_URL = "https://hhbcetordirxhkrzybjv.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYmNldG9yZGlyeGhrcnp5Ymp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTM2MzAsImV4cCI6MjA5OTU2OTYzMH0.NC8R6UUD0rLfEYlEKz7PmJPkIKocGzwI0F3IH3VK-jo";
const PUBLIC_SUPABASE_PROJECT_ID = "hhbcetordirxhkrzybjv";

process.env.VITE_SUPABASE_URL ||= PUBLIC_SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= PUBLIC_SUPABASE_PUBLISHABLE_KEY;
process.env.VITE_SUPABASE_PROJECT_ID ||= PUBLIC_SUPABASE_PROJECT_ID;
process.env.SUPABASE_URL ||= PUBLIC_SUPABASE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY ||= PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        process.env.VITE_SUPABASE_PROJECT_ID || PUBLIC_SUPABASE_PROJECT_ID,
      ),
    },
  },
});

