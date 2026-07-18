import { getFriendlyErrorMessage } from "@/lib/errors";
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
  Loader2,
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
  useVoidSale,
  type Product,
  type CartLine,
  type PaymentLine,
  type PaymentMethod,
} from "@/hooks/use-pos";
import { useFiscalSettings, useLatestRate, formatNIO, formatUSD } from "@/hooks/use-fiscal";
import { useActiveTenant } from "@/hooks/use-tenant";
import { usePromotions, applyPromotions } from "@/hooks/use-inventory";
import { useCustomers, useCreateReceivable } from "@/hooks/use-credit";
import { useProductImage } from "@/hooks/use-product-image";
import { Package } from "lucide-react";

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
  const { data: promotions } = usePromotions();
  const { data: session } = useOpenCashSession();
  const { data: fiscal } = useFiscalSettings();
  const { tenant, role } = useActiveTenant();
  const rate = useLatestRate() ?? 0;
  const createSale = useCreateSale();
  const { data: customers } = useCustomers();
  const createReceivable = useCreateReceivable();

  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("__all__");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [docFormat, setDocFormat] = useState<"ticket" | "carta">("ticket");
  const [customerId, setCustomerId] = useState<string>("__general__");
  const [isCredit, setIsCredit] = useState(false);
  const [lastSale, setLastSale] = useState<{
    saleId: string;
    saleNumber: number;
    lines: CartLine[];
    payments: PaymentLine[];
    subtotal: number;
    tax: number;
    total: number;
    rate: number;
    changeUsd: number;
    changeNio: number;
    createdAt: Date;
    docFormat: "ticket" | "carta";
    isCredit: boolean;
    customerName: string | null;
  } | null>(null);


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

  // Categories present in active products (for the chip bar)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products ?? []) {
      if (!p.is_active) continue;
      const c = (p.category ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Products in the currently selected category (quick-add grid)
  const categoryProducts = useMemo(() => {
    const list = (products ?? []).filter((p) => p.is_active);
    if (activeCategory === "__all__") return list.slice(0, 60);
    if (activeCategory === "__uncat__")
      return list.filter((p) => !(p.category ?? "").trim());
    return list.filter((p) => (p.category ?? "").trim() === activeCategory);
  }, [products, activeCategory]);

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

  const effectiveRate = rateOverride ?? rate;
  const totalNio = totals.total * effectiveRate;


  function addProduct(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      const { price, promo } = applyPromotions(
        Number(p.price_usd),
        { id: p.id, category_id: p.category_id },
        promotions ?? [],
      );
      return [
        ...prev,
        {
          product_id: p.id,
          name: promo ? `${p.name} (${promo.name})` : p.name,
          quantity: 1,
          unit_price_usd: price,
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
    // Determinar moneda nativa dominante del carrito
    const productsById = new Map((products ?? []).map((p) => [p.id, p]));
    let usdWeight = 0;
    let nioWeight = 0;
    for (const l of cart) {
      const prod = l.product_id ? productsById.get(l.product_id) : null;
      const cur = (prod as any)?.price_currency === "NIO" ? "NIO" : "USD";
      const w = l.unit_price_usd * l.quantity;
      if (cur === "NIO") nioWeight += w;
      else usdWeight += w;
    }
    const preferUsd = usdWeight >= nioWeight;
    if (preferUsd) {
      setPayments([
        { method: "cash_usd", amount: Number(totals.total.toFixed(2)), currency: "USD" },
      ]);
    } else {
      setPayments([
        { method: "cash_nio", amount: Number(totalNio.toFixed(2)), currency: "NIO" },
      ]);
    }
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
    return effectiveRate > 0 ? p.amount / effectiveRate : 0;
  }
  const paidUsd = payments.reduce((s, p) => s + paymentInUsd(p), 0);
  const paidNioRaw = payments.reduce((s, p) => s + (p.currency === "NIO" ? p.amount : 0), 0);
  const paidUsdRaw = payments.reduce((s, p) => s + (p.currency === "USD" ? p.amount : 0), 0);
  const changeUsd = paidUsd - totals.total;
  const changeNio = changeUsd * effectiveRate;
  const hasNioPayment = paidNioRaw > 0;
  const hasUsdPayment = paidUsdRaw > 0;
  // Preferred currency to show the "vuelto" in = what the customer actually handed over
  const changePreferNio = hasNioPayment && !hasUsdPayment;
  const changePreferUsd = hasUsdPayment && !hasNioPayment;
  const enoughPaid = isCredit || paidUsd + 0.001 >= totals.total;

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );
  const creditLimit = selectedCustomer ? Number(selectedCustomer.credit_limit_usd ?? 0) : 0;
  const creditAvailable = !!selectedCustomer;


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
    if (isCredit) {
      if (!selectedCustomer) {
        toast.error("Seleccioná un cliente para vender a crédito");
        return;
      }
      if (creditLimit > 0 && totals.total > creditLimit + 0.001) {
        toast.error(
          `El total (${formatUSD(totals.total)}) supera el límite de crédito del cliente (${formatUSD(creditLimit)})`,
        );
        return;
      }
    } else if (!enoughPaid) {
      toast.error("El pago no cubre el total");
      return;
    }
    try {
      const snapLines = cart;
      const snapPayments = isCredit ? [] : payments;
      const snapTotals = totals;
      const snapChangeUsd = isCredit ? 0 : changeUsd;
      const snapChangeNio = isCredit ? 0 : changeNio;
      const res = await createSale.mutateAsync({
        sessionId: session?.id ?? null,
        lines: snapLines,
        payments: snapPayments,
        exchangeRate: effectiveRate,
        ivaRate,
        ivaEnabled,
      });
      if (isCredit && selectedCustomer) {
        try {
          await createReceivable.mutateAsync({
            customer_id: selectedCustomer.id,
            total_usd: Number(snapTotals.total.toFixed(2)),
            description: `Venta #${res.saleNumber} a crédito`,
          });
        } catch (e) {
          toast.error("Venta registrada pero no se pudo crear la cuenta por cobrar", {
            description: getFriendlyErrorMessage(e),
          });
        }
      }
      toast.success(
        isCredit
          ? `Venta #${res.saleNumber} a crédito registrada`
          : `Venta #${res.saleNumber} registrada`,
      );
      setLastSale({
        saleId: res.sale.id,
        saleNumber: res.saleNumber,
        lines: snapLines,
        payments: snapPayments,
        subtotal: snapTotals.subtotal,
        tax: snapTotals.tax,
        total: snapTotals.total,
        rate: effectiveRate,
        changeUsd: Math.max(0, snapChangeUsd),
        changeNio: Math.max(0, snapChangeNio),
        createdAt: new Date(),
        docFormat,
        isCredit,
        customerName: selectedCustomer?.name ?? null,
      });
      clearCart();
      setRateOverride(null);
      setCustomerId("__general__");
      setIsCredit(false);
      setPayOpen(false);

    } catch (e) {
      toast.error("No se pudo completar la venta", {
        description: getFriendlyErrorMessage(e),
      });
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to={role === "cashier" ? "/cajero" : "/dashboard"}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Salir
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> Punto de Venta
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {effectiveRate > 0 ? (
            <Badge variant={rateOverride != null ? "default" : "outline"}>
              T/C C${effectiveRate.toFixed(2)}
              {rateOverride != null && " *"}
            </Badge>
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
        {/* Left: search + product catalog */}
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
                    {(() => {
                      const { price, promo } = applyPromotions(
                        Number(p.price_usd),
                        { id: p.id, category_id: p.category_id },
                        promotions ?? [],
                      );
                      return (
                        <div className="text-right">
                          {promo ? (
                            <p className="font-semibold text-primary">
                              {formatUSD(price)}{" "}
                              <span className="text-xs text-muted-foreground line-through">
                                {formatUSD(Number(p.price_usd))}
                              </span>
                            </p>
                          ) : (
                            <p className="font-semibold">
                              {formatUSD(Number(p.price_usd))}
                            </p>
                          )}
                          {rate > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {formatNIO(price * rate)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Stock: {Number(p.stock)}
                          </p>
                        </div>
                      );
                    })()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category chips (quick filters) */}
          {!search && (categories.length > 0 || (products?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-2">
              <button
                type="button"
                onClick={() => setActiveCategory("__all__")}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activeCategory === "__all__"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                Todo
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activeCategory === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActiveCategory("__uncat__")}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activeCategory === "__uncat__"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                Sin categoría
              </button>
            </div>
          )}

          {/* Quick-add grid by category (hidden while typing a search) */}
          {!search && categoryProducts.length > 0 && (
            <div className="flex-1 overflow-auto p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {categoryProducts.map((p) => {
                  const { price, promo } = applyPromotions(
                    Number(p.price_usd),
                    { id: p.id, category_id: p.category_id },
                    promotions ?? [],
                  );
                  return (
                    <ProductGridCard
                      key={p.id}
                      product={p}
                      price={price}
                      promo={!!promo}
                      onAdd={() => addProduct(p)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: totals + actions */}
        <div className="flex flex-col justify-between overflow-auto p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Venta actual</h2>
                <Badge variant="secondary">{cart.length} ítem{cart.length === 1 ? "" : "s"}</Badge>
              </div>
              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  Seleccioná productos del catálogo.
                </div>
              ) : (
                <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
                  {cart.map((l, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{l.name}</p>
                          {l.is_tax_exempt && (
                            <Badge variant="secondary" className="mt-1">Exento</Badge>
                          )}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(i, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{l.quantity}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(i, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">P.U. $</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.unit_price_usd}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setCart((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], unit_price_usd: isNaN(v) ? 0 : v };
                                return next;
                              });
                            }}
                            className="h-8 w-20 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-right font-semibold">
                        {formatUSD(l.unit_price_usd * l.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                {effectiveRate > 0 ? formatNIO(totalNio) : "—"}
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
            <DialogTitle className="sr-only">Cobrar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total a cobrar
              </div>
              <div className="mt-1 text-3xl font-bold">
                {formatUSD(totals.total)} <span className="text-base font-medium text-muted-foreground">USD</span>
              </div>
              <div className="text-lg font-semibold text-muted-foreground">
                {formatNIO(totalNio)} <span className="text-sm font-medium">NIO</span>
              </div>
            </div>

            {/* Cliente + crédito */}
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v);
                    if (v === "__general__") {
                      setIsCredit(false);
                    } else {
                      const c = (customers ?? []).find((x) => x.id === v);
                      // Auto-marca como crédito si el cliente tiene límite configurado
                      if (c && Number(c.credit_limit_usd ?? 0) > 0) {
                        setIsCredit(true);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__general__">Público en general</SelectItem>
                    {(customers ?? [])
                      .filter((c) => c.is_active !== false)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {Number(c.credit_limit_usd ?? 0) > 0
                            ? ` — crédito ${formatUSD(Number(c.credit_limit_usd))}`
                            : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant={isCredit ? "default" : "outline"}
                size="sm"
                disabled={!creditAvailable}
                onClick={() => setIsCredit((v) => !v)}
                title={
                  !selectedCustomer
                    ? "Seleccioná un cliente para vender a crédito"
                    : "Marcar como venta a crédito"
                }
              >
                <CreditCard className="mr-1 h-4 w-4" />
                {isCredit ? "A crédito" : "Vender a crédito"}
              </Button>
            </div>
            {isCredit && selectedCustomer && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
                Esta venta se registrará como <strong>cuenta por cobrar</strong> a{" "}
                <strong>{selectedCustomer.name}</strong>.{" "}
                {creditLimit > 0
                  ? <>Límite de crédito: <strong>{formatUSD(creditLimit)}</strong>.</>
                  : <>Este cliente no tiene límite de crédito configurado.</>}
              </div>
            )}

            {effectiveRate <= 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  No hay tipo de cambio. Ingresá uno abajo para ver la conversión a córdobas.
                </span>
              </div>
            )}


            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de cambio (opcional)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">C$/US$</span>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder={rate > 0 ? rate.toFixed(4) : "0"}
                    value={rateOverride ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        setRateOverride(null);
                      } else {
                        const n = Number(v);
                        setRateOverride(isNaN(n) ? null : n);
                      }
                      // recompute default NIO payment amount
                      const newRate = e.target.value === "" ? rate : Number(e.target.value);
                      if (payments.length === 1 && payments[0].currency === "NIO") {
                        setPayments([
                          {
                            method: "cash_nio",
                            amount: Number((totals.total * (newRate || 0)).toFixed(2)),
                            currency: "NIO",
                          },
                        ]);
                      }
                    }}
                    className="h-9"
                  />
                  {rateOverride != null && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRateOverride(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de comprobante</Label>
                <Select
                  value={docFormat}
                  onValueChange={(v) => setDocFormat(v as "ticket" | "carta")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ticket">Ticket (80mm)</SelectItem>
                    <SelectItem value="carta">Factura carta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


            {!isCredit && (
            <>
            <div className="space-y-2">
              <Label>Métodos de pago (pago mixto)</Label>
              {payments.map((p, i) => {
                const equivUsd = p.currency === "NIO"
                  ? (effectiveRate > 0 ? p.amount / effectiveRate : 0)
                  : p.amount;
                const equivNio = p.currency === "USD"
                  ? p.amount * effectiveRate
                  : p.amount;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
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
                      {p.method === "card" || p.method === "transfer" ? (
                        <Select
                          value={p.currency}
                          onValueChange={(v) =>
                            updatePayment(i, { currency: v as "NIO" | "USD" })
                          }
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">$</SelectItem>
                            <SelectItem value="NIO">C$</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="w-10 text-sm text-muted-foreground">
                          {p.currency === "NIO" ? "C$" : "$"}
                        </span>
                      )}
                      <Input
                        type="number"
                        step="0.01"
                        value={p.amount || ""}
                        onChange={(e) =>
                          updatePayment(i, { amount: Number(e.target.value) })
                        }
                        className="flex-1"
                      />
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
                    {effectiveRate > 0 ? (
                      <div className="pl-40 text-xs text-muted-foreground">
                        {p.currency === "NIO" ? (
                          <>Equivale a <span className="font-semibold">{formatUSD(equivUsd)}</span></>
                        ) : (
                          <>Equivale a <span className="font-semibold">{formatNIO(equivNio)}</span></>
                        )}
                      </div>
                    ) : (
                      <div className="pl-40 text-xs text-destructive">
                        Sin tipo de cambio — no se puede convertir
                      </div>
                    )}

                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={addPaymentLine}>
                <Plus className="mr-1 h-4 w-4" /> Agregar método
              </Button>
            </div>

            <div className="space-y-1 rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagado</span>
                <span>
                  {changePreferNio
                    ? formatNIO(paidNioRaw)
                    : changePreferUsd
                      ? formatUSD(paidUsdRaw)
                      : `${formatNIO(paidNioRaw)} · ${formatUSD(paidUsdRaw)}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Vuelto</span>
                <span className={changeUsd < 0 ? "text-destructive" : "text-primary"}>
                  {changeUsd < 0
                    ? `Falta ${formatUSD(-changeUsd)}`
                    : changePreferNio
                      ? formatNIO(changeNio)
                      : changePreferUsd
                        ? formatUSD(changeUsd)
                        : `${formatNIO(changeNio)} · ${formatUSD(changeUsd)}`}
                </span>
              </div>
            </div>
            </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmSale}
              disabled={!enoughPaid || createSale.isPending || createReceivable.isPending}
            >
              {isCredit ? "Registrar venta a crédito" : "Confirmar venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        sale={lastSale}
        onClose={() => setLastSale(null)}
        tenantName={tenant?.name ?? ""}
        tenantRuc={tenant?.ruc ?? null}
        logoUrl={(fiscal as any)?.show_logo ?? true ? tenant?.logo_url ?? null : null}
        primaryColor={tenant?.primary_color ?? "#f59e0b"}
        settings={fiscal}
      />
    </div>
  );
}

function ReceiptDialog({
  sale,
  onClose,
  tenantName,
  tenantRuc,
  logoUrl,
  primaryColor,
  settings,
}: {
  sale: {
    saleId: string;
    saleNumber: number;
    lines: CartLine[];
    payments: PaymentLine[];
    subtotal: number;
    tax: number;
    total: number;
    rate: number;
    changeUsd: number;
    changeNio: number;
    createdAt: Date;
    docFormat: "ticket" | "carta";
    isCredit: boolean;
    customerName: string | null;
  } | null;

  onClose: () => void;
  tenantName: string;
  tenantRuc: string | null;
  logoUrl: string | null;
  primaryColor: string;
  settings: any;
}) {
  const voidSale = useVoidSale();
  async function handleVoid() {
    if (!sale) return;
    const reason = window.prompt(
      "¿Anular esta venta?\n\nSe devolverá el stock al inventario y (si era a crédito) se eliminará la cuenta por cobrar.\n\nMotivo (opcional):",
      "",
    );
    if (reason === null) return; // cancelado
    try {
      await voidSale.mutateAsync({ saleId: sale.saleId, reason: reason || undefined });
      toast.success(`Venta #${sale.saleNumber} anulada`);
      onClose();
    } catch (e) {
      toast.error("No se pudo anular la venta", {
        description: getFriendlyErrorMessage(e),
      });
    }
  }
  const s = settings ?? {};
  const legalName = s.legal_name || tenantName;
  const prefix = s.ticket_prefix ?? "TKT-";
  const nextNum = s.next_ticket_number ?? sale?.saleNumber ?? 1;
  const docNumber = `${prefix}${String(nextNum).padStart(6, "0")}`;
  const thankYou = s.thank_you_message || "¡Gracias por su compra!";
  const ticketHeader = s.ticket_header || "";

  function doPrint() {
    window.print();
  }

  const isCarta = sale?.docFormat === "carta";

  return (
    <Dialog open={!!sale} onOpenChange={(v) => !v && onClose()}>

      <DialogContent className={isCarta ? "max-w-3xl" : "max-w-md"}>
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #pos-receipt, #pos-receipt * { visibility: visible !important; }
            #pos-receipt { position: absolute; left: 0; top: 0; ${isCarta ? "width: 100%;" : "width: 80mm;"} }
            .no-print { display: none !important; }
            @page { size: ${isCarta ? "letter" : "auto"}; margin: ${isCarta ? "12mm" : "4mm"}; }
          }
        `}</style>
        <DialogHeader>
          <DialogTitle className="no-print">
            Venta #{sale?.saleNumber} — {isCarta ? "factura" : "ticket"} listo
          </DialogTitle>
        </DialogHeader>
        {sale && !isCarta && (
          <div
            id="pos-receipt"
            className="mx-auto max-h-[60vh] w-full max-w-[320px] overflow-auto rounded border bg-white p-3 font-mono text-[12px] text-black"
          >
            <div className="text-center">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="mx-auto mb-1 max-h-16 object-contain"
                />
              )}
              <div className="text-sm font-bold uppercase" style={{ color: primaryColor }}>
                {legalName}
              </div>
              {tenantRuc && <div>RUC: {tenantRuc}</div>}
              {s.address && <div>{s.address}</div>}
              {s.phone && <div>Tel: {s.phone}</div>}
              {ticketHeader && <div className="whitespace-pre-line">{ticketHeader}</div>}
              <div>{sale.createdAt.toLocaleString("es-NI")}</div>
              <div className="font-semibold">N° {docNumber}</div>
              <div>Venta interna #{sale.saleNumber}</div>
              <div
                className={`mx-auto mt-2 inline-block rounded border-2 px-3 py-1 text-sm font-black uppercase tracking-wider ${
                  sale.isCredit ? "border-black" : "border-black"
                }`}
              >
                {sale.isCredit ? "VENTA A CRÉDITO" : "VENTA DE CONTADO"}
              </div>
              {sale.customerName && (
                <div className="mt-1 text-[11px]">Cliente: {sale.customerName}</div>
              )}
            </div>
            {(() => {
              const hasNio = sale.payments.some((pp) => pp.currency === "NIO");
              const hasUsd = sale.payments.some((pp) => pp.currency === "USD");
              const onlyNio = hasNio && !hasUsd;
              const onlyUsd = hasUsd && !hasNio;
              const displayMode = (sale.isCredit
                ? "BOTH"
                : onlyNio && sale.rate > 0
                  ? "NIO"
                  : onlyUsd
                    ? "USD"
                    : "BOTH") as "USD" | "NIO" | "BOTH";
              const fmtLine = (usd: number) => {
                if (displayMode === "USD") return formatUSD(usd);
                if (displayMode === "NIO") return formatNIO(usd * sale.rate);
                return formatUSD(usd);
              };
              const showAlt = displayMode === "BOTH" && sale.rate > 0;
              return (
                <>
                  <div className="my-1 border-t border-dashed border-black" />
                  {sale.lines.map((l, i) => (
                    <div key={i}>
                      <div className="flex justify-between">
                        <span className="pr-2">{l.quantity} x {l.name}</span>
                        <span>{fmtLine(l.unit_price_usd * l.quantity)}</span>
                      </div>
                      {showAlt && (
                        <div className="text-right opacity-70">
                          {formatNIO(l.unit_price_usd * l.quantity * sale.rate)}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="my-1 border-t border-dashed border-black" />
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{fmtLine(sale.subtotal)}</span>
                  </div>
                  {sale.tax > 0 && (
                    <div className="flex justify-between">
                      <span>IVA</span>
                      <span>{fmtLine(sale.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>{fmtLine(sale.total)}</span>
                  </div>
                  {showAlt && (
                    <div className="flex justify-between font-bold">
                      <span>TOTAL C$</span>
                      <span>{formatNIO(sale.total * sale.rate)}</span>
                    </div>
                  )}
                  <div className="my-1 border-t border-dashed border-black" />
                  {sale.isCredit ? (
                    <div className="text-center font-bold">
                      *** PENDIENTE DE PAGO — CRÉDITO ***
                      <div className="text-[11px] font-normal">
                        Saldo: {formatUSD(sale.total)}
                        {sale.rate > 0 && ` · ${formatNIO(sale.total * sale.rate)}`}
                      </div>
                    </div>
                  ) : (
                    <>
                      {sale.payments.map((p, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{PAYMENT_LABELS[p.method]}</span>
                          <span>
                            {p.currency === "USD" ? formatUSD(p.amount) : formatNIO(p.amount)}
                          </span>
                        </div>
                      ))}
                      {sale.changeUsd > 0 && (
                        <div className="flex justify-between font-semibold">
                          <span>Vuelto</span>
                          <span>
                            {displayMode === "NIO"
                              ? formatNIO(sale.changeNio)
                              : displayMode === "USD"
                                ? formatUSD(sale.changeUsd)
                                : sale.rate > 0
                                  ? `${formatUSD(sale.changeUsd)} · ${formatNIO(sale.changeNio)}`
                                  : formatUSD(sale.changeUsd)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
            {sale.rate > 0 && (
              <div className="mt-1 text-center">
                Tasa: C$ {sale.rate.toFixed(4)} / US$1
              </div>
            )}
            <div className="mt-2 whitespace-pre-line text-center">{thankYou}</div>
          </div>
        )}

        {sale && isCarta && (
          <div
            id="pos-receipt"
            className="mx-auto max-h-[70vh] w-full overflow-auto rounded border bg-white p-8 text-[13px] text-black"
          >
            <div className="flex items-start justify-between border-b border-black/20 pb-4">
              <div className="flex items-center gap-3">
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="max-h-20 object-contain" />
                )}
                <div>
                  <div className="text-xl font-bold uppercase" style={{ color: primaryColor }}>
                    {legalName}
                  </div>
                  {tenantRuc && <div className="text-xs">RUC: {tenantRuc}</div>}
                  {s.address && <div className="text-xs">{s.address}</div>}
                  {s.phone && <div className="text-xs">Tel: {s.phone}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  FACTURA {sale.isCredit ? "DE CRÉDITO" : "DE CONTADO"}
                </div>
                <div className="text-sm">N° {docNumber}</div>
                <div className="text-xs">{sale.createdAt.toLocaleString("es-NI")}</div>
                <div className="text-xs">Venta interna #{sale.saleNumber}</div>
                <div className="mt-1 text-xs font-semibold">
                  Condición: {sale.isCredit ? "CRÉDITO" : "CONTADO"}
                </div>
                {sale.customerName && (
                  <div className="text-xs">Cliente: {sale.customerName}</div>
                )}
              </div>
            </div>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-black/30 text-left">
                  <th className="py-2">Cant.</th>
                  <th className="py-2">Descripción</th>
                  <th className="py-2 text-right">P. Unit.</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l, i) => (
                  <tr key={i} className="border-b border-black/10">
                    <td className="py-2">{l.quantity}</td>
                    <td className="py-2">{l.name}</td>
                    <td className="py-2 text-right">{formatUSD(l.unit_price_usd)}</td>
                    <td className="py-2 text-right">
                      {formatUSD(l.unit_price_usd * l.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatUSD(sale.subtotal)}</span>
                </div>
                {sale.tax > 0 && (
                  <div className="flex justify-between">
                    <span>IVA</span>
                    <span>{formatUSD(sale.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-black/30 pt-1 text-base font-bold">
                  <span>TOTAL</span>
                  <span>{formatUSD(sale.total)}</span>
                </div>
                {sale.rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>TOTAL C$</span>
                    <span>{formatNIO(sale.total * sale.rate)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-black/20 pt-2 text-xs">
              {sale.isCredit ? (
                <div className="rounded border border-black/40 p-2 text-center font-bold">
                  PENDIENTE DE PAGO — VENTA A CRÉDITO
                  <div className="text-[11px] font-normal">
                    Saldo por cobrar: {formatUSD(sale.total)}
                    {sale.rate > 0 && ` · ${formatNIO(sale.total * sale.rate)}`}
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-semibold">Pagos:</div>
                  {sale.payments.map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{PAYMENT_LABELS[p.method]}</span>
                      <span>
                        {p.currency === "USD" ? formatUSD(p.amount) : formatNIO(p.amount)}
                      </span>
                    </div>
                  ))}
                  {sale.changeUsd > 0 && (() => {
                    const hasNio = sale.payments.some((pp) => pp.currency === "NIO");
                    const hasUsd = sale.payments.some((pp) => pp.currency === "USD");
                    const showNioFirst = sale.rate > 0 && (hasNio || !hasUsd);
                    return (
                      <div className="flex justify-between font-semibold">
                        <span>Vuelto</span>
                        <span>
                          {sale.rate > 0
                            ? showNioFirst
                              ? `${formatNIO(sale.changeNio)} · ${formatUSD(sale.changeUsd)}`
                              : `${formatUSD(sale.changeUsd)} · ${formatNIO(sale.changeNio)}`
                            : formatUSD(sale.changeUsd)}
                        </span>
                      </div>
                    );
                  })()}
                </>
              )}
              {sale.rate > 0 && (
                <div className="mt-1">Tasa de cambio: C$ {sale.rate.toFixed(4)} / US$1</div>
              )}
            </div>

            <div className="mt-6 whitespace-pre-line text-center text-sm italic">
              {thankYou}
            </div>
          </div>
        )}

        <DialogFooter className="no-print gap-2 sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleVoid}
            disabled={voidSale.isPending}
          >
            {voidSale.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            Anular venta
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={doPrint}>
              <CreditCard className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductGridCard({
  product,
  price,
  promo,
  onAdd,
}: {
  product: Product;
  price: number;
  promo: boolean;
  onAdd: () => void;
}) {
  const imgPath = (product as any).image_url as string | null | undefined;
  const { data: url } = useProductImage(imgPath);
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex flex-col items-stretch overflow-hidden rounded-lg border border-border/60 bg-card text-left transition hover:border-primary hover:shadow-sm"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted/40">
        {url ? (
          <img
            src={url}
            alt={product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex flex-col p-2">
        <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          Stock: {Number(product.stock)}
        </span>
        <span className="mt-1 text-sm font-semibold text-primary">
          {formatUSD(price)}
          {promo && (
            <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">
              {formatUSD(Number(product.price_usd))}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}


