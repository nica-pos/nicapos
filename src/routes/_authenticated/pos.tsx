import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ArrowLeft,
  CreditCard,
  X,
  Keyboard,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProducts,
  useOpenCashSession,
  useCreateSale,
  type Product,
  type CartLine,
  type PaymentLine,
  type PaymentMethod,
} from "@/hooks/use-pos";
import { useFiscalSettings, useLatestRate, formatNIO, formatUSD } from "@/hooks/use-fiscal";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosPage,
  head: () => ({ meta: [{ title: "Punto de Venta — Nica-POS" }] }),
});

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash_nio: "Efectivo C$",
  cash_usd: "Efectivo $",
  card: "Tarjeta",
  transfer: "Transferencia",
};

function PosPage() {
  const navigate = useNavigate();
  const { data: products } = useProducts();
  const { data: session } = useOpenCashSession();
  const { data: fiscal } = useFiscalSettings();
  const rate = useLatestRate() ?? 0;
  const createSale = useCreateSale();

  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);

  const ivaRate = fiscal ? Number(fiscal.iva_rate) / 100 : 0.15;
  const ivaEnabled = fiscal ? fiscal.iva_enabled : true;

  // Predictive search results
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (products ?? [])
      .filter(
        (p) =>
          p.is_active &&
          (p.name.toLowerCase().includes(q) ||
            p.barcode?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.brand?.toLowerCase().includes(q) ||
            p.model?.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [search, products]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of cart) {
      const lineSub = l.unit_price_usd * l.quantity;
      subtotal += lineSub;
      if (ivaEnabled && !l.is_tax_exempt) tax += lineSub * ivaRate;
    }
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [cart, ivaEnabled, ivaRate]);

  const totalNio = totals.total * rate;

  function addProduct(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          quantity: 1,
          unit_price_usd: Number(p.price_usd),
          is_tax_exempt: p.is_tax_exempt,
        },
      ];
    });
    setSearch("");
    setHighlight(0);
    searchRef.current?.focus();
  }

  function updateQty(index: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      const q = next[index].quantity + delta;
      if (q <= 0) return next.filter((_, i) => i !== index);
      next[index] = { ...next[index], quantity: q };
      return next;
    });
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
    setSearch("");
    setPayments([]);
  }

  function openPayment() {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    // default: single payment covering the total in NIO
    setPayments([
      { method: "cash_nio", amount: Number(totalNio.toFixed(2)), currency: "NIO" },
    ]);
    setPayOpen(true);
  }

  // Keyboard shortcuts (SICAR-style)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        openPayment();
      } else if (e.key === "F12") {
        e.preventDefault();
        clearCart();
      } else if (e.key === "Escape" && payOpen) {
        setPayOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOpen, cart, totalNio]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[highlight];
      if (p) addProduct(p);
    }
  }

  // Payment helpers
  function paymentInUsd(p: PaymentLine): number {
    if (p.currency === "USD") return p.amount;
    return rate > 0 ? p.amount / rate : 0;
  }
  const paidUsd = payments.reduce((s, p) => s + paymentInUsd(p), 0);
  const changeUsd = paidUsd - totals.total;
  const changeNio = changeUsd * rate;
  const enoughPaid = paidUsd + 0.001 >= totals.total;

  function addPaymentLine() {
    setPayments((prev) => [
      ...prev,
      { method: "card", amount: 0, currency: "USD" },
    ]);
  }

  function updatePayment(i: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      // keep currency in sync with method for cash
      if (patch.method === "cash_nio") next[i].currency = "NIO";
      if (patch.method === "cash_usd") next[i].currency = "USD";
      return next;
    });
  }

  async function confirmSale() {
    if (!enoughPaid) {
      toast.error("El pago no cubre el total");
      return;
    }
    try {
      const res = await createSale.mutateAsync({
        sessionId: session?.id ?? null,
        lines: cart,
        payments,
        exchangeRate: rate,
        ivaRate,
        ivaEnabled,
      });
      toast.success(`Venta #${res.saleNumber} registrada`, {
        description: `Total ${formatUSD(res.total)} · Vuelto ${formatNIO(Math.max(0, changeNio))}`,
      });
      clearCart();
      setPayOpen(false);
    } catch (e) {
      toast.error("No se pudo completar la venta", {
        description: String((e as Error).message),
      });
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-1 h-4 w-4" /> Salir
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> Punto de Venta
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {rate > 0 ? (
            <Badge variant="outline">T/C C${rate.toFixed(2)}</Badge>
          ) : (
            <Badge variant="destructive">Sin tipo de cambio</Badge>
          )}
          {session ? (
            <Badge variant="secondary">Caja abierta</Badge>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/caja">Abrir caja</Link>
            </Button>
          )}
        </div>
      </header>

      {!session && (
        <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          No hay caja abierta. Puedes vender, pero se recomienda abrir caja para el arqueo.
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1fr_400px]">
        {/* Left: search + cart */}
        <div className="flex flex-col overflow-hidden border-r border-border/60">
          <div className="relative border-b border-border/60 p-4">
            <Search className="absolute left-7 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Buscar por código, nombre, categoría, marca... (F1)"
              className="h-12 pl-11 text-base"
            />
            {results.length > 0 && (
              <div className="absolute left-4 right-4 top-[68px] z-20 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {results.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left ${
                      i === highlight ? "bg-accent" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.barcode, p.category, p.brand].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatUSD(Number(p.price_usd))}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {Number(p.stock)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
                <p>Busca un producto para empezar la venta.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatUSD(l.unit_price_usd)}{" "}
                        {l.is_tax_exempt && (
                          <Badge variant="secondary" className="ml-1">Exento</Badge>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(i, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{l.quantity}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(i, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-24 text-right font-semibold">
                      {formatUSD(l.unit_price_usd * l.quantity)}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: totals + actions */}
        <div className="flex flex-col justify-between overflow-auto p-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatUSD(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                IVA ({(ivaRate * 100).toFixed(0)}%)
              </span>
              <span>{formatUSD(totals.tax)}</span>
            </div>
            <div className="border-t border-border/60 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatUSD(totals.total)}
                </span>
              </div>
              <div className="mt-1 text-right text-lg font-semibold text-muted-foreground">
                {rate > 0 ? formatNIO(totalNio) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Button
              className="h-14 w-full text-lg"
              onClick={openPayment}
              disabled={cart.length === 0}
            >
              <CreditCard className="mr-2 h-5 w-5" /> Cobrar (F4)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              <X className="mr-2 h-4 w-4" /> Cancelar venta (F12)
            </Button>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Keyboard className="h-4 w-4 shrink-0" />
              <span>
                F1 Buscar · ↑↓ Navegar · Enter Agregar · F4 Cobrar · F12 Limpiar
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cobrar — {formatUSD(totals.total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Total a pagar</span>
                <span className="font-semibold">
                  {formatUSD(totals.total)} · {formatNIO(totalNio)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Métodos de pago (pago mixto)</Label>
              {payments.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={p.method}
                    onValueChange={(v) => updatePayment(i, { method: v as PaymentMethod })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.amount || ""}
                    onChange={(e) =>
                      updatePayment(i, { amount: Number(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="w-10 text-sm text-muted-foreground">
                    {p.currency === "NIO" ? "C$" : "$"}
                  </span>
                  {payments.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setPayments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPaymentLine}>
                <Plus className="mr-1 h-4 w-4" /> Agregar método
              </Button>
            </div>

            <div className="space-y-1 rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagado</span>
                <span>{formatUSD(paidUsd)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Vuelto</span>
                <span className={changeUsd < 0 ? "text-destructive" : "text-primary"}>
                  {changeUsd >= 0
                    ? `${formatNIO(changeNio)} · ${formatUSD(changeUsd)}`
                    : `Falta ${formatUSD(-changeUsd)}`}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmSale}
              disabled={!enoughPaid || createSale.isPending}
            >
              Confirmar venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
