import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Store,
  LogOut,
  LayoutDashboard,
  Settings,
  Users,
  ShieldCheck,
  Coins,
  FileText,
  ShoppingCart,
  Package,
  Wallet,
  Warehouse,
  HandCoins,
  Truck,
  Tag,
  ClipboardCheck,
  Building2,
  ArrowRightLeft,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { BranchSelector } from "@/components/app/BranchSelector";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useActiveTenant,
  useIsSuperadmin,
  setActiveTenantId,
} from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";
import { ROUTE_ROLES, canAccessRoute, defaultHomeForRole } from "@/lib/roles";
import type { TenantRole } from "@/hooks/use-tenant";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "General",
    items: [{ to: "/dashboard", label: "Panel", icon: LayoutDashboard }],
  },
  {
    label: "Ventas",
    items: [
      { to: "/pos", label: "Punto de Venta", icon: ShoppingCart },
      { to: "/ventas", label: "Historial de ventas", icon: FileText },
      { to: "/promociones", label: "Promociones", icon: Tag },
      { to: "/clientes", label: "Clientes y Créditos", icon: HandCoins },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/productos", label: "Productos", icon: Package },
      { to: "/inventario", label: "Inventario", icon: Warehouse },
      { to: "/auditoria", label: "Auditoría física", icon: ClipboardCheck },
      { to: "/proveedores", label: "Proveedores", icon: Truck },
      { to: "/caja", label: "Caja", icon: Wallet },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/fiscal", label: "Moneda e impuestos", icon: Coins },
      
      { to: "/bitacora", label: "Bitácora", icon: ShieldCheck },
      { to: "/equipo", label: "Equipo", icon: Users },
      { to: "/sucursales", label: "Sucursales", icon: Building2 },
      { to: "/traslados", label: "Traslados", icon: ArrowRightLeft },
      { to: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

function filterNavByRole(role: TenantRole | null) {
  if (!role) return navGroups;
  return navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => (ROUTE_ROLES[i.to] ?? []).includes(role)),
    }))
    .filter((g) => g.items.length > 0);
}

const statusMeta: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  trial: { label: "Prueba", dot: "bg-warning", text: "text-warning" },
  active: { label: "Activa", dot: "bg-success", text: "text-success" },
  suspended: { label: "Suspendida", dot: "bg-destructive", text: "text-destructive" },
  cancelled: { label: "Cancelada", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tenant, memberships, role } = useActiveTenant();
  const { data: isSuperadmin } = useIsSuperadmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // Aplica el color de marca de la tienda en tiempo real (white-labeling).
  const primaryColor = tenant?.primary_color ?? null;
  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      root.style.setProperty("--primary", primaryColor);
      root.style.setProperty("--ring", primaryColor);
      root.style.setProperty("--sidebar-primary", primaryColor);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
    }
  }, [primaryColor]);

  const faviconUrl = tenant?.favicon_url ?? null;
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const prev = link.href;
    link.href = faviconUrl;
    return () => {
      if (link) link.href = prev;
    };
  }, [faviconUrl]);

  // Guard por rol: si el rol no puede acceder a la ruta actual, lo redirige a su home.
  useEffect(() => {
    if (isSuperadmin) return; // superadmin puede entrar a todo
    if (!role) return;
    const bypass = ["/onboarding", "/pago-pendiente", "/verificacion-pendiente", "/admin", "/pagos"];
    if (bypass.some((p) => pathname.startsWith(p))) return;
    if (!canAccessRoute(pathname, role)) {
      navigate({ to: defaultHomeForRole(role), replace: true });
    }
  }, [pathname, role, isSuperadmin, navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function handleSwitchTenant(id: string) {
    setActiveTenantId(id);
    queryClient.invalidateQueries();
    setMobileOpen(false);
  }

  const currentTitle = useMemo(() => {
    if (pathname.startsWith("/admin")) return "Superadmin";
    for (const g of navGroups) {
      const hit = g.items.find((i) => pathname.startsWith(i.to));
      if (hit) return hit.label;
    }
    return "";
  }, [pathname]);

  const status = tenant ? statusMeta[tenant.status] ?? statusMeta.trial : null;
  const initials = initialsOf(tenant?.name, userEmail);

  const Sidebar = (
    <div className="flex h-full flex-col">
      {/* Marca */}
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-lg shadow-primary/20">
          <div className="h-4 w-4 rotate-45 rounded-sm bg-white/25" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">Nica-POS</span>
      </div>

      {/* Selector de tienda */}
      {tenant && (
        <div className="border-b border-border/60 px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-card">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {tenant.name}
                  </div>
                  {status && !isSuperadmin && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      <span className={status.text}>{status.label}</span>
                    </div>
                  )}
                </div>
                {memberships.length > 1 && (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </DropdownMenuTrigger>
            {memberships.length > 1 && (
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel>Cambiar de tienda</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.tenant_id}
                    onClick={() => handleSwitchTenant(m.tenant_id)}
                    className={cn(
                      "gap-2",
                      m.tenant_id === tenant.id && "bg-accent",
                    )}
                  >
                    <Store className="h-4 w-4 text-muted-foreground" />
                    {m.tenant.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </div>
      )}

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {filterNavByRole(role).map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {isSuperadmin && (
          <div className="mb-5">
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Plataforma
            </div>
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                pathname.startsWith("/admin")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {pathname.startsWith("/admin") && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
              )}
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Superadmin
            </Link>
          </div>
        )}
      </nav>

      {/* Usuario */}
      <div className="border-t border-border/60 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground">
                {(userEmail ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-foreground">
                  {userEmail ?? "Cuenta"}
                </div>
                <div className="text-[11px] text-muted-foreground">Mi cuenta</div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{userEmail ?? "Cuenta"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/configuracion" onClick={() => setMobileOpen(false)}>
                <Settings className="mr-2 h-4 w-4" /> Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/60 bg-card/30 backdrop-blur-sm lg:block">
        {Sidebar}
      </aside>

      {/* Sidebar móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border/60 bg-card">
            {Sidebar}
          </aside>
        </div>
      )}

      {/* Contenedor principal */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {tenant?.name ?? "Nica-POS"}
              </span>
              <span className="text-muted-foreground/50">/</span>
              <span className="truncate text-sm font-medium text-foreground">
                {currentTitle}
              </span>
            </div>
            <BranchSelector />
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
