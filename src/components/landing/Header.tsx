import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Store, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<null | { email?: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
  }, []);

  const nav = [
    { label: "Características", to: "/#features" },
    { label: "Precios", to: "/precios" },
    { label: "Soporte", to: "/#support" },
    { label: "Descargar PC", to: "/descargar" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Store className="h-6 w-6 text-primary" />
          <span className="text-gradient">Nica-POS</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!loading && (
            <>
              {user ? (
                <Button asChild>
                  <Link to="/dashboard">Ir al panel</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/auth">Iniciar sesión</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/auth">Crear cuenta</Link>
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        <button
          className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-muted-foreground"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {!loading && (
              <>
                {user ? (
                  <Button asChild className="w-full" onClick={() => setOpen(false)}>
                    <Link to="/dashboard">Ir al panel</Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        Iniciar sesión
                      </Link>
                    </Button>
                    <Button asChild className="w-full" onClick={() => setOpen(false)}>
                      <Link to="/auth">Crear cuenta</Link>
                    </Button>
                  </>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
