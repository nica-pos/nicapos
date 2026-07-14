import { getFriendlyErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Users, Plus, HandCoins, Bookmark, Loader2 } from "lucide-react";
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
  useCustomers,
  useUpsertCustomer,
  useReceivables,
  useCreateReceivable,
  useRecordReceivablePayment,
  useLayaways,
  useCreateLayaway,
  useRecordLayawayPayment,
  type Customer,
} from "@/hooks/use-credit";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Clientes y Créditos — Nica-POS" }] }),
});

const money = (n: number) => `$${Number(n).toFixed(2)}`;

function ClientesPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" /> Clientes y Créditos
          </h1>
          <p className="text-muted-foreground">
            Cuentas por cobrar, límites de crédito y apartados.
          </p>
        </div>

        <Tabs defaultValue="customers">
          <TabsList>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="receivables">Por cobrar</TabsTrigger>
            <TabsTrigger value="layaways">Apartados</TabsTrigger>
          </TabsList>
          <TabsContent value="customers" className="mt-6">
            <CustomersTab />
          </TabsContent>
          <TabsContent value="receivables" className="mt-6">
            <ReceivablesTab />
          </TabsContent>
          <TabsContent value="layaways" className="mt-6">
            <LayawaysTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

// ---------- Customers ----------
function CustomersTab() {
  const { data: customers, isLoading } = useCustomers();
  const upsert = useUpsertCustomer();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    ruc: "",
    phone: "",
    email: "",
    credit_limit_usd: "0",
  });

  function openNew() {
    setEdit(null);
    setForm({ name: "", ruc: "", phone: "", email: "", credit_limit_usd: "0" });
    setOpen(true);
  }
  function openEdit(c: Customer) {
    setEdit(c);
    setForm({
      name: c.name,
      ruc: c.ruc ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      credit_limit_usd: String(c.credit_limit_usd),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    try {
      await upsert.mutateAsync({
        id: edit?.id,
        name: form.name.trim(),
        ruc: form.ruc,
        phone: form.phone,
        email: form.email,
        credit_limit_usd: Number(form.credit_limit_usd) || 0,
      });
      toast.success(edit ? "Cliente actualizado" : "Cliente creado");
      setOpen(false);
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>Directorio y límites de crédito</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{edit ? "Editar" : "Nuevo"} cliente</DialogTitle>
              <DialogDescription>Datos de contacto y crédito.</DialogDescription>
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
                  <Label>RUC / Cédula</Label>
                  <Input
                    value={form.ruc}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Teléfono</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Correo</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Límite de crédito (USD)</Label>
                <Input
                  type="number"
                  value={form.credit_limit_usd}
                  onChange={(e) =>
                    setForm({ ...form, credit_limit_usd: e.target.value })
                  }
                />
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
        ) : !customers?.length ? (
          <p className="text-sm text-muted-foreground">Aún no hay clientes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUC</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Límite crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(c)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.ruc ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {money(c.credit_limit_usd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Receivables ----------
function ReceivablesTab() {
  const { data: customers } = useCustomers();
  const { data: receivables, isLoading } = useReceivables();
  const create = useCreateReceivable();
  const pay = useRecordReceivablePayment();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    total_usd: "",
    description: "",
    due_date: "",
  });

  async function save() {
    if (!form.customer_id) return toast.error("Selecciona un cliente");
    const total = Number(form.total_usd);
    if (!total || total <= 0) return toast.error("Monto inválido");
    try {
      await create.mutateAsync({
        customer_id: form.customer_id,
        total_usd: total,
        description: form.description,
        due_date: form.due_date || null,
      });
      toast.success("Crédito registrado");
      setOpen(false);
      setForm({ customer_id: "", total_usd: "", description: "", due_date: "" });
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  async function abonar(id: string, saldo: number) {
    const raw = window.prompt(`Saldo pendiente: ${money(saldo)}. Monto del abono (USD):`);
    if (!raw) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return toast.error("Monto inválido");
    try {
      await pay.mutateAsync({ receivable_id: id, amount });
      toast.success("Abono registrado");
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cuentas por cobrar</CardTitle>
          <CardDescription>Créditos otorgados a clientes</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo crédito
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo crédito</DialogTitle>
              <DialogDescription>Registra un saldo por cobrar.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Cliente</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => setForm({ ...form, customer_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Monto (USD)</Label>
                  <Input
                    type="number"
                    value={form.total_usd}
                    onChange={(e) =>
                      setForm({ ...form, total_usd: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Vencimiento</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm({ ...form, due_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Descripción</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={create.isPending}>
                {create.isPending && (
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
        ) : !receivables?.length ? (
          <p className="text-sm text-muted-foreground">Sin cuentas por cobrar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((r) => {
                const saldo = Number(r.total_usd) - Number(r.paid_usd);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.customer?.name ?? "—"}
                    </TableCell>
                    <TableCell>{r.due_date ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {money(r.total_usd)}
                    </TableCell>
                    <TableCell className="text-right">{money(saldo)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "paid" ? "secondary" : "default"}
                      >
                        {r.status === "paid" ? "Pagado" : "Abierto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abonar(r.id, saldo)}
                        >
                          <HandCoins className="mr-1 h-4 w-4" /> Abonar
                        </Button>
                      )}
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

// ---------- Layaways ----------
function LayawaysTab() {
  const { data: customers } = useCustomers();
  const { data: layaways, isLoading } = useLayaways();
  const create = useCreateLayaway();
  const pay = useRecordLayawayPayment();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [expires, setExpires] = useState("");
  const [deposit, setDeposit] = useState("");
  const [items, setItems] = useState([
    { name: "", quantity: "1", unit_price_usd: "" },
  ]);

  const total = items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price_usd) || 0),
    0,
  );

  function addItem() {
    setItems([...items, { name: "", quantity: "1", unit_price_usd: "" }]);
  }

  async function save() {
    if (!customerId) return toast.error("Selecciona un cliente");
    const valid = items.filter(
      (i) => i.name.trim() && Number(i.quantity) > 0,
    );
    if (!valid.length) return toast.error("Agrega al menos un artículo");
    try {
      await create.mutateAsync({
        customer_id: customerId,
        expires_at: expires || null,
        deposit: Number(deposit) || 0,
        items: valid.map((i) => ({
          name: i.name.trim(),
          quantity: Number(i.quantity),
          unit_price_usd: Number(i.unit_price_usd) || 0,
        })),
      });
      toast.success("Apartado creado");
      setOpen(false);
      setCustomerId("");
      setExpires("");
      setDeposit("");
      setItems([{ name: "", quantity: "1", unit_price_usd: "" }]);
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  async function abonar(id: string, saldo: number) {
    const raw = window.prompt(`Saldo pendiente: ${money(saldo)}. Monto del abono (USD):`);
    if (!raw) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return toast.error("Monto inválido");
    try {
      await pay.mutateAsync({ layaway_id: id, amount });
      toast.success("Abono registrado");
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Apartados (Layaway)</CardTitle>
          <CardDescription>Reservas con abono inicial</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo apartado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo apartado</DialogTitle>
              <DialogDescription>
                Reserva productos con un abono inicial.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Cliente</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Expira</Label>
                  <Input
                    type="date"
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Artículos</Label>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2">
                    <Input
                      className="col-span-3"
                      placeholder="Producto"
                      value={it.name}
                      onChange={(e) => {
                        const n = [...items];
                        n[idx].name = e.target.value;
                        setItems(n);
                      }}
                    />
                    <Input
                      className="col-span-1"
                      type="number"
                      placeholder="Cant"
                      value={it.quantity}
                      onChange={(e) => {
                        const n = [...items];
                        n[idx].quantity = e.target.value;
                        setItems(n);
                      }}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Precio"
                      value={it.unit_price_usd}
                      onChange={(e) => {
                        const n = [...items];
                        n[idx].unit_price_usd = e.target.value;
                        setItems(n);
                      }}
                    />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-4 w-4" /> Agregar artículo
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Abono inicial (USD)</Label>
                  <Input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                  />
                </div>
                <div className="flex items-end justify-end text-lg font-semibold">
                  Total: {money(total)}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={create.isPending}>
                {create.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Crear apartado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !layaways?.length ? (
          <p className="text-sm text-muted-foreground">Sin apartados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {layaways.map((l) => {
                const saldo = Number(l.total_usd) - Number(l.paid_usd);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.customer?.name ?? "—"}
                    </TableCell>
                    <TableCell>{l.expires_at ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {money(l.total_usd)}
                    </TableCell>
                    <TableCell className="text-right">{money(saldo)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          l.status === "completed" ? "secondary" : "default"
                        }
                      >
                        {l.status === "completed" ? "Completado" : "Activo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abonar(l.id, saldo)}
                        >
                          <Bookmark className="mr-1 h-4 w-4" /> Abonar
                        </Button>
                      )}
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
