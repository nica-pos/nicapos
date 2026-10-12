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
import { encodeLock, PatternInput, type LockType } from "@/components/app/PatternLock";

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

const BRANDS = ["Samsung", "Apple (iPhone)", "Xiaomi", "Motorola", "Huawei", "Honor", "Oppo", "Tecno", "Infinix", "ZTE", "Nokia", "LG", "Alcatel", "Otra"];
const ISSUES = [
  "Pantalla rota", "Cambio de batería", "No carga / puerto de carga", "No enciende", "Daño por agua",
  "Cámara no funciona", "Sin audio / altavoz", "Micrófono", "Botones", "Software / se reinicia",
  "Desbloqueo / cuenta", "Señal / WiFi", "Tapa trasera", "Otra",
];

function NewRepairDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tenant } = useActiveTenant();
  const { branchId } = useActiveBranch();
  const { refetch } = useCustomers();
  const action = useRepairAction();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [otherBrand, setOtherBrand] = useState("");
  const [model, setModel] = useState("");
  const [issue, setIssue] = useState("");
  const [otherIssue, setOtherIssue] = useState("");
  const [lockType, setLockType] = useState<LockType>("none");
  const [lockText, setLockText] = useState("");
  const [pattern, setPattern] = useState<number[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName(""); setBrand(""); setOtherBrand(""); setModel(""); setIssue(""); setOtherIssue("");
    setLockType("none"); setLockText(""); setPattern([]); setFiles([]);
  }

  async function submit() {
    if (!tenant || !branchId) return toast.error("Selecciona una sucursal");
    const b = brand === "Otra" ? otherBrand.trim() : brand;
    const i = issue === "Otra" ? otherIssue.trim() : issue;
    if (!name.trim() || !b || !model.trim() || !i) return toast.error("Completa cliente, marca, modelo y falla");
    if (lockType === "pattern" && pattern.length < 4) return toast.error("El patrón debe tener al menos 4 puntos");
    if ((lockType === "pin" || lockType === "password") && !lockText) return toast.error("Escribe el código de bloqueo");
    setBusy(true);
    try {
      const { data: c, error } = await supabase.from("customers")
        .insert({ tenant_id: tenant.id, name: name.trim() }).select("id").single();
      if (error) throw error;
      refetch();
      const photo_paths: string[] = [];
      for (const f of files) {
        const path = `${tenant.id}/${crypto.randomUUID()}.${f.name.split(".").pop() || "jpg"}`;
        const up = await supabase.storage.from("repair-photos").upload(path, f);
        if (up.error) throw up.error;
        photo_paths.push(path);
      }
      const code = encodeLock(lockType, lockText, pattern);
      const o = (await action.mutateAsync({
        fn: "create_repair_order",
        args: { _branch_id: branchId, _customer_id: c.id, _data: { brand: b, model: model.trim(), reported_issue: i, photo_paths }, _unlock_code: code || undefined },
      })) as RepairOrder;
      toast.success(`Orden ${repairNumber(o.order_number)} creada`);
      onOpenChange(false); reset();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva reparación</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nombre del cliente *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Marca *</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue placeholder="Elige marca" /></SelectTrigger>
                <SelectContent>{BRANDS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
              {brand === "Otra" && <Input placeholder="Escribe la marca" value={otherBrand} onChange={(e) => setOtherBrand(e.target.value)} />}
            </div>
            <div className="space-y-1"><Label>Modelo *</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Falla *</Label>
            <Select value={issue} onValueChange={setIssue}>
              <SelectTrigger><SelectValue placeholder="Elige la falla" /></SelectTrigger>
              <SelectContent>{ISSUES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
            {issue === "Otra" && <Input placeholder="Describe la falla" value={otherIssue} onChange={(e) => setOtherIssue(e.target.value)} />}
          </div>
          <div className="space-y-1"><Label>Tipo de bloqueo</Label>
            <Select value={lockType} onValueChange={(v) => { setLockType(v as LockType); setLockText(""); setPattern([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin bloqueo</SelectItem>
                <SelectItem value="pin">PIN</SelectItem>
                <SelectItem value="pattern">Patrón</SelectItem>
                <SelectItem value="password">Contraseña alfanumérica</SelectItem>
              </SelectContent>
            </Select>
            {lockType === "pin" && <Input inputMode="numeric" placeholder="PIN" value={lockText} onChange={(e) => setLockText(e.target.value.replace(/\D/g, ""))} />}
            {lockType === "password" && <Input placeholder="Contraseña" value={lockText} onChange={(e) => setLockText(e.target.value)} />}
            {lockType === "pattern" && <PatternInput value={pattern} onChange={setPattern} />}
            {lockType !== "none" && <p className="text-xs text-muted-foreground">Solo lo verán el técnico asignado y los administradores.</p>}
          </div>
          <div className="space-y-1"><Label>Fotos de cómo llega el equipo</Label>
            <Input type="file" accept="image/*" capture="environment" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} foto(s) seleccionada(s)</p>}
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Guardando…" : "Crear orden"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
