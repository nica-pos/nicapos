import { getFriendlyErrorMessage } from "@/lib/errors";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  Store,
  Chrome,
  Loader2,
  ShieldCheck,
  Zap,
  BarChart3,
  Receipt,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Nica-POS" },
      {
        name: "description",
        content:
          "Accede o crea tu cuenta de Nica-POS para empezar a vender y controlar tu negocio en minutos.",
      },
      { property: "og:title", content: "Iniciar sesión — Nica-POS" },
      {
        property: "og:description",
        content:
          "Accede o crea tu cuenta de Nica-POS para empezar a vender y controlar tu negocio en minutos.",
      },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
});

const highlights = [
  {
    icon: Receipt,
    title: "Facturación en Córdobas y Dólares",
    desc: "Multimoneda, IVA e IR listos para Nicaragua.",
  },
  {
    icon: BarChart3,
    title: "Reportes financieros en vivo",
    desc: "Ventas, utilidad y flujo de caja al instante.",
  },
  {
    icon: Zap,
    title: "Cobra en segundos",
    desc: "POS táctil, atajos y pagos mixtos.",
  },
  {
    icon: ShieldCheck,
    title: "Auditoría antifraude",
    desc: "Bitácora inmutable y roles por sucursal.",
  },
];

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  function validateForm(requireLength = false): string | null {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!email.trim() || !emailOk) return "Ingresa un correo electrónico válido.";
    if (!password) return "Ingresa tu contraseña.";
    if (requireLength && password.length < 8)
      return "La contraseña debe tener al menos 8 caracteres.";
    return null;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateForm();
    if (invalid) return setError(invalid);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setError(getFriendlyErrorMessage(error));
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateForm(true);
    if (invalid) return setError(invalid);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) return setError(getFriendlyErrorMessage(error));
      setMessage("Revisa tu correo para confirmar tu cuenta.");
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary/20 via-background to-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-radial-glow opacity-60" />
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <span className="text-gradient">Nica-POS</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              14 días gratis · Sin tarjeta
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
              El punto de venta hecho para{" "}
              <span className="text-gradient">Nicaragua</span>.
            </h2>
            <p className="max-w-md text-base text-muted-foreground">
              Factura, controla inventario y cierra caja desde cualquier dispositivo.
              Todo en Córdobas, Dólares y en la nube.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {highlights.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="flex gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{title}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nica-POS · Hecho para comercios nicaragüenses.
        </div>
      </aside>

      {/* Panel del formulario */}
      <main className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </Link>

        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 flex items-center justify-center gap-2 text-lg font-bold lg:hidden"
          >
            <Store className="h-6 w-6 text-primary" />
            <span className="text-gradient">Nica-POS</span>
          </Link>

          <div className="mb-8 space-y-1.5 text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {tab === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tab === "login"
                ? "Ingresa a tu tienda para seguir vendiendo."
                : "Configura tu negocio en menos de 3 minutos."}
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="register">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Correo electrónico</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@empresa.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Contraseña</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Iniciar sesión
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">Correo electrónico</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="tu@empresa.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres. Usa letras y números.
                  </p>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear cuenta gratis
                </Button>
              </form>
            </TabsContent>
          </Tabs>


          {error && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
              {message}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Al continuar aceptas nuestros{" "}
            <Link to="/" className="underline underline-offset-2 hover:text-foreground">
              Términos
            </Link>{" "}
            y{" "}
            <Link to="/" className="underline underline-offset-2 hover:text-foreground">
              Política de privacidad
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
