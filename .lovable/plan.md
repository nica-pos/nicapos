# Sucursales (multi-branch) dentro de una sola cuenta

Una tienda (tenant) = una suscripción. Adentro puede tener N sucursales según lo que permita su plan. Cada sucursal tiene stock y caja propios. Productos, clientes, proveedores y equipo se comparten. Traslados entre sucursales.

## 1. Base de datos (una sola migración)

**Planes**
- Nueva columna `plans.max_branches int not null default 1` (editable desde el panel superadmin, `NULL` no se usa; 9999 = ilimitado).

**Sucursales**
- Nueva tabla `branches`: `id`, `tenant_id`, `name`, `address`, `phone`, `is_active`, `is_default`, `created_at`, `updated_at`.
- Índice único parcial: `(tenant_id) where is_default` → solo una sucursal por defecto.
- RLS: los miembros de la tienda ven/editan las sucursales de su tienda; solo owner/admin pueden crear/eliminar.
- Trigger: al crear un `tenant` se crea automáticamente su **sucursal "Principal"** (`is_default=true`), así todo lo viejo sigue funcionando.

**Stock por sucursal**
- Nueva tabla `product_stock`: `(product_id, branch_id)` PK compuesta, `stock numeric`, `cost_usd numeric`. Reemplaza la lectura de `products.stock` a nivel operativo.
- Backfill: por cada producto existente, insertar una fila en `product_stock` con la sucursal por defecto usando el stock/costo actuales.
- `products.stock` y `products.cost_usd` se mantienen como "totales calculados" (suma / promedio ponderado) actualizados por trigger, para no romper reportes viejos ni Inventario.

**Columna `branch_id` en tablas operativas** (todas dentro de la misma migración, con backfill a la sucursal por defecto del tenant y luego `NOT NULL`):
`sales`, `sale_payments`, `cash_sessions`, `cash_movements`, `inventory_movements`, `stock_audits`, `layaways`, `purchase_orders` (opcional, para saber a dónde entró la mercadería).

**Función de validación de límite**
- `can_create_branch(_tenant_id uuid) returns boolean` (SECURITY DEFINER): compara `count(branches activas)` vs `plans.max_branches`. Se usa como CHECK/trigger `BEFORE INSERT` en `branches` para que sea imposible saltarse el límite ni desde SQL directo.

**Traslados**
- Nuevo tipo de movimiento `'transfer_out'` / `'transfer_in'` en `inventory_movements`.
- Función `transfer_stock(_product_id, _from_branch, _to_branch, _quantity, _note)` que descuenta de una y suma a la otra en una sola transacción.

**Ajuste al flujo anti-fantasma**
- El índice único que hoy limita "1 tienda activa por dueño" se mantiene igual (una cuenta = una tienda = una suscripción). Las sucursales viven adentro y no crean tenants nuevos, así que no aparecen usuarios/tenants huérfanos por este flujo.
- `cleanup_stale_tenants` no cambia.

## 2. Superadmin

**Planes → edición**
- Añadir campo **"Sucursales incluidas"** (`max_branches`) editable en el diálogo del plan. Placeholder: `1 = solo la principal`, `9999 = ilimitado`.

## 3. Panel del dueño / admin

**Nueva ruta `/sucursales`** (owner + admin, no cashier):
- Lista de sucursales de la tienda con: nombre, dirección, teléfono, activa/inactiva, botón "Editar".
- Botón **"+ Agregar sucursal"** — deshabilitado con tooltip cuando `count >= plan.max_branches` ("Tu plan permite X sucursales. Sube de plan para agregar más.").
- Diálogo simple: nombre (obligatorio), dirección, teléfono.
- Acciones: editar, desactivar (soft: `is_active=false`, no borra ventas históricas), reactivar. No permitir borrar la sucursal por defecto ni la única activa.

**Selector global de sucursal**
- Componente nuevo en el header (junto al selector de tienda que ya existe): dropdown "Sucursal: Principal ▾".
- Se guarda en `localStorage` + contexto React (`useCurrentBranch()`).
- POS, Inventario, Caja, Ventas, Historial, Reportes → todos filtran por la sucursal activa.
- Cashier: se le fija la sucursal al iniciar sesión (owner/admin la asignan en Equipo); no puede cambiarla.

**Equipo**
- Añadir campo opcional **"Sucursal asignada"** al miembro (solo aplica a cashier). Owner/admin ven todas.

**Traslados**
- Nueva ruta `/traslados`: seleccionar producto, cantidad, sucursal origen y destino → llama a `transfer_stock`. Historial de traslados abajo.

## 4. Ajustes en pantallas existentes

- **POS**: los productos que se muestran leen stock de `product_stock` para la sucursal activa. La venta se marca con `branch_id`.
- **Inventario**: la columna "Stock" muestra el de la sucursal activa; un toggle "Ver todas" muestra la suma total.
- **Caja / Cash sessions**: cada sesión se abre para una sucursal específica; no se puede tener 2 sesiones abiertas en la misma sucursal.
- **Historial de ventas / Reportes**: filtro por sucursal (default: la activa; "Todas" para owner/admin).
- **Compras**: al recibir un PO se elige a qué sucursal entra el stock.

## 5. Verificación (evita bugs y fantasmas)

- Trigger + función `can_create_branch` bloquean cualquier intento de exceder el límite (UI + SQL directo).
- Backfill garantiza que TODO producto/venta/caja existente queda ligado a la sucursal principal antes de poner `NOT NULL`.
- La sucursal por defecto no se puede eliminar; desactivar la última sucursal activa está prohibido.
- Al bajar un plan que reduce `max_branches` por debajo del actual: el superadmin ve advertencia y debe elegir qué sucursales desactivar antes de aplicar el cambio (no se auto-borran datos).
- Tests manuales al final: crear 2 tiendas con el mismo owner → falla; crear sucursal #4 en plan de 3 → falla en UI y en SQL; vender en sucursal A no descuenta stock de B; cashier asignado a sucursal A no ve ventas de B.

## Detalles técnicos

- Todas las tablas nuevas: `GRANT` a `authenticated` + `service_role`, RLS activo con políticas basadas en `is_tenant_member`.
- Todas las funciones SQL: `SECURITY DEFINER`, `search_path = public`, chequeo de membresía adentro.
- Cambios de frontend: nuevo hook `useCurrentBranch()`, nuevo `<BranchSelector />` en el header, filtros de queries por `branch_id`, y rutas `/sucursales` y `/traslados` bajo `_authenticated/`.
- No se toca el flujo de pagos, trials, ni el índice único de "1 tienda por dueño".