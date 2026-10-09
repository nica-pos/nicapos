import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";
import { useCustomers } from "@/hooks/use-credit";
import {
  REPAIR_STATUSES, repairBalance, repairNumber, repairProfit, statusLabel,
  useRepairAction, useRepairOrders, useTechnicians, type RepairOrder,
} from "@/hooks/use-repairs";

export const Route = createFileRoute("/_authenticated/reparaciones")({
  head: () => ({ meta: [{ title: "Reparaciones — Nica-POS" }, { name: "description", content: "Órdenes de reparación de celulares." }] }),
  component: RepairsLayout,
});

function RepairsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/reparaciones" && path !== "/reparaciones/") return <Outlet />;
  return <RepairsPage />;
}

const usd = (n: number) => `$${Number(n).toFixed(2)}`;
const OPEN = ["received", "diagnosing", "waiting_approval", "waiting_parts", "in_repair"];

function RepairsPage() {
  const { role } = useActiveTenant();
  const { data: orders = [], isLoading } = useRepairOrders();
  const { data: techs = [] } = useTechnicians();
  const { data: customers = [] } = useCustomers();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [tech, setTech] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);

  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const techName = (id: string | null) => techs.find((t) => t.id === id)?.name ?? "—";

  const filtered = orders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (tech !== "all" && o.technician_id !== tech) return false;
    if (from && o.created_at < from) return false;
    if (to && o.created_at.slice(0, 10) > to) return false;
    if (q) {
      const c = custMap.get(o.customer_id);
      const hay = [repairNumber(o.order_number), o.imei, o.brand, o.model, c?.name, c?.phone].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const valid = filtered.filter((o) => o.status !== "cancelled");
  const stats = {
    pending: filtered.filter((o) => OPEN.includes(o.status)).length,
    late: filtered.filter((o) => OPEN.includes(o.status) && o.estimated_delivery && o.estimated_delivery < today).length,
    ready: filtered.filter((o) => o.status === "ready").length,
    revenue: valid.reduce((s, o) => s + Number(o.total_usd), 0),
    parts: valid.reduce((s, o) => s + Number(o.parts_cost_usd), 0),
    profit: valid.reduce((s, o) => s + repairProfit(o), 0),
  };

  const perTech = useMemo(() => {
    const m = new Map<string, { orders: number; delivered: number; revenue: number; profit: number; days: number[] }>();
    for (const o of valid) {
      const k = o.technician_id ?? "none";
      const r = m.get(k) ?? { orders: 0, delivered: 0, revenue: 0, profit: 0, days: [] };
      r.orders++; r.revenue += Number(o.total_usd); r.profit += repairProfit(o);
      if (o.status === "delivered" && o.delivered_at) {
        r.delivered++;
        r.days.push((new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 86400000);
      }
      m.set(k, r);
    }
    return [...m.entries()];
  }, [valid]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reparaciones</h1>
          <p className="text-sm text-muted-foreground">
            {role === "technician" ? "Tus órdenes asignadas." : "Órdenes de reparación de la sucursal."}
          </p>
        </div>
        {role !== "accountant" && (
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nueva orden</Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Pendientes", stats.pending], ["Atrasadas", stats.late], ["Listas", stats.ready],
          ["Ingresos", usd(stats.revenue)], ["Costo repuestos", usd(stats.parts)], ["Ganancia", usd(stats.profit)],
        ].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-xl font-bold">{v}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Buscar número, cliente, teléfono, IMEI" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {REPAIR_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {role !== "technician" && (
          <Select value={tech} onValueChange={setTech}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los técnicos</SelectItem>
              {techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Orden</TableHead><TableHead>Cliente</TableHead><TableHead>Equipo</TableHead>
            <TableHead>Estado</TableHead><TableHead>Técnico</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Repuestos</TableHead>
            <TableHead className="text-right">Ganancia</TableHead><TableHead className="text-right">Saldo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9}>Cargando…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                <Wrench className="mx-auto mb-2 h-6 w-6" />Sin órdenes
              </TableCell></TableRow>
            )}
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell><Link to="/reparaciones/$id" params={{ id: o.id }} className="font-medium text-primary hover:underline">{repairNumber(o.order_number)}</Link></TableCell>
                <TableCell>{custMap.get(o.customer_id)?.name ?? "—"}</TableCell>
                <TableCell>{o.brand} {o.model}</TableCell>
                <TableCell><Badge variant="secondary">{statusLabel(o.status)}</Badge></TableCell>
                <TableCell>{techName(o.technician_id)}</TableCell>
                <TableCell className="text-right">{usd(Number(o.total_usd))}</TableCell>
                <TableCell className="text-right">{usd(Number(o.parts_cost_usd))}</TableCell>
                <TableCell className="text-right">{usd(repairProfit(o))}</TableCell>
                <TableCell className="text-right">{usd(repairBalance(o))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Desempeño por técnico</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Técnico</TableHead><TableHead className="text-right">Órdenes</TableHead>
              <TableHead className="text-right">Entregadas</TableHead><TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Ganancia</TableHead><TableHead className="text-right">Días prom.</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {perTech.map(([id, r]) => (
                <TableRow key={id}>
                  <TableCell>{id === "none" ? "Sin asignar" : techName(id)}</TableCell>
                  <TableCell className="text-right">{r.orders}</TableCell>
                  <TableCell className="text-right">{r.delivered}</TableCell>
                  <TableCell className="text-right">{usd(r.revenue)}</TableCell>
                  <TableCell className="text-right">{usd(r.profit)}</TableCell>
                  <TableCell className="text-right">{r.days.length ? (r.days.reduce((a, b) => a + b, 0) / r.days.length).toFixed(1) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewRepairDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewRepairDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tenant, role } = useActiveTenant();
  const { branchId } = useActiveBranch();
  const { data: customers = [], refetch } = useCustomers();
  const { data: techs = [] } = useTechnicians();
  const action = useRepairAction();
  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [techId, setTechId] = useState("");
  const [unlock, setUnlock] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!tenant || !branchId) return toast.error("Selecciona una sucursal");
    let cid = customerId;
    if (!cid) {
      if (!newName.trim()) return toast.error("Elige o crea un cliente");
      const { data, error } = await supabase.from("customers")
        .insert({ tenant_id: tenant.id, name: newName.trim(), phone: newPhone || null }).select("id").single();
      if (error) return toast.error(error.message);
      cid = data.id; refetch();
    }
    try {
      const o = (await action.mutateAsync({
        fn: "create_repair_order",
        args: { _branch_id: branchId, _customer_id: cid, _data: f, _technician_id: techId || undefined, _unlock_code: unlock || undefined },
      })) as RepairOrder;
      toast.success(`Orden ${repairNumber(o.order_number)} creada`);
      onOpenChange(false); setF({}); setCustomerId(""); setNewName(""); setNewPhone(""); setUnlock("");
    } catch (e) { toast.error((e as Error).message); }
  }

  const field = (k: string, l: string, type = "text") => (
    <div className="space-y-1"><Label>{l}</Label><Input type={type} value={f[k] ?? ""} onChange={set(k)} /></div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva orden de reparación</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Cliente existente (o crea uno abajo)" /></SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!customerId && <>
            <div className="space-y-1"><Label>Nuevo cliente</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Teléfono</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
          </>}
          {field("brand", "Marca *")}{field("model", "Modelo *")}
          {field("color", "Color")}{field("imei", "IMEI / Serie")}
          <div className="space-y-1 sm:col-span-2"><Label>Falla reportada *</Label><Textarea value={f.reported_issue ?? ""} onChange={set("reported_issue")} /></div>
          {field("accessories", "Accesorios")}{field("physical_condition", "Estado físico")}
          {field("estimated_delivery", "Entrega estimada", "date")}
          {role !== "technician" && (
            <div className="space-y-1"><Label>Técnico</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>{techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1 sm:col-span-2"><Label>Observaciones</Label><Textarea value={f.observations ?? ""} onChange={set("observations")} /></div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Código de desbloqueo (opcional)</Label>
            <Input type="password" value={unlock} onChange={(e) => setUnlock(e.target.value)} />
            <p className="text-xs text-muted-foreground">Solo lo verán el técnico asignado y los administradores.</p>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={action.isPending}>Crear orden</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
