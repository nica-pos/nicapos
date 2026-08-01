import { getFriendlyErrorMessage } from "@/lib/errors";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Loader2,
  Warehouse,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowDownToLine,
  ScrollText,
  Tags,
  ClipboardCheck,
  Boxes,
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useProducts, type Product } from "@/hooks/use-pos";
import {
  useCategories,
  useBrands,
  useModels,
  useCreateLookup,
  useDeleteLookup,
  useKardex,
  useRecordMovement,
  useComboComponents,
  useAddComboComponent,
  useRemoveComboComponent,

} from "@/hooks/use-inventory";
import { formatUSD } from "@/hooks/use-fiscal";
import { useActiveBranch } from "@/hooks/use-branch";


export const Route = createFileRoute("/_authenticated/inventario")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventario — Nica-POS" }] }),
});

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: "Compra",
  sale: "Venta",
  adjustment_in: "Ajuste +",
  adjustment_out: "Ajuste −",
  audit: "Auditoría",
};

function InventoryPage() {
  const { data: products, isLoading } = useProducts();
  const { branch, isAll } = useActiveBranch();
  const [purchaseFor, setPurchaseFor] = useState<Product | null>(null);
  const [kardexFor, setKardexFor] = useState<Product | null>(null);


  const lowStock = useMemo(
    () =>
      (products ?? []).filter(
        (p) => Number(p.min_stock) > 0 && Number(p.stock) <= Number(p.min_stock),
      ),
    [products],
  );

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Warehouse className="h-6 w-6 text-primary" /> Inventario contable
            </h1>
            <p className="text-muted-foreground">
              Existencias, Kardex con Costo Promedio Ponderado y estructura del
              catálogo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/auditoria">
                <ClipboardCheck className="mr-2 h-4 w-4" /> Auditoría física
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/productos">
                <Boxes className="mr-2 h-4 w-4" /> Productos
              </Link>
            </Button>
          </div>
        </div>

        {lowStock.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> {lowStock.length} producto(s)
                bajo el mínimo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {lowStock.map((p) => (
                <Badge key={p.id} variant="destructive">
                  {p.name}: {Number(p.stock)} / mín {Number(p.min_stock)}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="stock">
          <TabsList>
            <TabsTrigger value="stock">Existencias</TabsTrigger>
            <TabsTrigger value="catalog">Catálogo</TabsTrigger>
            <TabsTrigger value="combos">Combos</TabsTrigger>

          </TabsList>

          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Existencias y costos
                  <Badge variant={isAll ? "default" : "secondary"}>
                    {isAll ? "Todas las sucursales" : (branch?.name ?? "Sin sucursal")}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {isAll
                    ? "Suma de existencias de todas tus sucursales. El costo mostrado es el Costo Promedio Ponderado (CPP)."
                    : "Existencias de la sucursal activa. Cambia de sucursal desde el selector del encabezado. El costo mostrado es el CPP."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (products?.length ?? 0) === 0 ? (
                  <p className="py-12 text-center text-muted-foreground">
                    No hay productos.{" "}
                    <Link to="/productos" className="text-primary underline">
                      Agrega el primero
                    </Link>
                    .
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead className="text-right">CPP</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(products ?? []).map((p) => {
                        const low =
                          Number(p.min_stock) > 0 &&
                          Number(p.stock) <= Number(p.min_stock);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.name}
                              {p.is_combo && (
                                <Badge variant="outline" className="ml-2">
                                  Combo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={low ? "font-bold text-destructive" : ""}>
                                {Number(p.stock)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {Number(p.min_stock)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatUSD(Number(p.cost_usd))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatUSD(Number(p.cost_usd) * Number(p.stock))}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPurchaseFor(p)}
                              >
                                <ArrowDownToLine className="mr-1 h-4 w-4" /> Entrada
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setKardexFor(p)}
                              >
                                <ScrollText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog">
            <div className="grid gap-6 md:grid-cols-3">
              <LookupCard table="categories" title="Categorías" />
              <LookupCard table="brands" title="Marcas" />
              <LookupCard table="product_models" title="Modelos" />
            </div>
          </TabsContent>

          <TabsContent value="combos">
            <CombosManager products={products ?? []} />
          </TabsContent>
        </Tabs>

      </div>

      {purchaseFor && (
        <PurchaseDialog product={purchaseFor} onClose={() => setPurchaseFor(null)} />
      )}
      {kardexFor && (
        <KardexDialog product={kardexFor} onClose={() => setKardexFor(null)} />
      )}
    </DashboardShell>
  );
}

function LookupCard({
  table,
  title,
}: {
  table: "categories" | "brands" | "product_models";
  title: string;
}) {
  const query =
    table === "categories"
      ? useCategories()
      : table === "brands"
        ? useBrands()
        : useModels();
  const create = useCreateLookup(table);
  const remove = useDeleteLookup(table);
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name: name.trim() });
      setName("");
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nueva ${title.toLowerCase()}`}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button size="icon" onClick={add}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {(query.data ?? []).map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
            >
              <span>{it.name}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => remove.mutate(it.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {(query.data?.length ?? 0) === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Sin registros
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PurchaseDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const record = useRecordMovement();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(product.cost_usd));
  const [ref, setRef] = useState("");

  async function submit() {
    if (!Number(qty)) {
      toast.error("Ingresa la cantidad");
      return;
    }
    try {
      await record.mutateAsync({
        product_id: product.id,
        movement_type: "purchase",
        quantity: Number(qty),
        unit_cost: Number(cost) || 0,
        reference: ref.trim() || undefined,
      });
      toast.success("Entrada registrada (CPP actualizado)");
      onClose();
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de inventario — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Costo unitario (USD)</Label>
              <Input
                type="number"
                step="0.0001"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Referencia (factura, proveedor…)</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Stock actual: {Number(product.stock)} · CPP actual{" "}
            {formatUSD(Number(product.cost_usd))}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={record.isPending}>
            {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KardexDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { data: movements, isLoading } = useKardex(product.id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kardex — {product.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (movements?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Sin movimientos registrados.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">CPP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("es-NI")}
                    </TableCell>
                    <TableCell>{MOVEMENT_LABELS[m.movement_type]}</TableCell>
                    <TableCell className="text-right">
                      {Number(m.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUSD(Number(m.unit_cost_usd))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(m.balance_qty)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUSD(Number(m.avg_cost_usd))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CombosManager({ products }: { products: Product[] }) {
  const combos = products.filter((p) => p.is_combo);
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = combos.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Combos / paquetes</CardTitle>
          <CardDescription>
            Marca un producto como combo en Productos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {combos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay combos.
            </p>
          ) : (
            combos.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedId === c.id ? "border-primary bg-accent" : ""
                }`}
              >
                {c.name}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selected ? (
        <ComboEditor combo={selected} products={products} />
      ) : (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
            Selecciona un combo para configurar sus componentes.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComboEditor({
  combo,
  products,
}: {
  combo: Product;
  products: Product[];
}) {
  const { data: components, isLoading } = useComboComponents(combo.id);
  const add = useAddComboComponent();
  const remove = useRemoveComboComponent();
  const [componentId, setComponentId] = useState("");
  const [qty, setQty] = useState("1");

  const options = products.filter((p) => !p.is_combo && p.id !== combo.id);

  async function handleAdd() {
    if (!componentId) {
      toast.error("Selecciona un producto");
      return;
    }
    try {
      await add.mutateAsync({
        combo_id: combo.id,
        component_id: componentId,
        quantity: Number(qty) || 1,
      });
      setComponentId("");
      setQty("1");
    } catch (e) {
      toast.error("Error", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Componentes de {combo.name}</CardTitle>
        <CardDescription>
          Al vender el combo se descuentan estas cantidades del inventario.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Label className="mb-1 block text-xs">Producto</Label>
            <Select value={componentId} onValueChange={setComponentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Label className="mb-1 block text-xs">Cantidad</Label>
            <Input
              type="number"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={add.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Agregar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (components?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin componentes.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(components ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {(c as { component?: { name?: string } }).component?.name ??
                      "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(c.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => remove.mutate(c.id)}
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
  );
}
