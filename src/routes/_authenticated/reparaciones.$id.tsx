import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useProducts } from "@/hooks/use-pos";
import {
  REPAIR_STATUSES, repairBalance, repairNumber, repairProfit, statusLabel,
  useRepairAction, useRepairOrder, useTechnicians,
} from "@/hooks/use-repairs";

export const Route = createFileRoute("/_authenticated/reparaciones/$id")({
  head: () => ({ meta: [{ title: "Orden de reparación — Nica-POS" }, { name: "description", content: "Detalle de la orden de reparación." }] }),
  component: RepairDetail,
});

const usd = (n: number) => `$${Number(n).toFixed(2)}`;
type PartRow = { id?: string; product_id?: string | null; name: string; quantity: number; unit_price_usd: number; consumed?: boolean };

function RepairDetail() {
  const { id } = Route.useParams();
  const { role } = useActiveTenant();
  const isAdmin = role === "owner" || role === "admin";
  const { data, isLoading } = useRepairOrder(id);
  const { data: techs = [] } = useTechnicians();
  const { data: products = [] } = useProducts() as { data?: { id: string; name: string; price_usd?: number; sale_price_usd?: number }[] };
  const action = useRepairAction();
  const [labor, setLabor] = useState(0);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [note, setNote] = useState("");
  const [pay, setPay] = useState({ amount: "", currency: "USD", method: "cash_usd", kind: "advance" });
  const [diag, setDiag] = useState({ diagnosis: "", work_to_do: "" });

  useEffect(() => {
    if (!data?.order) return;
    setLabor(Number(data.order.labor_usd));
    setParts(data.parts.map((p) => ({ id: p.id, product_id: p.product_id, name: p.name, quantity: Number(p.quantity), unit_price_usd: Number(p.unit_price_usd), consumed: p.consumed })));
    setDiag({ diagnosis: data.order.diagnosis ?? "", work_to_do: data.order.work_to_do ?? "" });
  }, [data]);

  if (isLoading) return <p>Cargando…</p>;
  const o = data?.order;
  if (!o) return <p>Orden no encontrada o sin acceso.</p>;
  const closed = o.status === "delivered" || o.status === "cancelled";
  const balance = repairBalance(o);

  async function run(fn: string, args: Record<string, unknown>, ok: string) {
    try { await action.mutateAsync({ fn, args }); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
  }

  function printReceipt() {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<pre style="font-family:monospace">${repairNumber(o!.order_number)}
Cliente: ${data!.customer?.name ?? ""} ${data!.customer?.phone ?? ""}
Equipo: ${o!.brand} ${o!.model} ${o!.color ?? ""}
IMEI: ${o!.imei ?? "-"}
Falla: ${o!.reported_issue}
Accesorios: ${o!.accessories ?? "-"}
Estado: ${statusLabel(o!.status)}
Total: ${usd(Number(o!.total_usd))}
Pagado: ${usd(Number(o!.paid_usd))}
Saldo: ${usd(balance)}
Fecha: ${new Date().toLocaleString()}</pre>`);
    w.document.close(); w.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/reparaciones"><ArrowLeft className="mr-1 h-4 w-4" />Volver</Link></Button>
        <h1 className="text-2xl font-bold">{repairNumber(o.order_number)}</h1>
        <Badge>{statusLabel(o.status)}</Badge>
        <Badge variant="outline">Cotización: {o.quote_status}</Badge>
        <div className="ml-auto"><Button variant="outline" size="sm" onClick={printReceipt}><Printer className="mr-1 h-4 w-4" />Comprobante</Button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[["Total", usd(Number(o.total_usd))], ["Pagado", usd(Number(o.paid_usd))], ["Saldo", usd(balance)],
          ["Ganancia", usd(repairProfit(o))]].map(([l, v]) => (
          <Card key={l}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Equipo</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><b>Cliente:</b> {data.customer?.name} {data.customer?.phone}</div>
            <div><b>Equipo:</b> {o.brand} {o.model} {o.color}</div>
            <div><b>IMEI:</b> {o.imei ?? "—"}</div>
            <div><b>Falla:</b> {o.reported_issue}</div>
            <div><b>Accesorios:</b> {o.accessories ?? "—"}</div>
            <div><b>Estado físico:</b> {o.physical_condition ?? "—"}</div>
            <div><b>Entrega estimada:</b> {o.estimated_delivery ?? "—"}</div>
            {data.unlockCode && <div><b>Código desbloqueo:</b> <span className="font-mono">{data.unlockCode}</span></div>}
            <div className="pt-2">
              <b>Técnico:</b>{" "}
              {isAdmin ? (
                <Select value={o.technician_id ?? ""} onValueChange={(v) => run("update_repair_order", { _order_id: o.id, _data: { technician_id: v } }, "Técnico asignado")}>
                  <SelectTrigger className="mt-1 w-60"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>{techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : techs.find((t) => t.id === o.technician_id)?.name ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Estado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!closed && (
              <Select value={o.status} onValueChange={(v) => run("change_repair_status", { _order_id: o.id, _status: v }, "Estado actualizado")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REPAIR_STATUSES.filter((s) => !["delivered", "cancelled"].includes(s.value)).map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap gap-2">
              {!closed && <Button size="sm" onClick={() => {
                let reason: string | undefined;
                if (balance > 0) {
                  if (!isAdmin) return toast.error("Hay saldo pendiente; cobra antes de entregar.");
                  reason = prompt("Saldo pendiente. Motivo de la excepción:") ?? undefined;
                  if (!reason) return;
                }
                run("deliver_repair", { _order_id: o.id, _exception_reason: reason }, "Equipo entregado");
              }}>Entregar</Button>}
              {!closed && <Button size="sm" variant="destructive" onClick={() => {
                const r = prompt("Motivo de cancelación:"); if (r) run("cancel_repair", { _order_id: o.id, _reason: r }, "Orden cancelada");
              }}>Cancelar</Button>}
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {data.history.map((h) => <div key={h.id}>{new Date(h.created_at).toLocaleString()} · {h.from_status ? statusLabel(h.from_status) + " → " : ""}{statusLabel(h.to_status)} {h.note ? `· ${h.note}` : ""}</div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Diagnóstico y cotización</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Textarea placeholder="Diagnóstico" value={diag.diagnosis} onChange={(e) => setDiag({ ...diag, diagnosis: e.target.value })} />
            <Textarea placeholder="Trabajo a realizar" value={diag.work_to_do} onChange={(e) => setDiag({ ...diag, work_to_do: e.target.value })} />
          </div>
          <Button size="sm" variant="outline" onClick={() => run("update_repair_order", { _order_id: o.id, _data: diag }, "Diagnóstico guardado")}>Guardar diagnóstico</Button>

          <div className="space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input className="w-56" value={p.name} disabled={p.consumed} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <Input className="w-20" type="number" value={p.quantity} disabled={p.consumed} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                <Input className="w-28" type="number" value={p.unit_price_usd} disabled={p.consumed && !isAdmin} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, unit_price_usd: Number(e.target.value) } : x))} />
                {p.consumed ? <Badge variant="secondary">Consumido</Badge> : (
                  <>
                    {p.id && <Button size="sm" variant="outline" onClick={() => run("consume_repair_part", { _part_id: p.id }, "Repuesto descontado del inventario")}>Usar</Button>}
                    <Button size="icon" variant="ghost" onClick={() => setParts(parts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
                {p.id && isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => { const c = prompt("Costo unitario USD:"); if (c) run("set_repair_part_cost", { _part_id: p.id, _unit_cost: Number(c) }, "Costo actualizado"); }}>Costo</Button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Select onValueChange={(pid) => { const pr = products.find((x) => x.id === pid); if (pr) setParts([...parts, { product_id: pr.id, name: pr.name, quantity: 1, unit_price_usd: Number(pr.sale_price_usd ?? pr.price_usd ?? 0) }]); }}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Agregar repuesto del inventario" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setParts([...parts, { name: "Repuesto", quantity: 1, unit_price_usd: 0 }])}>Repuesto manual</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Mano de obra USD</span>
            <Input className="w-32" type="number" value={labor} onChange={(e) => setLabor(Number(e.target.value))} />
            <span className="text-sm font-semibold">Total: {usd(labor + parts.reduce((s, p) => s + p.quantity * p.unit_price_usd, 0))}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run("save_repair_quote", { _order_id: o.id, _labor: labor, _parts: parts }, "Cotización enviada al cliente")}>Guardar cotización</Button>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => run("save_repair_quote", { _order_id: o.id, _labor: labor, _parts: parts, _skip_approval: true, _note: "Corrección de administrador" }, "Precio corregido")}>Corregir sin aprobación</Button>}
            {o.quote_status === "pending" && <>
              <Button size="sm" variant="secondary" onClick={() => run("decide_repair_quote", { _order_id: o.id, _approved: true }, "Cotización aprobada")}>Cliente aprobó</Button>
              <Button size="sm" variant="ghost" onClick={() => run("decide_repair_quote", { _order_id: o.id, _approved: false }, "Cotización rechazada")}>Cliente rechazó</Button>
            </>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pagos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!closed && (
              <div className="flex flex-wrap gap-2">
                <Input className="w-28" type="number" placeholder="Monto" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                <Select value={pay.currency} onValueChange={(v) => setPay({ ...pay, currency: v })}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="NIO">NIO</SelectItem></SelectContent></Select>
                <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash_usd">Efectivo USD</SelectItem><SelectItem value="cash_nio">Efectivo C$</SelectItem><SelectItem value="card">Tarjeta</SelectItem><SelectItem value="transfer">Transferencia</SelectItem></SelectContent></Select>
                <Select value={pay.kind} onValueChange={(v) => setPay({ ...pay, kind: v })}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="advance">Anticipo</SelectItem><SelectItem value="final">Pago final</SelectItem></SelectContent></Select>
                <Button size="sm" onClick={() => { const a = Number(pay.amount); if (a > 0) run("record_repair_payment", { _order_id: o.id, _amount: a, _currency: pay.currency, _method: pay.method, _kind: pay.kind }, "Pago registrado").then(() => setPay({ ...pay, amount: "" })); }}>Cobrar</Button>
              </div>
            )}
            {data.payments.map((p) => <div key={p.id} className="text-sm">{new Date(p.created_at).toLocaleDateString()} · {p.kind === "advance" ? "Anticipo" : "Final"} · {p.amount} {p.currency} ({usd(Number(p.amount_usd))})</div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Notas internas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar nota" />
              <Button size="sm" onClick={() => note.trim() && run("add_repair_note", { _order_id: o.id, _note: note }, "Nota agregada").then(() => setNote(""))}>Agregar</Button>
            </div>
            {data.notes.map((n) => <div key={n.id} className="text-sm"><span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span> · {n.note}</div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
