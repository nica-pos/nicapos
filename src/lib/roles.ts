import type { TenantRole } from "@/hooks/use-tenant";

// Rutas permitidas por rol. owner/admin = acceso completo.
// cashier = solo operación de mostrador. accountant = lectura financiera + inventario.
export const ROUTE_ROLES: Record<string, TenantRole[]> = {
  "/dashboard": ["owner", "admin", "accountant"],
  "/cajero": ["owner", "admin", "cashier"],
  "/pos": ["owner", "admin", "cashier"],
  "/ventas": ["owner", "admin", "accountant"],
  "/promociones": ["owner", "admin"],
  "/clientes": ["owner", "admin", "cashier", "accountant"],
  "/productos": ["owner", "admin"],
  "/inventario": ["owner", "admin", "accountant"],
  "/auditoria": ["owner", "admin", "accountant"],
  "/proveedores": ["owner", "admin", "accountant"],
  "/caja": ["owner", "admin", "cashier", "accountant"],
  "/fiscal": ["owner", "admin"],
  "/documentos": ["owner", "admin", "accountant"],
  "/bitacora": ["owner", "admin", "accountant"],
  "/equipo": ["owner", "admin"],
  "/configuracion": ["owner", "admin"],
};

// Ruta por defecto tras iniciar sesión según rol.
export function defaultHomeForRole(role: TenantRole | null): string {
  if (role === "cashier") return "/cajero";
  if (role === "accountant") return "/dashboard";
  return "/dashboard";
}

export function canAccessRoute(path: string, role: TenantRole | null): boolean {
  if (!role) return false;
  // Match by longest prefix in the map.
  const keys = Object.keys(ROUTE_ROLES)
    .filter((k) => path === k || path.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length);
  if (keys.length === 0) return true; // rutas no listadas (ej. onboarding) libres
  return ROUTE_ROLES[keys[0]].includes(role);
}
