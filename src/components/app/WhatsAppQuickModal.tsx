import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { openWhatsAppWeb } from "@/lib/whatsapp";
import { isDesktopApp } from "@/lib/desktop-print";
import { MessageSquare, ExternalLink, Send, ShieldCheck, Laptop } from "lucide-react";
import { toast } from "sonner";

type TemplateKey = "custom" | "greeting" | "repair_ready" | "debt_reminder";

const templates: Record<TemplateKey, { label: string; text: string }> = {
  custom: {
    label: "Mensaje libre",
    text: "",
  },
  greeting: {
    label: "Saludo de bienvenida",
    text: "¡Hola! Gracias por visitarnos. Si tienes alguna duda sobre nuestros productos o servicios, con gusto te atendemos.",
  },
  repair_ready: {
    label: "Reparación lista para retirar",
    text: "Hola, te informamos que tu equipo ya está listo y verificado. Puedes pasar a retirarlo a nuestra tienda en nuestro horario habitual.",
  },
  debt_reminder: {
    label: "Recordatorio de saldo pendiente",
    text: "Estimado cliente, le saludamos cordialmente para recordarle su saldo pendiente. Quedamos a su disposición para coordinar su pago.",
  },
};

interface WhatsAppQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone?: string;
  initialMessage?: string;
  customerName?: string;
}

export function WhatsAppQuickModal({
  open,
  onOpenChange,
  initialPhone = "",
  initialMessage = "",
  customerName,
}: WhatsAppQuickModalProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState(initialMessage);
  const [template, setTemplate] = useState<TemplateKey>("custom");
  const isDesktop = isDesktopApp();

  const handleTemplateChange = (val: TemplateKey) => {
    setTemplate(val);
    if (templates[val].text) {
      setMessage(templates[val].text);
    }
  };

  const handleOpenDirect = async () => {
    try {
      await openWhatsAppWeb();
      toast.success("Abriendo WhatsApp Web");
      onOpenChange(false);
    } catch {
      toast.error("No se pudo abrir WhatsApp Web");
    }
  };

  const handleSend = async () => {
    if (!phone.trim()) {
      toast.error("Ingresa el número telefónico del cliente");
      return;
    }
    try {
      await openWhatsAppWeb({ phone: phone.trim(), text: message.trim() });
      toast.success("Abriendo chat en WhatsApp Web");
      onOpenChange(false);
    } catch {
      toast.error("Error al abrir WhatsApp");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                WhatsApp Web — Nica-POS
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isDesktop
                  ? "Sesión integrada en escritorio (guardada permanentemente)"
                  : "Abre WhatsApp Web en ventana auxiliar para contactar clientes"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Banner informativo de modo escritorio y cómo vincular QR */}
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-foreground">
            <div className="flex items-start gap-2.5">
              {isDesktop ? (
                <Laptop className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-semibold text-emerald-400">
                  {isDesktop ? "Modo Escritorio Activo (Sesión Permanente)" : "Integración con WhatsApp Web"}
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {isDesktop
                    ? "La sesión queda guardada en tu PC. Solo vinculas el código QR una sola vez."
                    : "Abre WhatsApp Web oficial con el mensaje pre-cargado listo para enviar."}
                </p>
              </div>
            </div>

            {/* Guía rápida de escaneo del código QR */}
            <div className="mt-1 rounded border border-emerald-500/20 bg-background/50 p-2 text-[11px] space-y-1 text-muted-foreground">
              <p className="font-semibold text-emerald-400">¿Dónde y cómo escanear el QR?</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Haz clic abajo en <strong className="text-foreground">«Abrir WhatsApp Web»</strong>.</li>
                <li>En tu teléfono celular abre WhatsApp y toca los 3 puntos (o Ajustes) → <strong className="text-foreground">Dispositivos vinculados</strong>.</li>
                <li>Toca <strong className="text-foreground">«Vincular un dispositivo»</strong> y apunta la cámara al QR que aparece en la ventana.</li>
              </ol>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-phone" className="text-xs">
                Número del cliente (Nicaragua: 8 dígitos)
              </Label>
              {customerName && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {customerName}
                </span>
              )}
            </div>
            <Input
              id="wa-phone"
              placeholder="Ej. 8888-1234 o +505 8888 1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-sm font-mono"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">Plantilla rápida</Label>
            <Select value={template} onValueChange={(v) => handleTemplateChange(v as TemplateKey)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Seleccionar plantilla" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(templates).map(([key, item]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wa-message" className="text-xs">
              Mensaje a enviar
            </Label>
            <Textarea
              id="wa-message"
              placeholder="Escribe tu mensaje..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenDirect}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Abrir WhatsApp Web
          </Button>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Enviar mensaje
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
