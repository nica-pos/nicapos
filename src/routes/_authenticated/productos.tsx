import { getFriendlyErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useProducts, useSaveProduct, useDeleteProduct, type Product } from "@/hooks/use-pos";
import { useCategories, useCreateLookup } from "@/hooks/use-inventory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUSD, formatNIO, useLatestRate } from "@/hooks/use-fiscal";
import { useProductImage, uploadProductImage, deleteProductImage } from "@/hooks/use-product-image";
import { useActiveTenant } from "@/hooks/use-tenant";
import { ImagePlus, X } from "lucide-react";

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
  image_url: "" as string,
};

function ProductsPage() {
  const { tenant } = useActiveTenant();
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const createCategory = useCreateLookup("categories");
  const saveProduct = useSaveProduct();
  const deleteProduct = useDeleteProduct();
  const rate = useLatestRate() ?? 0;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [priceCurrency, setPriceCurrency] = useState<"USD" | "NIO">("USD");
  const [newCategory, setNewCategory] = useState("");

  const [addingCategory, setAddingCategory] = useState(false);

  async function handleCreateCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      await createCategory.mutateAsync({ name });
      setForm((f) => ({ ...f, category: name }));
      setNewCategory("");
      setAddingCategory(false);
      toast.success("Categoría creada");
    } catch (e) {
      toast.error("No se pudo crear", { description: getFriendlyErrorMessage(e) });
    }
  }

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
    setPriceCurrency("USD");
    setOpen(true);
  }

  function openEdit(p: Product) {
    const cur = ((p as any).price_currency === "NIO" ? "NIO" : "USD") as "USD" | "NIO";
    const displayPrice =
      cur === "NIO" && rate > 0 ? (Number(p.price_usd) * rate).toFixed(2) : String(p.price_usd);
    setForm({
      id: p.id,
      name: p.name,
      barcode: p.barcode ?? "",
      category: p.category ?? "",
      brand: p.brand ?? "",
      model: p.model ?? "",
      price_usd: displayPrice,
      stock: String(p.stock),
      min_stock: String(p.min_stock),
      is_tax_exempt: p.is_tax_exempt,
      is_combo: p.is_combo,
      image_url: (p as any).image_url ?? "",
    });
    setPriceCurrency(cur);
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const rawPrice = Number(form.price_usd) || 0;
    let priceInUsd = rawPrice;
    if (priceCurrency === "NIO") {
      if (rate <= 0) {
        toast.error("Ingresá el tipo de cambio antes de guardar precios en córdobas");
        return;
      }
      priceInUsd = rawPrice / rate;
    }
    try {
      await saveProduct.mutateAsync({
        id: form.id || undefined,
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        price_usd: Number(priceInUsd.toFixed(4)),
        price_currency: priceCurrency,
        stock: Number(form.stock) || 0,
        min_stock: Number(form.min_stock) || 0,
        is_tax_exempt: form.is_tax_exempt,
        is_combo: form.is_combo,
        image_url: form.image_url || null,
      } as any);
      toast.success("Producto guardado");
      setOpen(false);
    } catch (e) {
      toast.error("No se pudo guardar", { description: getFriendlyErrorMessage(e) });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Producto eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", { description: getFriendlyErrorMessage(e) });
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
            <p className="text-muted-foreground">Catálogo base para el Punto de Venta.</p>
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
                      <TableCell className="text-muted-foreground">{p.barcode ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[p.category, p.brand].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatUSD(Number(p.price_usd))}</TableCell>
                      <TableCell className="text-right">{Number(p.stock)}</TableCell>
                      <TableCell>
                        {p.is_tax_exempt ? (
                          <Badge variant="secondary">Exento</Badge>
                        ) : (
                          <Badge variant="outline">Gravado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
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
            <DialogTitle>{form.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <ProductImageField
              tenantId={tenant?.id ?? null}
              path={form.image_url}
              onChange={(p) => setForm({ ...form, image_url: p ?? "" })}
            />
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
                {addingCategory ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Nombre de la categoría"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={createCategory.isPending}
                    >
                      {createCategory.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Crear"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingCategory(false);
                        setNewCategory("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={form.category || "__none__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setAddingCategory(true);
                        return;
                      }
                      setForm({
                        ...form,
                        category: v === "__none__" ? "" : v,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin categoría</SelectItem>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Nueva categoría…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
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
                <Label>Precio de venta</Label>
                <div className="flex gap-2">
                  <Select
                    value={priceCurrency}
                    onValueChange={(v) => {
                      const next = v as "USD" | "NIO";
                      const cur = Number(form.price_usd) || 0;
                      if (cur > 0 && rate > 0 && next !== priceCurrency) {
                        const converted = next === "NIO" ? cur * rate : cur / rate;
                        setForm({ ...form, price_usd: converted.toFixed(2) });
                      }
                      setPriceCurrency(next);
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">US$</SelectItem>
                      <SelectItem value="NIO">C$</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_usd}
                    onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                    className="flex-1"
                  />
                </div>
                {(() => {
                  const v = Number(form.price_usd) || 0;
                  if (v <= 0 || rate <= 0) return null;
                  const equiv = priceCurrency === "USD" ? formatNIO(v * rate) : formatUSD(v / rate);
                  return (
                    <p className="text-xs text-muted-foreground">
                      Equivale a {equiv} (T/C C${rate.toFixed(2)})
                    </p>
                  );
                })()}
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
              <div className="grid gap-2">
                <Label>Existencia mínima (alerta)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Exento de IVA</Label>
                <p className="text-sm text-muted-foreground">No se le aplica el 15% en la venta.</p>
              </div>
              <Switch
                checked={form.is_tax_exempt}
                onCheckedChange={(v) => setForm({ ...form, is_tax_exempt: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Es combo / paquete</Label>
                <p className="text-sm text-muted-foreground">
                  Al venderlo se descuentan sus componentes del inventario.
                </p>
              </div>
              <Switch
                checked={form.is_combo}
                onCheckedChange={(v) => setForm({ ...form, is_combo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveProduct.isPending}>
              {saveProduct.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function ProductImageField({
  tenantId,
  path,
  onChange,
}: {
  tenantId: string | null;
  path: string;
  onChange: (path: string | null) => void;
}) {
  const { data: url } = useProductImage(path || null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!tenantId) {
      toast.error("Sin tienda activa");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede pesar más de 5 MB");
      return;
    }
    setUploading(true);
    try {
      // Elimina la anterior si existía en el bucket
      if (path) await deleteProductImage(path);
      const newPath = await uploadProductImage(tenantId, file);
      onChange(newPath);
      toast.success("Imagen subida");
    } catch (e) {
      toast.error("No se pudo subir la imagen", {
        description: getFriendlyErrorMessage(e),
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (path) await deleteProductImage(path).catch(() => {});
    onChange(null);
  }

  return (
    <div className="grid gap-2">
      <Label>Imagen del producto</Label>
      <div className="flex items-center gap-3">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
          {url ? (
            <img src={url} alt="Producto" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {path ? "Cambiar imagen" : "Subir imagen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {path && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
              <X className="mr-1 h-4 w-4" /> Quitar
            </Button>
          )}
          <p className="text-xs text-muted-foreground">JPG o PNG, hasta 5 MB.</p>
        </div>
      </div>
    </div>
  );
}
