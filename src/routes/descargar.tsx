import { useState } from "react";
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

const CUSTOM_DOWNLOAD_URL = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined) || "";
const GITHUB_RELEASES_URL = "https://github.com/nica-pos/nicapos/releases";
const APP_VERSION = "1.0.0";

export const Route = createFileRoute("/descargar")({
  head: () => ({
    meta: [
      { title: "Descargar Nica-POS para PC — Versión de escritorio" },
      {
        name: "description",
        content:
          "Descarga Nica-POS para Windows. Instalador de un solo clic, ícono en el escritorio y sin depender del navegador.",
      },
      { property: "og:title", content: "Descargar Nica-POS para PC" },
      {
        property: "og:description",
        content: "Instalador oficial de escritorio de Nica-POS para Windows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DescargarPage,
});

function DescargarPage() {
  const [guideOpen, setGuideOpen] = useState(false);

  const handleDownloadClick = () => {
    if (CUSTOM_DOWNLOAD_URL) {
      window.location.href = CUSTOM_DOWNLOAD_URL;
    } else {
      setGuideOpen(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Nica-POS para <span className="text-gradient">Escritorio</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Instala Nica-POS como una aplicación nativa en tu PC. Sin navegador, con ícono en el
              escritorio, impresión directa a impresoras térmicas y apertura de cajón monedero.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Instalación en un clic</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Doble clic al instalador y listo. Crea acceso directo automáticamente en tu PC.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <Zap className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Impresión térmica</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Imprime tickets 80mm y facturas carta sin cuadros de diálogo molestos.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <HardDrive className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Actualizaciones automáticas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Siempre conectado a la nube para tener tus datos sincronizados en tiempo real.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-8 text-center">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">
              Versión {APP_VERSION}
            </p>
            <h2 className="mt-2 text-2xl font-bold">Descargar para Windows</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Compatible con Windows 10 y 11 (64-bit) · Instalador (.exe)
            </p>

            <Button size="lg" className="mt-6 gap-2" onClick={handleDownloadClick}>
              <Download className="h-5 w-5" />
              Descargar Nica-POS para Windows
            </Button>

            <div className="mx-auto mt-6 max-w-md rounded-xl border border-border/60 bg-background/60 p-4 text-left text-xs text-muted-foreground">
              <p className="mb-2 font-semibold text-foreground">Cómo instalar en tu negocio:</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Descarga el instalador ejecutable de Nica-POS.</li>
                <li>Doble clic al archivo descargado y sigue las instrucciones en pantalla.</li>
                <li>Inicia sesión con tu cuenta y comienza a vender.</li>
              </ol>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <div className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">macOS</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Próximamente. Mientras tanto puedes usar la versión web desde Safari o Chrome.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Linux</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Próximamente. Disponible bajo pedido para clientes empresariales.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center text-sm text-muted-foreground">
            ¿Prefieres usar la versión web sin instalar nada?{" "}
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </section>
      </main>

      {/* Diálogo informativo sobre el instalador de escritorio */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Instalador de Escritorio Nica-POS
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Opciones para generar o descargar el archivo para tu PC
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Terminal className="h-4 w-4 text-primary" />
                <span>1. Compilar el archivo .exe en tu computadora</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                El código de Electron ya está listo en tu repositorio. Si tienes el proyecto en tu PC, abre una terminal en la carpeta y escribe:
              </p>
              <div className="rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                npm run electron:installer:win
              </div>
              <p className="text-[11px] text-muted-foreground">
                Esto creará el archivo <span className="font-semibold text-foreground">electron-release/Nica-POS-Setup-1.0.0.exe</span> en menos de un minuto.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ExternalLink className="h-4 w-4 text-emerald-500" />
                <span>2. Descargas públicas de GitHub</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Puedes publicar el instalador generado en los Releases de tu repositorio de GitHub para que cualquier usuario o cliente lo descargue directamente.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Globe className="h-4 w-4 text-blue-500" />
                <span>3. Usar como aplicación PWA (Sin descargar .exe)</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Puedes instalar Nica-POS directamente desde tu navegador (Google Chrome o Edge) haciendo clic en el ícono de instalar en la barra de direcciones superior. Funciona como una app de escritorio nativa con ícono propio.
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
                Ver Releases en GitHub
              </a>
            </Button>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="default"
                size="sm"
                asChild
                className="text-xs"
              >
                <Link to="/auth">
                  Abrir versión Web
                </Link>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
