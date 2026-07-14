import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Store className="h-6 w-6 text-primary" />
              <span className="text-gradient">Nica-POS</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Sistema contable y punto de venta SaaS multi-tenant, diseñado para las regulaciones y
              la velocidad del comercio nicaragüense.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Producto</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/#features" className="hover:text-foreground">
                  Características
                </Link>
              </li>
              <li>
                <Link to="/precios" className="hover:text-foreground">
                  Precios
                </Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-foreground">
                  Registro
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-foreground">
                  Términos de servicio
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-foreground">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-foreground">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/60 pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Nica-POS. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
