# Activar todos los módulos del sistema

El sistema tiene 15 módulos ya construidos visualmente. Muchos leen datos reales, otros tienen botones o secciones sin conectar. Voy a auditar módulo por módulo y dejar todo funcional, en fases priorizadas por importancia operativa (una tienda no puede vender sin POS y caja; sí puede esperar reportes fiscales avanzados).

## Fase 1 — Núcleo operativo (vender y controlar dinero)

Sin esto la tienda no funciona.

- **Dashboard** — verificar métricas reales (ventas del día, caja abierta, stock crítico, cuentas por cobrar) y accesos rápidos.
- **POS** — flujo completo: buscar producto, agregar al carrito, aplicar descuento/promoción, cobrar (efectivo/tarjeta/mixto), imprimir/mostrar recibo, descontar inventario.
- **Caja** — abrir/cerrar sesión, arqueo, ingresos/egresos, historial de movimientos y cierres.
- **Productos** — CRUD completo con categorías, marcas, modelos, precio/costo, código de barras, stock inicial.
- **Inventario** — movimientos manuales (entrada/salida/ajuste), auditorías de stock, alertas de stock bajo, kardex por producto.

## Fase 2 — Relaciones comerciales

- **Clientes** — CRUD, historial de compras, saldo por cobrar, apartados (layaways) con abonos.
- **Proveedores** — CRUD, órdenes de compra, recepción de mercancía (dispara movimientos de inventario), pagos a proveedores.
- **Promociones** — activar/desactivar, aplicar automáticamente en POS por producto/categoría/monto mínimo.

## Fase 3 — Administración de la tienda

- **Equipo** — invitar miembros por correo, asignar rol (owner/admin/cashier), remover miembros.
- **Configuración** — datos de tienda, logo, colores, tipo de cambio manual, ajustes generales.
- **Fiscal** — datos fiscales (RUC, razón social, régimen), configuración de impuestos, plantillas de comprobantes.
- **Documentos** — generación de facturas/recibos/tickets desde ventas ya registradas.

## Fase 4 — Trazabilidad y control

- **Auditoría** — visor de `audit_logs` con filtros por usuario, entidad, fecha y acción.
- **Bitácora** — actividad reciente de la tienda (ventas, cambios de precio, aperturas de caja).
- **Admin (Superadmin)** — ya funciona: listar tiendas, cambiar estado, editar planes. Verificar que no falte nada.

## Método por módulo

Para cada uno haré exactamente esto:

1. Leer el archivo actual y las tablas/funciones RPC involucradas.
2. Listar qué ya funciona y qué está pendiente o roto.
3. Implementar lo pendiente sin romper lo existente (nuevas mutations, formularios, diálogos, conexiones a Supabase).
4. Verificar RLS y `GRANT` de cada tabla usada.
5. Probar el flujo mentalmente y dejar el módulo cerrado antes de pasar al siguiente.

## Detalles técnicos

- Toda mutación pasa por `useMutation` + `queryClient.invalidateQueries` para refrescar UI.
- Todo formulario valida con Zod antes de tocar la base.
- Los movimientos de inventario y pagos usan las funciones RPC existentes (`record_inventory_movement`, `receive_purchase_order`, `record_receivable_payment`, `record_payable_payment`, `record_layaway_payment`) — no reimplemento lógica ya en la base.
- Cuando un módulo necesite tablas nuevas (ejemplo: `sucursales` si aparece), abro una migración aparte con GRANT + RLS.
- Nada de datos de ejemplo hardcodeados: todo viene de la base filtrado por `tenant_id` de la tienda activa.
- Superadmin sigue aislado: no ve datos operativos de tiendas ajenas fuera de `/admin`.

## Entrega

Empezaré por la **Fase 1** en el siguiente mensaje una vez apruebes este plan. Cada fase la entregaré junta para que puedas probarla completa. Si quieres reordenar prioridades (por ejemplo, empezar por Equipo o Fiscal), dímelo antes de aprobar.