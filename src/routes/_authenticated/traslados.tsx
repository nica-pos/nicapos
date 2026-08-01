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
import { ArrowRightLeft, Check, Loader2, Package, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";
import { useBranches } from "@/hooks/use-branch";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/traslados")({
  component: TrasladosPage,
});

type ProductLite = { id: string; name: string; sku: string | null };
type StockRow = { product_id: string; branch_id: string; stock: number };
type TransferRow = {
  id: string;
  product_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  note: string | null;
  status: "in_transit" | "received" | "cancelled";
  created_at: string;
  received_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

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

  const transfersQ = useQuery({
    queryKey: ["stock-transfers", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<TransferRow[]> => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select(
          "id, product_id, from_branch_id, to_branch_id, quantity, note, status, created_at, received_at, cancelled_at, cancel_reason",
        )
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as TransferRow[];
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    qc.invalidateQueries({ queryKey: ["product-stock-all"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  const transferMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_stock_transfer", {
        _product_id: productId,
        _from_branch: fromBranch,
        _to_branch: toBranch,
        _quantity: qtyNum,
        _note: note.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Traslado enviado. Queda en tránsito hasta que destino confirme.");
      setQuantity("");
      setNote("");
      setConfirmOpen(false);
      refreshAll();
    },
    onError: (err) => {
      toast.error(getFriendlyErrorMessage(err));
    },
  });

  const receiveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("receive_stock_transfer", { _transfer_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recepción confirmada. Stock sumado al destino.");
      refreshAll();
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err)),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_stock_transfer", {
        _transfer_id: id,
        _reason: "Cancelado por el usuario",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Traslado cancelado. Stock devuelto al origen.");
      refreshAll();
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err)),
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

        <Card>
          <CardHeader>
            <CardTitle>Historial de traslados</CardTitle>
            <CardDescription>
              Los traslados quedan “en tránsito” hasta que alguien de la sucursal de destino confirme la recepción.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transfersQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : (transfersQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay traslados registrados.</p>
            ) : (
              (transfersQ.data ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 rounded-md border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium">
                      {productsQ.data?.find((p) => p.id === t.product_id)?.name ?? "Producto"} ·{" "}
                      {Number(t.quantity)} u.
                    </div>
                    <div className="text-muted-foreground">
                      {branchName(t.from_branch_id)} → {branchName(t.to_branch_id)} ·{" "}
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                    {t.note && <div className="text-xs text-muted-foreground">{t.note}</div>}
                    {t.status === "cancelled" && t.cancel_reason && (
                      <div className="text-xs text-destructive">{t.cancel_reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        t.status === "received"
                          ? "default"
                          : t.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {t.status === "received"
                        ? "Recibido"
                        : t.status === "cancelled"
                          ? "Cancelado"
                          : "En tránsito"}
                    </Badge>
                    {t.status === "in_transit" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => receiveMut.mutate(t.id)}
                          disabled={receiveMut.isPending || cancelMut.isPending}
                        >
                          <Check className="mr-1 h-4 w-4" /> Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelMut.mutate(t.id)}
                          disabled={receiveMut.isPending || cancelMut.isPending}
                        >
                          <X className="mr-1 h-4 w-4" /> Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
