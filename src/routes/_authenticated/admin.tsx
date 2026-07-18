import { getFriendlyErrorMessage } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ShieldAlert,
  Building2,
  CheckCircle2,
  PauseCircle,
  DollarSign,
  Search,
  Play,
  Pause,
  MoreHorizontal,
  Store,
  Pencil,
  UserPlus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useIsSuperadmin, usePlans } from "@/hooks/use-tenant";
import {
  getAdminTenantSummaries,
  setAdminTenantStatus,
  adminCreateClient,
  adminDeleteTenant,
  cleanupOrphanAuthUsers,
} from "@/lib/tenant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Superadmin — Nica-POS" }] }),
});

const statusMeta: Record<
  string,
  { label: string; dot: string; text: string; ring: string }
> = {
  trial: {
    label: "Prueba",
    dot: "bg-warning",
    text: "text-warning",
    ring: "ring-warning/20 bg-warning/5",
  },
  active: {
    label: "Activa",
    dot: "bg-success",
    text: "text-success",
    ring: "ring-success/20 bg-success/5",
  },
  suspended: {
    label: "Suspendida",
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "ring-destructive/20 bg-destructive/5",
  },
  cancelled: {
    label: "Cancelada",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "ring-border bg-muted/40",
  },
};

function initialsOf(name?: string | null) {
  const src = (name ?? "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function privateTenantLabel(id: string, index: number) {
  return `Cliente privado ${String(index + 1).padStart(2, "0")}`;
}

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: isSuperadmin, isLoading: checking } = useIsSuperadmin();
  const fetchTenantSummaries = useServerFn(getAdminTenantSummaries);
  const updateTenantStatus = useServerFn(setAdminTenantStatus);
  const createClientFn = useServerFn(adminCreateClient);
  const deleteTenantFn = useServerFn(adminDeleteTenant);
  const cleanupOrphansFn = useServerFn(cleanupOrphanAuthUsers);
  const { data: plans } = usePlans(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "trial" | "active" | "suspended">("all");
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);

  const createClient = useMutation({
    mutationFn: (v: { email: string; password: string; tenantName: string; planId: string; durationDays: number }) =>
      createClientFn({ data: v }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Cliente creado. Ya puede iniciar sesión.");
      setCreatingClient(false);
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const savePlan = useMutation({
    mutationFn: async (p: {
      id: string;
      name: string;
      price_usd: number;
      max_products: number;
      max_cashiers: number;
      max_branches: number;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("plans")
        .update({
          name: p.name,
          price_usd: p.price_usd,
          max_products: p.max_products,
          max_cashiers: p.max_cashiers,
          max_branches: p.max_branches,
          is_active: p.is_active,
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan actualizado");
      setEditingPlan(null);
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const tenants = useQuery({
    queryKey: ["admin-tenants"],
    enabled: !!isSuperadmin,
    queryFn: () => fetchTenantSummaries(),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "trial" | "active" | "suspended" | "cancelled" }) =>
      updateTenantStatus({ data: { tenantId: id, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const deleteTenant = useMutation({
    mutationFn: (tenantId: string) => deleteTenantFn({ data: { tenantId, deleteOrphanUsers: true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      const n = res?.deletedUserIds?.length ?? 0;
      const failed = res?.failedUserDeletes?.length ?? 0;
      toast.success(
        failed > 0
          ? `Tienda eliminada. ${n} usuario(s) borrado(s), ${failed} no se pudieron borrar.`
          : n > 0
            ? `Tienda eliminada. Se eliminaron ${n} usuario(s) de autenticación.`
            : "Tienda eliminada por completo.",
      );
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const cleanupOrphans = useMutation({
    mutationFn: () => cleanupOrphansFn({ data: { confirm: true } }),
    onSuccess: (res: any) => {
      const n = res?.deletedUserIds?.length ?? 0;
      const failed = res?.failedUserDeletes?.length ?? 0;
      toast.success(
        failed > 0
          ? `Limpieza terminada: ${n} usuario(s) borrado(s), ${failed} no se pudieron borrar.`
          : n > 0
            ? `Se eliminaron ${n} usuario(s) sin tienda.`
            : "No había usuarios fantasma por eliminar.",
      );
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const list = tenants.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((t: any) => {
      const okFilter = filter === "all" || t.status === filter;
      const okQuery =
        !q ||
        t.id?.toLowerCase().includes(q) ||
        t.name?.toLowerCase().includes(q) ||
        t.owner_email?.toLowerCase().includes(q) ||
        t.owner_name?.toLowerCase().includes(q) ||
        t.plan?.name?.toLowerCase().includes(q);
      return okFilter && okQuery;
    });
  }, [list, query, filter]);

  if (checking) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  if (!isSuperadmin) {
    return (
      <DashboardShell>
        <Card className="flex flex-col items-center justify-center border-destructive/30 bg-destructive/5 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Acceso restringido</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Esta consola es exclusiva para superadministradores de la plataforma Nica-POS.
          </p>
        </Card>
      </DashboardShell>
    );
  }

  const active = list.filter((t: any) => t.status === "active").length;
  const trial = list.filter((t: any) => t.status === "trial").length;
  const suspended = list.filter((t: any) => t.status === "suspended").length;
  const mrr = list
    .filter((t: any) => t.status === "active")
    .reduce((sum: number, t: any) => sum + Number(t.plan?.price_usd ?? 0), 0);

  const metrics = [
    {
      title: "Tiendas totales",
      value: list.length.toString(),
      hint: `${trial} en prueba`,
      icon: Building2,
      accent: "text-primary bg-primary/10",
    },
    {
      title: "Suscripciones activas",
      value: active.toString(),
      hint: "Facturando este mes",
      icon: CheckCircle2,
      accent: "text-success bg-success/10",
    },
    {
      title: "Suspendidas",
      value: suspended.toString(),
      hint: "Requieren atención",
      icon: PauseCircle,
      accent: "text-destructive bg-destructive/10",
    },
    {
      title: "MRR estimado",
      value: `$${mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      hint: "USD / mes recurrente",
      icon: DollarSign,
      accent: "text-warning bg-warning/10",
    },
  ];

  const filters: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: list.length },
    { key: "active", label: "Activas", count: active },
    { key: "trial", label: "Prueba", count: trial },
    { key: "suspended", label: "Suspendidas", count: suspended },
  ];

  return (
    <DashboardShell>
      {/* Encabezado */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-primary">
            Plataforma
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Consola de superadministración
          </h1>
          <p className="text-sm text-muted-foreground">
            Supervisa tiendas, suscripciones y planes de toda la red Nica-POS.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={() => setCreatingClient(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Crear cliente
          </Button>
          <Button
            variant="outline"
            disabled={cleanupOrphans.isPending}
            onClick={() => {
              const confirmMsg =
                "¿Eliminar usuarios fantasma?\n\n" +
                "Se borrarán del sistema de autenticación los usuarios que ya no pertenecen a ninguna tienda. " +
                "No se eliminan superadmins ni usuarios con tiendas activas.";
              if (window.confirm(confirmMsg)) cleanupOrphans.mutate();
            }}
          >
            {cleanupOrphans.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Limpiar usuarios fantasma
          </Button>
          <Button asChild variant="default">
            <Link to="/admin/pagos-pendientes">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Pagos pendientes
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/bancos">
              <Building2 className="mr-2 h-4 w-4" />
              Cuentas bancarias
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/pagos">
              <DollarSign className="mr-2 h-4 w-4" />
              Pasarelas
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card
            key={m.title}
            className="border-border/60 bg-card/60 p-5 transition-all hover:border-primary/30"
          >
            <div className="flex items-start justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.title}
              </div>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", m.accent)}>
                <m.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {m.value}
            </div>
            <div className="mt-3 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              {m.hint}
            </div>
          </Card>
        ))}
      </div>

      {/* Tabla de tiendas */}
      <Card className="mt-6 overflow-hidden border-border/60 bg-card/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Tiendas</div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} de {list.length} resultados
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar tienda, correo o plan…"
                className="h-9 w-64 pl-8"
              />
            </div>
            <div className="flex overflow-hidden rounded-md border border-border/60">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "flex items-center gap-1.5 border-r border-border/60 px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0",
                    filter === f.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="tabular-nums text-[10px] opacity-70">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {tenants.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <Store className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium text-foreground">Sin resultados</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ajusta la búsqueda o los filtros.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((t: any, index: number) => {
              const meta = statusMeta[t.status] ?? statusMeta.trial;
              const label = t.name || privateTenantLabel(t.id, index);
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/30"
                >
                  <div className="col-span-12 flex items-center gap-3 md:col-span-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initialsOf(label)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{label}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        ID {String(t.id).slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-6 min-w-0 md:col-span-3">
                    <div className="truncate text-sm text-foreground">
                      {t.owner_email ?? "—"}
                    </div>
                    {t.owner_name && (
                      <div className="truncate text-xs text-muted-foreground">
                        {t.owner_name}
                      </div>
                    )}
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <div className="text-sm font-medium text-foreground">
                      {t.plan?.name ?? "—"}
                    </div>
                    {t.plan?.price_usd != null && (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        ${Number(t.plan.price_usd)}/mes
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 md:col-span-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                        meta.ring,
                        meta.text,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end md:col-span-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Acciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {t.status === "suspended" ? (
                          <DropdownMenuItem
                            onClick={() => setStatus.mutate({ id: t.id, status: "active" })}
                          >
                            <Play className="mr-2 h-4 w-4" /> Reactivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setStatus.mutate({ id: t.id, status: "suspended" })}
                            className="text-destructive focus:text-destructive"
                          >
                            <Pause className="mr-2 h-4 w-4" /> Suspender
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            const confirmMsg =
                              `¿Eliminar por completo "${label}"?\n\n` +
                              "Se borrarán TODOS los datos de la tienda (productos, ventas, caja, clientes, etc.) " +
                              "y los usuarios que solo pertenecían a ella también se eliminarán del sistema de autenticación.\n\n" +
                              "Esta acción NO se puede deshacer.";
                            if (window.confirm(confirmMsg)) deleteTenant.mutate(t.id);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar por completo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Planes */}
      <Card className="mt-6 border-border/60 bg-card/60 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Planes disponibles</div>
            <div className="text-xs text-muted-foreground">
              Precios y límites que verán las nuevas tiendas.
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(plans ?? []).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border/60 bg-background/40 p-4 transition-all hover:border-primary/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">/{p.slug}</div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                    p.is_active
                      ? "bg-success/5 text-success ring-success/20"
                      : "bg-muted/40 text-muted-foreground ring-border",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      p.is_active ? "bg-success" : "bg-muted-foreground",
                    )}
                  />
                  {p.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  ${Number(p.price_usd)}
                </span>
                <span className="text-xs text-muted-foreground">/mes</span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Productos
                  </dt>
                  <dd className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
                    {p.max_products >= 999999 ? "∞" : p.max_products.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cajeros
                  </dt>
                  <dd className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
                    {p.max_cashiers >= 999 ? "∞" : p.max_cashiers}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sucursales
                  </dt>
                  <dd className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">
                    {p.max_branches >= 999 ? "∞" : p.max_branches}
                  </dd>
                </div>
              </dl>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setEditingPlan(p)}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Editar plan
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <EditPlanDialog
        plan={editingPlan}
        onClose={() => setEditingPlan(null)}
        onSave={(values) => savePlan.mutate(values)}
        saving={savePlan.isPending}
      />

      <CreateClientDialog
        open={creatingClient}
        onClose={() => setCreatingClient(false)}
        plans={plans ?? []}
        onCreate={(v) => createClient.mutate(v)}
        saving={createClient.isPending}
      />
    </DashboardShell>
  );
}

function EditPlanDialog({
  plan,
  onClose,
  onSave,
  saving,
}: {
  plan: any | null;
  onClose: () => void;
  onSave: (v: {
    id: string;
    name: string;
    price_usd: number;
    max_products: number;
    max_cashiers: number;
    max_branches: number;
    is_active: boolean;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [maxProducts, setMaxProducts] = useState("0");
  const [maxCashiers, setMaxCashiers] = useState("0");
  const [maxBranches, setMaxBranches] = useState("0");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (plan) {
      setName(plan.name ?? "");
      setPrice(String(plan.price_usd ?? 0));
      setMaxProducts(String(plan.max_products ?? 0));
      setMaxCashiers(String(plan.max_cashiers ?? 0));
      setMaxBranches(String(plan.max_branches ?? 0));
      setIsActive(!!plan.is_active);
    }
  }, [plan]);

  const open = !!plan;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
          <DialogDescription>
            Ajusta precio, límites y disponibilidad del plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Nombre</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-price">Precio mensual (USD)</Label>
            <Input
              id="plan-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-products">Productos</Label>
              <Input
                id="plan-products"
                type="number"
                min={0}
                value={maxProducts}
                onChange={(e) => setMaxProducts(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-cashiers">Cajeros</Label>
              <Input
                id="plan-cashiers"
                type="number"
                min={0}
                value={maxCashiers}
                onChange={(e) => setMaxCashiers(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-branches">Sucursales</Label>
              <Input
                id="plan-branches"
                type="number"
                min={0}
                value={maxBranches}
                onChange={(e) => setMaxBranches(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3">
            <div>
              <div className="text-sm font-medium">Plan activo</div>
              <div className="text-xs text-muted-foreground">
                Los planes inactivos no se muestran a nuevas tiendas.
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              plan &&
              onSave({
                id: plan.id,
                name: name.trim() || plan.name,
                price_usd: Number(price) || 0,
                max_products: Math.max(0, Math.floor(Number(maxProducts) || 0)),
                max_cashiers: Math.max(0, Math.floor(Number(maxCashiers) || 0)),
                max_branches: Math.max(0, Math.floor(Number(maxBranches) || 0)),
                is_active: isActive,
              })
            }
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateClientDialog({
  open,
  onClose,
  plans,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  plans: { id: string; name: string; price_usd: number; is_active: boolean }[];
  onCreate: (v: { email: string; password: string; tenantName: string; planId: string; durationDays: number }) => void;
  saving: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [planId, setPlanId] = useState("");
  const [durationDays, setDurationDays] = useState("30");

  useEffect(() => {
    if (open) {
      setEmail("");
      setPassword("");
      setTenantName("");
      setPlanId(plans.find((p) => p.is_active)?.id ?? "");
      setDurationDays("30");
    }
  }, [open, plans]);

  const genPassword = () => {
    const s = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6).toUpperCase() + "!";
    setPassword(s);
  };

  const canSubmit = email.trim() && password.length >= 6 && tenantName.trim().length >= 2 && planId && Number(durationDays) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear cliente</DialogTitle>
          <DialogDescription>
            Se crea el usuario con acceso inmediato y su tienda queda activa con el plan seleccionado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc-email">Correo del cliente</Label>
            <Input id="cc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-pass">Contraseña temporal</Label>
            <div className="flex gap-2">
              <Input id="cc-pass" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
              <Button type="button" variant="outline" onClick={genPassword}>Generar</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Compártela con el cliente para su primer inicio de sesión.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Nombre de la tienda</Label>
            <Input id="cc-name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Mi Tienda" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-plan">Plan</Label>
              <select
                id="cc-plan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecciona…</option>
                {plans.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — ${Number(p.price_usd)}/mes</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-days">Duración (días)</Label>
              <Input id="cc-days" type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            disabled={!canSubmit || saving}
            onClick={() =>
              onCreate({
                email: email.trim().toLowerCase(),
                password,
                tenantName: tenantName.trim(),
                planId,
                durationDays: Math.max(1, Math.floor(Number(durationDays) || 30)),
              })
            }
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


