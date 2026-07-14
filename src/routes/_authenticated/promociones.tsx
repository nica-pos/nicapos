import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Tag, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/app/DashboardShell";
import {
  usePromotions,
  useSavePromotion,
  useDeletePromotion,
  useCategories,
  type Promotion,
} from "@/hooks/use-inventory";
import { useProducts } from "@/hooks/use-pos";

export const Route = createFileRoute("/_authenticated/promociones")({
  component: PromocionesPage,
  head: () => ({ meta: [{ title: "Promociones — Nica-POS" }] }),
});

const NONE = "__none__";

type FormState = {
  id?: string;
  name: string;
  target: "product" | "category";
  product_id: string;
  category_id: string;
  discount_type: "percent" | "amount";
  discount_value: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  target: "product",
  product_id: "",
  category_id: "",
  discount_type: "percent",
  discount_value: "0",
  starts_at: "",
  ends_at: "",
  is_active: true,
};

function PromocionesPage() {
  const { data: promotions, isLoading } = usePromotions();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const save = useSavePromotion();
  const del = useDeletePromotion();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const productName = useMemo(
    () => (id: string | null) => products?.find((p) => p.id === id)?.name ?? "—",
    [products],
  );
  const categoryName = useMemo(
    () => (id: string | null) =>
      categories?.find((c) => c.id === id)?.name ?? "—",
    [categories],
  );

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Promotion) {
    setForm({
      id: p.id,
      name: p.name,
      target: p.category_id ? "category" : "product",
      product_id: p.product_id ?? "",
      category_id: p.category_id ?? "",
      discount_type: (p.discount_type as "percent" | "amount") ?? "percent",
      discount_value: String(p.discount_value ?? 0),
      starts_at: p.starts_at ?? "",
      ends_at: p.ends_at ?? "",
      is_active: p.is_active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error("Escribe un nombre");
    if (form.target === "product" && !form.product_id)
      return toast.error("Selecciona un producto");
    if (form.target === "category" && !form.category_id)
      return toast.error("Selecciona una categoría");
    try {
      await save.mutateAsync({
        id: form.id,
        name: form.name.trim(),
        product_id: form.target === "product" ? form.product_id : null,
        category_id: form.target === "category" ? form.category_id : null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value) || 0,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        is_active: form.is_active,
      });
      toast.success("Promoción guardada");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Promociones
          </h1>
          <p className="text-muted-foreground">
            Descuentos automáticos por producto o categoría, aplicados en el POS.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nueva promoción
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {form.id ? "Editar promoción" : "Nueva promoción"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Rebaja de temporada"
                />
              </div>

              <div className="space-y-2">
                <Label>Aplica a</Label>
                <Select
                  value={form.target}
                  onValueChange={(v) =>
                    setForm({ ...form, target: v as "product" | "category" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Un producto</SelectItem>
                    <SelectItem value="category">Una categoría</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.target === "product" ? (
                <div className="space-y-2">
                  <Label>Producto</Label>
                  <Select
                    value={form.product_id || NONE}
                    onValueChange={(v) =>
                      setForm({ ...form, product_id: v === NONE ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {(products ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={form.category_id || NONE}
                    onValueChange={(v) =>
                      setForm({ ...form, category_id: v === NONE ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        discount_type: v as "percent" | "amount",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentaje (%)</SelectItem>
                      <SelectItem value="amount">Monto (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm({ ...form, discount_value: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) =>
                      setForm({ ...form, starts_at: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) =>
                      setForm({ ...form, ends_at: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <Label htmlFor="active">Activa</Label>
                <Switch
                  id="active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={save.isPending}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Promociones
          </CardTitle>
          <CardDescription>
            Las promociones activas se aplican automáticamente al agregar
            productos en el Punto de Venta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (promotions ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay promociones. Crea la primera.
            </p>
          ) : (
            <div className="space-y-2">
              {(promotions ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {p.name}{" "}
                      {!p.is_active && (
                        <span className="text-xs text-muted-foreground">
                          (inactiva)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.category_id
                        ? `Categoría: ${categoryName(p.category_id)}`
                        : `Producto: ${productName(p.product_id)}`}{" "}
                      ·{" "}
                      {p.discount_type === "percent"
                        ? `${Number(p.discount_value)}%`
                        : `$${Number(p.discount_value).toFixed(2)}`}{" "}
                      de descuento
                      {p.ends_at ? ` · hasta ${p.ends_at}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("¿Eliminar promoción?"))
                          del.mutate(p.id, {
                            onSuccess: () => toast.success("Eliminada"),
                          });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
