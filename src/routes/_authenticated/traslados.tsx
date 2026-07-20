import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/app/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRightLeft, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";
import { useBranches } from "@/hooks/use-branch";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/traslados")({
  component: TrasladosPage,
});

type ProductLite = { id: string; name: string; sku: string | null };
type StockRow = { product_id: string; branch_id: string; stock: number };

function TrasladosPage() {
  const { tenant, role } = useActiveTenant();
  const { data: isSuper } = useIsSuperadmin();
  const branchesQ = useBranches();
  const qc = useQueryClient();

  const canManage = isSuper || role === "owner" || role === "admin";

  const [fromBranch, setFromBranch] = useState<string>("");
  const [toBranch, setToBranch] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const productsQ = useQuery({
    queryKey: ["products-lite", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<ProductLite[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const stockQ = useQuery({
    queryKey: ["product-stock-all", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<StockRow[]> => {
      const { data, error } = await supabase
        .from("product_stock")
        .select("product_id, branch_id, stock")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
  });

  const activeBranches = (branchesQ.data ?? []).filter((b) => b.is_active);

  const fromStock = useMemo(() => {
    if (!productId || !fromBranch) return 0;
    const row = stockQ.data?.find(
      (r) => r.product_id === productId && r.branch_id === fromBranch,
    );
    return Number(row?.stock ?? 0);
  }, [productId, fromBranch, stockQ.data]);

  const toStock = useMemo(() => {
    if (!productId || !toBranch) return 0;
    const row = stockQ.data?.find(
      (r) => r.product_id === productId && r.branch_id === toBranch,
    );
    return Number(row?.stock ?? 0);
  }, [productId, toBranch, stockQ.data]);

  const qtyNum = Number(quantity);
  const validQty = Number.isFinite(qtyNum) && qtyNum > 0;
  const sameBranch = fromBranch && toBranch && fromBranch === toBranch;
  const enoughStock = validQty && qtyNum <= fromStock;
  const canSubmit =
    !!productId && !!fromBranch && !!toBranch && !sameBranch && enoughStock;

  const transferMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("transfer_stock", {
        _product_id: productId,
        _from_branch: fromBranch,
        _to_branch: toBranch,
        _quantity: qtyNum,
        _note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Traslado registrado correctamente");
      setQuantity("");
      setNote("");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["product-stock-all"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err) => {
      toast.error(getFriendlyErrorMessage(err));
    },
  });

  const branchName = (id: string) =>
    activeBranches.find((b) => b.id === id)?.name ?? "—";
  const productName = productsQ.data?.find((p) => p.id === productId)?.name ?? "";

  if (!canManage) {
    return (
      <DashboardShell>
        <Card>
          <CardHeader>
            <CardTitle>Sin permiso</CardTitle>
            <CardDescription>
              Solo el dueño o un administrador pueden trasladar stock.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" /> Traslados de stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Mueve inventario entre tus sucursales. El stock se descuenta del origen y se suma al destino.
          </p>
        </div>

        {activeBranches.length < 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>Necesitas al menos 2 sucursales</CardTitle>
              <CardDescription>
                Crea otra sucursal desde <span className="font-medium">Sucursales</span> para poder trasladar stock.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo traslado</CardTitle>
              <CardDescription>Elige origen, destino, producto y cantidad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Sucursal de origen</Label>
                  <Select value={fromBranch} onValueChange={setFromBranch}>
                    <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
                    <SelectContent>
                      {activeBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sucursal de destino</Label>
                  <Select value={toBranch} onValueChange={setToBranch}>
                    <SelectTrigger><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
                    <SelectContent>
                      {activeBranches
                        .filter((b) => b.id !== fromBranch)
                        .map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Producto</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder={productsQ.isLoading ? "Cargando..." : "Selecciona producto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(productsQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.sku ? ` · ${p.sku}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {productId && fromBranch && toBranch && !sameBranch && (
                <div className="grid gap-3 rounded-md border border-border/60 bg-muted/30 p-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>Stock en <b>{branchName(fromBranch)}</b>: <b>{fromStock}</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>Stock en <b>{branchName(toBranch)}</b>: <b>{toStock}</b></span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Cantidad a trasladar</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                  />
                  {validQty && !enoughStock && (
                    <p className="text-xs text-destructive">
                      Stock insuficiente en el origen.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Nota (opcional)</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ej. Reabastecimiento semanal"
                    maxLength={200}
                  />
                </div>
              </div>

              {sameBranch && (
                <p className="text-sm text-destructive">Origen y destino no pueden ser la misma sucursal.</p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSubmit || transferMut.isPending}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Trasladar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar traslado</DialogTitle>
            <DialogDescription>
              Se moverán <b>{qtyNum}</b> unidad(es) de <b>{productName}</b> desde{" "}
              <b>{branchName(fromBranch)}</b> hacia <b>{branchName(toBranch)}</b>.
              Esta acción actualiza el stock inmediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={transferMut.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => transferMut.mutate()} disabled={transferMut.isPending}>
              {transferMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar traslado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
