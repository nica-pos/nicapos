import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  ExternalLink,
  Laptop,
  CheckCircle2,
  Clock,
  History,
  User,
  Phone,
  Sparkles,
  Search,
  RotateCcw,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  Receipt,
  CreditCard,
  XCircle,
} from "lucide-react";
import { openWhatsAppWeb, formatWhatsAppPhone } from "@/lib/whatsapp";
import { isDesktopApp } from "@/lib/desktop-print";
import { useActiveTenant } from "@/hooks/use-tenant";
import { toast } from "sonner";

export interface WhatsAppMessageRecord {
  id: string;
  timestamp: number;
  customerName: string;
  phone: string;
  type: "repair_ready" | "repair_failed" | "sale_ticket" | "debt_reminder" | "custom";
  typeLabel: string;
  message: string;
}

const STORAGE_KEY = "nicapos_whatsapp_history_v1";

export function getWhatsAppHistory(): WhatsAppMessageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWhatsAppHistoryItem(item: Omit<WhatsAppMessageRecord, "id" | "timestamp">) {
  if (typeof window === "undefined") return;
  try {
    const list = getWhatsAppHistory();
    const newItem: WhatsAppMessageRecord = {
      ...item,
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    const updated = [newItem, ...list.slice(0, 99)]; // Guardar los últimos 100
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch {
    return null;
  }
}

interface WhatsAppSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone?: string;
  initialCustomerName?: string;
  initialMessage?: string;
  initialType?: WhatsAppMessageRecord["type"];
}

export function WhatsAppSidePanel({
  open,
  onOpenChange,
  initialPhone = "",
  initialCustomerName = "",
  initialMessage = "",
  initialType = "custom",
}: WhatsAppSidePanelProps) {
  const { tenant } = useActiveTenant();
  const isDesktop = isDesktopApp();

  const [activeTab, setActiveTab] = useState<"compose" | "history" | "status">("compose");
  const [phone, setPhone] = useState(initialPhone);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [message, setMessage] = useState(initialMessage);
  const [templateType, setTemplateType] = useState<WhatsAppMessageRecord["type"]>(initialType);
  const [history, setHistory] = useState<WhatsAppMessageRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Cargar historial
  const refreshHistory = () => {
    setHistory(getWhatsAppHistory());
  };

  useEffect(() => {
    if (open) {
      refreshHistory();
      if (initialPhone) setPhone(initialPhone);
      if (initialCustomerName) setCustomerName(initialCustomerName);
      if (initialMessage) setMessage(initialMessage);
      if (initialType) setTemplateType(initialType);
    }
  }, [open, initialPhone, initialCustomerName, initialMessage, initialType]);

  const storeName = tenant?.name || "Nica-POS";

  // Plantillas dinámicas inteligentes
  const applyTemplate = (type: WhatsAppMessageRecord["type"]) => {
    setTemplateType(type);
    const client = customerName.trim() || "estimado cliente";

    switch (type) {
      case "repair_ready":
        setMessage(
          `¡Hola ${client}! Le saludamos de *${storeName}*.\n\n` +
            `Le informamos con gusto que su equipo ya está *LISTO y verificado* para su entrega.\n` +
            `📱 Puede pasar a retirarlo en nuestro horario habitual con su comprobante de recepción.\n\n` +
            `¡Gracias por su preferencia!`
        );
        break;
      case "repair_failed":
        setMessage(
          `Hola ${client}, le saludamos de *${storeName}*.\n\n` +
            `Le informamos sobre la revisión técnica de su equipo: lamentablemente tras las pruebas realizadas no fue posible repararlo debido al estado del componente dañado.\n\n` +
            `Su equipo está listo para entrega en tienda sin costo adicional. Quedamos a su orden.`
        );
        break;
      case "sale_ticket":
        setMessage(
          `🧾 *Comprobante de compra — ${storeName}*\n\n` +
            `¡Hola ${client}! Gracias por su compra en nuestra tienda. Si requiere copia de su ticket o soporte sobre su producto, con gusto le atendemos.\n\n` +
            `¡Que tenga un excelente día!`
        );
        break;
      case "debt_reminder":
        setMessage(
          `Estimado/a ${client}, le saludamos cordialmente de *${storeName}*.\n\n` +
            `Le enviamos este mensaje para coordinar su estado de cuenta y saldo pendiente. Estamos a su disposición para acordar su abono o cancelación cuando guste.\n\n` +
            `¡Saludos cordiales!`
        );
        break;
      default:
        setMessage("");
    }
  };

  const handleSend = async () => {
    const clean = phone.trim();
    if (!clean) {
      toast.error("Ingresa el número telefónico del cliente");
      return;
    }
    if (!message.trim()) {
      toast.error("Escribe un mensaje para el cliente");
      return;
    }

    try {
      await openWhatsAppWeb({ phone: clean, text: message.trim() });

      // Guardar en bitácora local
      const labels: Record<WhatsAppMessageRecord["type"], string> = {
        repair_ready: "Equipo Listo",
        repair_failed: "No Reparable",
        sale_ticket: "Ticket de Venta",
        debt_reminder: "Saldo Deudor",
        custom: "Mensaje Libre",
      };

      saveWhatsAppHistoryItem({
        customerName: customerName.trim() || "Cliente sin nombre",
        phone: clean,
        type: templateType,
        typeLabel: labels[templateType] || "Mensaje",
        message: message.trim(),
      });

      refreshHistory();
      toast.success("Abriendo conversación de WhatsApp");
    } catch {
      toast.error("No se pudo abrir WhatsApp");
    }
  };

  const handleOpenDirect = async () => {
    try {
      await openWhatsAppWeb();
      toast.success("Abriendo WhatsApp Web");
    } catch {
      toast.error("Error al abrir WhatsApp");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Mensaje copiado al portapapeles");
  };

  const filteredHistory = history.filter((item) => {
    if (!searchHistory.trim()) return true;
    const term = searchHistory.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(term) ||
      item.phone.includes(term) ||
      item.typeLabel.toLowerCase().includes(term) ||
      item.message.toLowerCase().includes(term)
    );
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background/95 backdrop-blur-xl border-l border-border/80 shadow-2xl"
      >
        {/* Cabecera del Panel Lateral */}
        <div className="border-b border-border/60 bg-gradient-to-r from-emerald-500/10 via-background to-primary/10 p-5">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Panel de WhatsApp
                  {isDesktop ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      Escritorio
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Web
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Gestión y control de mensajes a clientes de {storeName}
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Navegación por Pestañas del Panel */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="mt-4"
          >
            <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/60 p-0.5 text-xs">
              <TabsTrigger value="compose" className="text-xs gap-1.5 py-1">
                <Send className="h-3.5 w-3.5" />
                Redactar
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5 py-1">
                <History className="h-3.5 w-3.5" />
                Historial ({history.length})
              </TabsTrigger>
              <TabsTrigger value="status" className="text-xs gap-1.5 py-1">
                <Laptop className="h-3.5 w-3.5" />
                Sesión
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* CONTENIDO PRINCIPAL DEL PANEL LATERAL */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: REDACTAR Y ENVIAR */}
          {activeTab === "compose" && (
            <div className="space-y-4">
              {/* Plantillas Rápidas con un clic */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    Plantillas de Mensaje:
                  </Label>
                  {templateType !== "custom" && (
                    <button
                      type="button"
                      onClick={() => applyTemplate("custom")}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Limpiar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    variant={templateType === "repair_ready" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyTemplate("repair_ready")}
                    className={`h-8 text-[11px] justify-start font-medium truncate ${
                      templateType === "repair_ready"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "border-border/60 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5 mr-1.5 shrink-0 text-emerald-500" />
                    Equipo Listo
                  </Button>

                  <Button
                    type="button"
                    variant={templateType === "repair_failed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyTemplate("repair_failed")}
                    className={`h-8 text-[11px] justify-start font-medium truncate ${
                      templateType === "repair_failed"
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "border-border/60 hover:border-rose-500/50 hover:bg-rose-500/5"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5 shrink-0 text-rose-500" />
                    No Reparable
                  </Button>

                  <Button
                    type="button"
                    variant={templateType === "sale_ticket" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyTemplate("sale_ticket")}
                    className={`h-8 text-[11px] justify-start font-medium truncate ${
                      templateType === "sale_ticket"
                        ? "bg-primary text-primary-foreground"
                        : "border-border/60 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary" />
                    Ticket de Venta
                  </Button>

                  <Button
                    type="button"
                    variant={templateType === "debt_reminder" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyTemplate("debt_reminder")}
                    className={`h-8 text-[11px] justify-start font-medium truncate ${
                      templateType === "debt_reminder"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "border-border/60 hover:border-amber-500/50 hover:bg-amber-500/5"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1.5 shrink-0 text-amber-500" />
                    Recordar Saldo
                  </Button>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="wa-client-name" className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Nombre del cliente
                  </Label>
                  <Input
                    id="wa-client-name"
                    placeholder="Ej. Carlos Martínez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wa-client-phone" className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Teléfono WhatsApp *
                  </Label>
                  <Input
                    id="wa-client-phone"
                    placeholder="8888-1234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Mensaje */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wa-custom-msg" className="text-xs font-semibold text-foreground">
                    Mensaje a enviar:
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {message.length} caracteres
                  </span>
                </div>
                <Textarea
                  id="wa-custom-msg"
                  rows={6}
                  placeholder="Escribe el mensaje o selecciona una plantilla arriba..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-xs leading-relaxed resize-none"
                />
              </div>

              {/* Vista Previa de Burbuja de WhatsApp */}
              {message && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Vista previa en WhatsApp:
                    </span>
                    <span className="text-[10px] opacity-75">Ahora</span>
                  </div>
                  <div className="rounded-lg bg-emerald-950/20 dark:bg-emerald-950/40 p-2.5 text-xs text-foreground/90 whitespace-pre-wrap font-sans border border-emerald-500/15">
                    {message}
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleSend}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 shadow-md shadow-emerald-600/20"
                >
                  <Send className="h-4 w-4" />
                  Enviar por WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenDirect}
                  className="h-10 text-xs px-3 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  title="Abrir WhatsApp Web completo"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORIAL Y CONTROL DE MENSAJES */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, teléfono o tipo..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {filteredHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <History className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">Sin mensajes registrados</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    Los mensajes y comprobantes que envíes a clientes quedarán guardados aquí automáticamente.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[460px] pr-2">
                  <div className="space-y-2.5">
                    {filteredHistory.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/70 bg-card p-3 space-y-2 hover:border-emerald-500/30 transition-colors text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">
                              {item.customerName}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                              {item.typeLabel}
                            </Badge>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-muted-foreground">
                          Tel: {item.phone}
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded border border-border/40 whitespace-pre-wrap">
                          {item.message}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.message, item.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copiar texto
                              </>
                            )}
                          </button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPhone(item.phone);
                              setCustomerName(item.customerName);
                              setMessage(item.message);
                              setTemplateType(item.type);
                              setActiveTab("compose");
                            }}
                            className="h-6 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                          >
                            Reenviar / Editar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* TAB 3: ESTADO DE SESIÓN Y VINCULACIÓN */}
          {activeTab === "status" && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  {isDesktop ? (
                    <Laptop className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>
                    {isDesktop
                      ? "Sesión de Escritorio Permanente"
                      : "Modo Ventana Auxiliar"}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  {isDesktop
                    ? "En la aplicación instalable, la sesión de WhatsApp Web se guarda en una ventana independiente permanente. No te pedirá el código QR cada vez que cierres la app."
                    : "En el navegador, los mensajes se abren directamente en una ventana optimizada con WhatsApp Web listo para chatear."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenDirect}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 mt-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir WhatsApp Web
                </Button>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <p className="font-semibold text-foreground">Cómo vincular tu WhatsApp:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground text-[11px]">
                  <li>Haz clic en <strong>«Abrir WhatsApp Web»</strong>.</li>
                  <li>En tu teléfono abre WhatsApp y toca <strong>Ajustes → Dispositivos vinculados</strong>.</li>
                  <li>Escanea el código QR que aparecerá en pantalla.</li>
                  <li>¡Listo! Tu tienda {storeName} quedará conectada para notificar clientes.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
