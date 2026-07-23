import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Monitor, Apple, HardDrive, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

const WINDOWS_INSTALLER_URL = "/__l5e/assets-v1/a2d258a0-9ae7-4556-bc2c-e7ec34741ff5/Nica-POS-Setup-1.0.0.exe";
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
              Instala Nica-POS como una aplicación nativa en tu PC. Sin navegador, con ícono en el escritorio,
              impresión directa a impresoras térmicas y apertura de cajón monedero.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Instalación en un clic</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Doble clic al instalador y listo. Crea acceso directo automáticamente.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <Zap className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Impresión térmica</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Imprime tickets 80mm y facturas carta sin diálogos molestos.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <HardDrive className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">Actualizaciones automáticas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Siempre conectado a la última versión sin reinstalar.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-8 text-center">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Versión {APP_VERSION}</p>
            <h2 className="mt-2 text-2xl font-bold">Descargar para Windows</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Compatible con Windows 10 y 11 (64-bit) · ~113 MB (.exe)
            </p>
            <Button asChild size="lg" className="mt-6 gap-2">
              <a href={WINDOWS_INSTALLER_URL} download>
                <Download className="h-5 w-5" />
                Descargar Nica-POS para Windows
              </a>
            </Button>
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-border/60 bg-background/60 p-4 text-left text-xs text-muted-foreground">
              <p className="mb-2 font-semibold text-foreground">Cómo instalar:</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Descarga el archivo <code>Nica-POS-Setup-1.0.0.exe</code>.</li>
                <li>Doble clic al instalador y sigue los pasos.</li>
                <li>Se creará automáticamente un acceso directo en tu escritorio.</li>
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
            ¿Prefieres usar la versión web?{" "}
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
