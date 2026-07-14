import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardShell } from "@/components/app/DashboardShell";
import {
  useProducts,
  useSaveProduct,
  useDeleteProduct,
  type Product,
} from "@/hooks/use-pos";
import { formatUSD } from "@/hooks/use-fiscal";

export const Route = createFileRoute("/_authenticated/productos")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Productos — Nica-POS" }] }),
});

const emptyForm = {
  id: "",
  name: "",
  barcode: "",
  category: "",
  brand: "",
  model: "",
  price_usd: "",
  stock: "",
  min_stock: "",
  is_tax_exempt: false,
  is_combo: false,

};

function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const saveProduct = useSaveProduct();
  const deleteProduct = useDeleteProduct();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = (products ?? []).filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    );
  });

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      barcode: p.barcode ?? "",
      category: p.category ?? "",
      brand: p.brand ?? "",
      model: p.model ?? "",
      price_usd: String(p.price_usd),
      stock: String(p.stock),
      is_tax_exempt: p.is_tax_exempt,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      await saveProduct.mutateAsync({
        id: form.id || undefined,
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        price_usd: Number(form.price_usd) || 0,
        stock: Number(form.stock) || 0,
        is_tax_exempt: form.is_tax_exempt,
      });
      toast.success("Producto guardado");
      setOpen(false);
    } catch (e) {
      toast.error("No se pudo guardar", { description: String((e as Error).message) });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Producto eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", { description: String((e as Error).message) });
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Package className="h-6 w-6 text-primary" /> Productos
            </h1>
            <p className="text-muted-foreground">
              Catálogo base para el Punto de Venta.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo producto
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventario ({filtered.length})</CardTitle>
            <CardDescription>
              Precios en dólares (base). El IVA se calcula en la venta.
            </CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, categoría o marca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                No hay productos. Agrega el primero para empezar a vender.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>IVA</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.barcode ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[p.category, p.brand].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUSD(Number(p.price_usd))}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(p.stock)}
                      </TableCell>
                      <TableCell>
                        {p.is_tax_exempt ? (
                          <Badge variant="secondary">Exento</Badge>
                        ) : (
                          <Badge variant="outline">Gravado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Código de barras</Label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Marca</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Modelo</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price_usd}
                  onChange={(e) =>
                    setForm({ ...form, price_usd: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Existencias</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Exento de IVA</Label>
                <p className="text-sm text-muted-foreground">
                  No se le aplica el 15% en la venta.
                </p>
              </div>
              <Switch
                checked={form.is_tax_exempt}
                onCheckedChange={(v) => setForm({ ...form, is_tax_exempt: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveProduct.isPending}>
              {saveProduct.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
