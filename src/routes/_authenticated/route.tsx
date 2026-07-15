import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";

// Rutas exentas del gate de estado (el propio flujo de pago/verificación,
// onboarding, y la consola superadmin).
const EXEMPT_PATHS = [
  "/onboarding",
  "/pago-pendiente",
  "/verificacion-pendiente",
  "/admin",
  "/admin/bancos",
  "/admin/pagos-pendientes",
  "/pagos",
];

function TenantStatusGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, isLoading } = useActiveTenant();
  const { data: isSuper } = useIsSuperadmin();

  useEffect(() => {
    if (isLoading || !tenant || isSuper) return;
    const path = location.pathname;
    if (EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return;

    const status = tenant.status as string;
    if (status === "pending_payment") {
      navigate({ to: "/pago-pendiente", replace: true });
    } else if (status === "pending_verification") {
      navigate({ to: "/verificacion-pendiente", replace: true });
    }
  }, [tenant, isLoading, isSuper, location.pathname, navigate]);

  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: TenantStatusGate,
});
