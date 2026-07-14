import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Loader2,
  PackageCheck,
  HandCoins,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/app/DashboardShell";
import {
  useSuppliers,
  useUpsertSupplier,
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useReceivePurchaseOrder,
  useRecordPayablePayment,
  usePurchaseSuggestions,
  useProductsList,
  type Supplier,
} from "@/hooks/use-credit";

export const Route = createFileRoute("/_authenticated/proveedores")({
  component: ProveedoresPage,
  head: () => ({ meta: [{ title: "Proveedores y Compras — Nica-POS" }] }),
});

const money = (n: number) => `$${Number(n).toFixed(2)}`;

function ProveedoresPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Truck className="h-6 w-6 text-primary" /> Proveedores y Compras
          </h1>
          <p className="text-muted-foreground">
            Pedidos, cuentas por pagar y sugerencias de reabastecimiento.
          </p>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
            <TabsTrigger value="suggestions">Sugerencias</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-6">
            <OrdersTab />
          </TabsContent>
          <TabsContent value="suppliers" className="mt-6">
            <SuppliersTab />
          </TabsContent>
          <TabsContent value="suggestions" className="mt-6">
            <SuggestionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

// ---------- Suppliers ----------
function SuppliersTab() {
  const { data: suppliers, isLoading } = useSuppliers();
  const upsert = useUpsertSupplier();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: "",
    ruc: "",
    phone: "",
    email: "",
    contact_name: "",
  });

  function openNew() {
    setEdit(null);
    setForm({ name: "", ruc: "", phone: "", email: "", contact_name: "" });
    setOpen(true);
  }
  function openEdit(s: Supplier) {
    setEdit(s);
    setForm({
      name: s.name,
      ruc: s.ruc ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      contact_name: s.contact_name ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    try {
      await upsert.mutateAsync({ id: edit?.id, ...form, name: form.name.trim() });
      toast.success(edit ? "Proveedor actualizado" : "Proveedor creado");
      setOpen(false);
    } catch (e) {
      toast.error("Error", { description: String((e as Error).message) });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>Directorio de proveedores</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{edit ? "Editar" : "Nuevo"} proveedor</DialogTitle>
              <DialogDescription>Datos de contacto.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>RUC</Label>
                  <Input
                    value={form.ruc}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Contacto</Label>
                  <Input
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm({ ...form, contact_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Teléfono</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Correo</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={upsert.isPending}>
                {upsert.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !suppliers?.length ? (
          <p className="text-sm text-muted-foreground">Aún no hay proveedores.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>RUC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(s)}
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_name ?? "—"}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.ruc ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Orders ----------
type Line = {
  product_id: string;
  name: string;
  quantity: string;
  unit_cost_usd: string;
};

function OrdersTab() {
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProductsList();
  const { data: orders, isLoading } = usePurchaseOrders();
  const create = useCreatePurchaseOrder();
  const receive = useReceivePurchaseOrder();
  const pay = useRecordPayablePayment();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [expected, setExpected] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { product_id: "", name: "", quantity: "1", unit_cost_usd: "" },
  ]);

  const total = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost_usd) || 0),
    0,
  );

  function addLine() {
    setLines([
      ...lines,
      { product_id: "", name: "", quantity: "1", unit_cost_usd: "" },
    ]);
  }

  function pickProduct(idx: number, productId: string) {
    const p = products?.find((x) => x.id === productId);
    const n = [...lines];
    n[idx] = {
      ...n[idx],
      product_id: productId,
      name: p?.name ?? n[idx].name,
      unit_cost_usd: p ? String(p.cost_usd) : n[idx].unit_cost_usd,
    };
    setLines(n);
  }

  async function save() {
    if (!supplierId) return toast.error("Selecciona un proveedor");
    const valid = lines.filter((l) => l.name.trim() && Number(l.quantity) > 0);
    if (!valid.length) return toast.error("Agrega al menos un artículo");
    try {
      await create.mutateAsync({
        supplier_id: supplierId,
        expected_at: expected || null,
        items: valid.map((l) => ({
          product_id: l.product_id || null,
          name: l.name.trim(),
          quantity: Number(l.quantity),
          unit_cost_usd: Number(l.unit_cost_usd) || 0,
        })),
      });
      toast.success("Pedido creado");
      setOpen(false);
      setSupplierId("");
      setExpected("");
      setLines([{ product_id: "", name: "", quantity: "1", unit_cost_usd: "" }]);
    } catch (e) {
      toast.error("Error", { description: String((e as Error).message) });
    }
  }

  async function doReceive(id: string) {
    if (!window.confirm("¿Recibir el pedido y sumar al inventario?")) return;
    try {
      await receive.mutateAsync(id);
      toast.success("Pedido recibido, inventario actualizado");
    } catch (e) {
      toast.error("Error", { description: String((e as Error).message) });
    }
  }

  async function abonar(id: string, saldo: number) {
    const raw = window.prompt(`Saldo por pagar: ${money(saldo)}. Monto (USD):`);
    if (!raw) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return toast.error("Monto inválido");
    try {
      await pay.mutateAsync({ po_id: id, amount });
      toast.success("Pago registrado");
    } catch (e) {
      toast.error("Error", { description: String((e as Error).message) });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pedidos a proveedores</CardTitle>
          <CardDescription>Órdenes de compra y cuentas por pagar</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo pedido</DialogTitle>
              <DialogDescription>
                Al recibirlo, se suma al inventario con costo promedio.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Proveedor</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Fecha esperada</Label>
                  <Input
                    type="date"
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Artículos</Label>
                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Select
                        value={l.product_id}
                        onValueChange={(v) => pickProduct(idx, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Cant"
                      value={l.quantity}
                      onChange={(e) => {
                        const n = [...lines];
                        n[idx].quantity = e.target.value;
                        setLines(n);
                      }}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      placeholder="Costo unit."
                      value={l.unit_cost_usd}
                      onChange={(e) => {
                        const n = [...lines];
                        n[idx].unit_cost_usd = e.target.value;
                        setLines(n);
                      }}
                    />
                    <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                      {money(
                        (Number(l.quantity) || 0) *
                          (Number(l.unit_cost_usd) || 0),
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 h-4 w-4" /> Agregar artículo
                </Button>
              </div>
              <div className="text-right text-lg font-semibold">
                Total: {money(total)}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={create.isPending}>
                {create.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Crear pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !orders?.length ? (
          <p className="text-sm text-muted-foreground">Sin pedidos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Por pagar</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const saldo = Number(o.total_usd) - Number(o.paid_usd);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.supplier?.name ?? "—"}
                    </TableCell>
                    <TableCell>{o.expected_at ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {money(o.total_usd)}
                    </TableCell>
                    <TableCell className="text-right">{money(saldo)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          o.status === "received" ? "secondary" : "default"
                        }
                      >
                        {o.status === "received" ? "Recibido" : "Ordenado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {o.status !== "received" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => doReceive(o.id)}
                          >
                            <PackageCheck className="mr-1 h-4 w-4" /> Recibir
                          </Button>
                        )}
                        {saldo > 0.001 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abonar(o.id, saldo)}
                          >
                            <HandCoins className="mr-1 h-4 w-4" /> Pagar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Suggestions ----------
function SuggestionsTab() {
  const { data: suggestions, isLoading } = usePurchaseSuggestions();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" /> Sugerencias de compra
        </CardTitle>
        <CardDescription>
          Productos en o por debajo de su stock mínimo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !suggestions?.length ? (
          <p className="text-sm text-muted-foreground">
            Todo el inventario está por encima del mínimo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((p) => {
                const suggested = Math.max(
                  Math.ceil(Number(p.min_stock) * 2 - Number(p.stock)),
                  1,
                );
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-right">{p.stock}</TableCell>
                    <TableCell className="text-right">{p.min_stock}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {suggested}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
