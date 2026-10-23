import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Download,
  Monitor,
  Apple,
  HardDrive,
  ShieldCheck,
  Zap,
  ExternalLink,
  Terminal,
  Globe,
  CheckCircle2,
  Sparkles,
  MousePointerClick,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const OFFICIAL_INSTALLER_URL =
  (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined) ||
  "https://nicapos.lovable.app/__l5e/assets-v1/a2d258a0-9ae7-4556-bc2c-e7ec34741ff5/Nica-POS-Setup-1.0.0.exe";
const GITHUB_RELEASES_URL = "https://github.com/nica-pos/nicapos/releases";
const APP_VERSION = "1.0.0";
const FILE_NAME = "Nica-POS-Setup-1.0.0.exe";

export const Route = createFileRoute("/descargar")({
  head: () => ({
    meta: [
      { title: "Descargar Nica-POS para PC — Versión de escritorio" },
      {
        name: "description",
        content:
          "Descarga Nica-POS para Windows con un solo clic. Instalador automático (.exe), ícono en tu escritorio y soporte para impresoras térmicas.",
      },
      { property: "og:title", content: "Descargar Nica-POS para PC" },
      {
        property: "og:description",
        content: "Instalador oficial de escritorio de Nica-POS para Windows con instalación en un clic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DescargarPage,
});

function DescargarPage() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  const startDownload = () => {
    setDownloadStarted(true);
    toast.success("¡Iniciando descarga de Nica-POS para Windows!", {
      description: "El instalador oficial (118 MB) se está descargando en tu equipo.",
    });
    // Disparo directo seguro
    window.location.href = OFFICIAL_INSTALLER_URL;
  };

  // Autodescarga si viene con parámetro ?auto=true o ?auto=1 desde la navegación
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto") === "true" || params.get("auto") === "1") {
        const timer = setTimeout(() => {
          startDownload();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
              Nica-POS para <span className="text-gradient">Escritorio</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground">
              La experiencia más rápida y cómoda para tu punto de venta en Windows.
              Sin barra del navegador, con acceso directo en el escritorio e impresión directa a ticketeras térmicas.
            </p>
          </div>

          {/* Tarjeta principal de descarga directa */}
          <div className="mt-10 rounded-3xl border border-primary/40 bg-gradient-to-b from-primary/10 via-card to-card p-6 sm:p-10 text-center shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Instalación automática en 1 clic</span>
            </div>

            <h2 className="mt-4 text-2xl sm:text-3xl font-bold">
              Descargar Nica-POS para Windows
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Compatible con Windows 10 y 11 (64-bit) · Instalador completo oficial (118 MB) · Versión {APP_VERSION}
            </p>

            {/* Botón principal de descarga y opción web/PWA */}
            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <Button
                  size="lg"
                  asChild
                  className="h-14 px-8 text-base font-semibold gap-3 shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground rounded-xl w-full sm:w-auto"
                >
                  <a
                    href={OFFICIAL_INSTALLER_URL}
                    download={FILE_NAME}
                    onClick={() => {
                      setDownloadStarted(true);
                      toast.success("¡Iniciando descarga del instalador oficial!", {
                        description: "Tu archivo Nica-POS-Setup-1.0.0.exe (118 MB) se está descargando.",
                      });
                    }}
                  >
                    <Download className="h-5 w-5" />
                    {downloadStarted ? "Volver a descargar instalador (.exe)" : "Descargar instalador (.exe)"}
                  </a>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-14 px-6 text-sm font-medium gap-2 border-border/80 hover:bg-card/80 transition-all rounded-xl w-full sm:w-auto"
                >
                  <Link to="/auth">
                    <Globe className="h-4 w-4 text-primary" />
                    Usar App Web (Sin descargas)
                  </Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5 text-primary" />
                  ¿La descarga no inició automático?
                </span>
                <a
                  href={OFFICIAL_INSTALLER_URL}
                  download={FILE_NAME}
                  className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Haz clic aquí para descarga directa (.exe)
                </a>
              </div>
            </div>

            {/* Pasos visuales simples y directos */}
            <div className="mt-10 grid gap-4 sm:grid-cols-3 text-left border-t border-border/60 pt-8">
              <div className="flex items-start gap-3 rounded-xl bg-background/50 p-4 border border-border/40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Haz clic en Descargar</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se descargará el instalador <code className="text-primary font-mono text-[11px]">{FILE_NAME}</code> en tu PC.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-background/50 p-4 border border-border/40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Doble clic al archivo</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Abre el archivo descargado. La instalación se realiza sola en pocos segundos.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-background/50 p-4 border border-border/40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-500 text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">¡Listo para usar!</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aparecerá el ícono de Nica-POS en tu escritorio para abrir el sistema inmediatamente.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Características del instalador de PC */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Instalación en un clic</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sin configuraciones raras ni asistentes difíciles. Se instala y crea su propio acceso directo.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <Zap className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Impresión térmica nativa</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Conexión optimizada para impresoras de recibos 80mm y cajón de dinero sin diálogos del navegador.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <HardDrive className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Siempre actualizado</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Tus datos de ventas e inventario se sincronizan en la nube en tiempo real.
              </p>
            </div>
          </div>

          {/* Otras opciones / macOS / PWA */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold">Usar como App Web / PWA</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                ¿Prefieres no instalar el .exe? Puedes instalar Nica-POS directamente desde tu navegador (Google Chrome o Microsoft Edge) haciendo clic en el ícono de instalar en la barra superior.
              </p>
              <Button variant="ghost" size="sm" asChild className="mt-3 px-0 text-primary hover:bg-transparent">
                <Link to="/auth">Abrir versión Web ahora →</Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <div className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">macOS y Linux</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                En computadoras Mac o Linux puedes usar toda la potencia de Nica-POS directamente desde el navegador con total compatibilidad.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGuideOpen(true)}
                className="mt-3 px-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
              >
                Ver opciones avanzadas / GitHub →
              </Button>
            </div>
          </div>

          <div className="mt-10 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta y quieres entrar directamente?{" "}
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Iniciar sesión aquí
            </Link>
          </div>
        </section>
      </main>

      {/* Diálogo informativo avanzado (secundario para desarrolladores) */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Opciones avanzadas y código abierto
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Información para compilación o versiones en repositorios
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Terminal className="h-4 w-4 text-primary" />
                <span>Compilar con electron-builder localmente</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Si clonas el repositorio en tu máquina de desarrollo, puedes empaquetar el instalador para tu sistema operativo ejecutando:
              </p>
              <div className="rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                npm run electron:installer:win
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ExternalLink className="h-4 w-4 text-emerald-500" />
                <span>Releases de GitHub</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Las versiones públicas y etiquetas del proyecto se publican en el repositorio oficial.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="w-full sm:w-auto text-xs"
            >
              <a href={GITHUB_RELEASES_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Ver en GitHub
              </a>
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={startDownload}
              className="w-full sm:w-auto text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Descargar instalador (.exe)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
