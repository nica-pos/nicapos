import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Store, Chrome, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Nica-POS" },
      {
        name: "description",
        content: "Accede o crea tu cuenta de Nica-POS para empezar a vender y controlar tu negocio.",
      },
      { property: "og:title", content: "Iniciar sesión — Nica-POS" },
      {
        property: "og:description",
        content: "Accede o crea tu cuenta de Nica-POS para empezar a vender y controlar tu negocio.",
      },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    navigate({ to: "/dashboard" });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Revisa tu correo para confirmar tu cuenta.");
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold">
            <Store className="h-7 w-7 text-primary" />
            <span className="text-gradient">Nica-POS</span>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Bienvenido</CardTitle>
              <CardDescription>Accede a tu tienda o crea una cuenta nueva.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                  <TabsTrigger value="register">Crear cuenta</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Correo electrónico</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="tu@email.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input
                        id="login-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Iniciar sesión
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Correo electrónico</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="tu@email.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <Input
                        id="register-password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Crear cuenta
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">O continúa con</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>

              {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
              {message && <p className="mt-4 text-center text-sm text-success">{message}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
