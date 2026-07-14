import { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Store,
  LogOut,
  LayoutDashboard,
  Settings,
  Users,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useActiveTenant,
  useIsSuperadmin,
  setActiveTenantId,
} from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/equipo", label: "Equipo", icon: Users },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tenant, memberships } = useActiveTenant();
  const { data: isSuperadmin } = useIsSuperadmin();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function handleSwitchTenant(id: string) {
    setActiveTenantId(id);
    queryClient.invalidateQueries();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Store className="h-6 w-6 text-primary" />
            <span className="text-gradient">Nica-POS</span>
          </Link>

          <div className="flex items-center gap-3">
            {memberships.length > 1 && tenant && (
              <Select value={tenant.id} onValueChange={handleSwitchTenant}>
                <SelectTrigger className="hidden w-48 sm:flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((m) => (
                    <SelectItem key={m.tenant_id} value={m.tenant_id}>
                      {m.tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {isSuperadmin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                Superadmin
              </Link>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
