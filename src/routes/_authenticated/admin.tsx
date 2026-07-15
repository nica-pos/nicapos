import { getFriendlyErrorMessage } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
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
  Eye,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useIsSuperadmin, usePlans } from "@/hooks/use-tenant";
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

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: isSuperadmin, isLoading: checking } = useIsSuperadmin();
  const { data: plans } = usePlans(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "trial" | "active" | "suspended">("all");
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [detailTenant, setDetailTenant] = useState<any | null>(null);

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, plan:plans(name, price_usd)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ownerIds = Array.from(
        new Set((data ?? []).map((t: any) => t.owner_id).filter(Boolean)),
      );
      let ownersById: Record<string, { email: string | null; full_name: string | null }> = {};
      if (ownerIds.length > 0) {
        const { data: owners, error: ownersError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", ownerIds);
        if (ownersError) throw ownersError;
        ownersById = Object.fromEntries(
          (owners ?? []).map((o: any) => [o.id, { email: o.email, full_name: o.full_name }]),
        );
      }
      return (data ?? []).map((t: any) => ({
        ...t,
        owner: t.owner_id ? ownersById[t.owner_id] ?? null : null,
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tenants")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Estado actualizado");
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
        t.name?.toLowerCase().includes(q) ||
        t.owner?.email?.toLowerCase().includes(q) ||
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
        <Button asChild variant="outline">
          <Link to="/pagos">
            <DollarSign className="mr-2 h-4 w-4" />
            Configuración de pagos
          </Link>
        </Button>
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
                placeholder="Buscar tienda, dueño o plan…"
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
            {filtered.map((t: any) => {
              const meta = statusMeta[t.status] ?? statusMeta.trial;
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/30"
                >
                  <div className="col-span-12 flex items-center gap-3 md:col-span-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initialsOf(t.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.ruc ? `RUC ${t.ruc}` : t.slug}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-6 truncate text-xs text-muted-foreground md:col-span-3">
                    {t.owner?.email ?? "—"}
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDetailTenant(t)}>
                          <Eye className="mr-2 h-4 w-4" /> Ver detalle
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

      <TenantDetailDialog
        tenant={detailTenant}
        onClose={() => setDetailTenant(null)}
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

function TenantDetailDialog({
  tenant,
  onClose,
}: {
  tenant: any | null;
  onClose: () => void;
}) {
  const open = !!tenant;
  const members = useQuery({
    queryKey: ["admin-tenant-detail", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const [membersRes, salesRes] = await Promise.all([
        supabase
          .from("tenant_members")
          .select("user_id, role, created_at")
          .eq("tenant_id", tenant!.id),
        supabase
          .from("sales")
          .select("id, total_usd", { count: "exact" })
          .eq("tenant_id", tenant!.id),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (salesRes.error) throw salesRes.error;
      const userIds = (membersRes.data ?? []).map((m) => m.user_id);
      let profiles: Record<string, { email: string | null; full_name: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);
        profiles = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.id, { email: p.email, full_name: p.full_name }]),
        );
      }
      const totalUsd = (salesRes.data ?? []).reduce(
        (s, r: any) => s + Number(r.total_usd ?? 0),
        0,
      );
      return {
        members: (membersRes.data ?? []).map((m) => ({
          ...m,
          profile: profiles[m.user_id] ?? null,
        })),
        totalSales: salesRes.count ?? 0,
        totalRevenueUsd: totalUsd,
      };
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tenant?.name}</DialogTitle>
          <DialogDescription>
            Detalle operativo de la tienda (solo lectura).
          </DialogDescription>
        </DialogHeader>
        {members.isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ventas
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {members.data?.totalSales ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ingresos
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  ${(members.data?.totalRevenueUsd ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Equipo
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {members.data?.members.length ?? 0}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Miembros
              </div>
              <div className="space-y-1.5">
                {(members.data?.members ?? []).map((m: any) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {m.profile?.full_name || m.profile?.email || "Sin nombre"}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium capitalize text-primary">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Slug:</span> /{tenant?.slug}
              </div>
              {tenant?.ruc && (
                <div>
                  <span className="font-medium text-foreground">RUC:</span> {tenant.ruc}
                </div>
              )}
              <div>
                <span className="font-medium text-foreground">Creada:</span>{" "}
                {tenant?.created_at
                  ? new Date(tenant.created_at).toLocaleDateString("es-NI")
                  : "—"}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
