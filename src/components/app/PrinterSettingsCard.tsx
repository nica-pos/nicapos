import { useEffect, useState } from "react";
import { Printer, RefreshCw, DoorOpen, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  isDesktopApp,
  getPrintSettings,
  setPrintSettings,
  openCashDrawer,
  type PrintSettings,
} from "@/lib/desktop-print";

type PrinterInfo = { name: string; displayName: string; isDefault: boolean };

/**
 * Panel de configuración de impresión para el instalador de escritorio.
 * Permite elegir la impresora térmica (tickets 80mm), la impresora
 * carta (facturas), activar impresión silenciosa y probar el cajón
 * monedero. En el navegador se muestra solo un aviso informativo.
 */
export function PrinterSettingsCard() {
  const desktop = isDesktopApp();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PrintSettings>(() => getPrintSettings());

  async function refresh() {
    if (!desktop) return;
    setLoading(true);
    try {
      const list = await window.nicaposDesktop!.listPrinters();
      setPrinters(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<PrintSettings>) {
    setSettings(setPrintSettings(patch));
  }

  async function testDrawer() {
    const res = await openCashDrawer();
    if (res.ok) toast.success("Comando enviado al cajón monedero");
    else toast.error(res.error || "No se pudo abrir el cajón");
  }

  if (!desktop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> Impresión
          </CardTitle>
          <CardDescription>
            Estás en la versión web. Al facturar se abrirá el diálogo de impresión del navegador.
            Para impresión silenciosa, selector de impresora y cajón monedero, instala la app de
            escritorio Nica-POS.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" /> Impresión (escritorio)
        </CardTitle>
        <CardDescription>
          Configura qué impresora usar para tickets térmicos y para facturas tamaño carta. La
          configuración se guarda en este equipo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Impresoras detectadas</p>
            <p className="text-xs text-muted-foreground">
              {printers.length} disponible{printers.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Impresora térmica (Tickets 80mm)</Label>
            <Select
              value={settings.ticketPrinter ?? ""}
              onValueChange={(v) => update({ ticketPrinter: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Ninguna —" />
              </SelectTrigger>
              <SelectContent>
                {printers.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.displayName} {p.isDefault ? "(predeterminada)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Impresora Carta (Facturas)</Label>
            <Select
              value={settings.cartaPrinter ?? ""}
              onValueChange={(v) => update({ cartaPrinter: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Ninguna —" />
              </SelectTrigger>
              <SelectContent>
                {printers.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.displayName} {p.isDefault ? "(predeterminada)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Impresión silenciosa</p>
            <p className="text-xs text-muted-foreground">
              Imprime directo sin mostrar el diálogo del sistema.
            </p>
          </div>
          <Switch checked={settings.silent} onCheckedChange={(v) => update({ silent: v })} />
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label>Copias por impresión</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={settings.copies}
              onChange={(e) => update({ copies: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <Button variant="outline" onClick={testDrawer} className="gap-2">
            <DoorOpen className="h-4 w-4" /> Abrir cajón
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: en Windows configura el tamaño de papel de la térmica (58mm o 80mm) desde
          <em> Panel de control → Dispositivos e impresoras → Preferencias</em>.
        </p>
      </CardContent>
    </Card>
  );
}
