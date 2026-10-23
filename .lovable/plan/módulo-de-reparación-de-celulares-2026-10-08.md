# Módulo de Reparación de celulares

## Qué vas a tener

- Nuevo menú **Reparaciones** con listado, búsqueda (número, cliente, teléfono, IMEI, estado), crear, detalle y edición de órdenes.
- Nuevo rol **Técnico** en Equipo: solo ve, crea y gestiona **sus propias** reparaciones (y solo en sus sucursales). No puede tocar precios ya aprobados ni ver otras órdenes.
- **Dueño/Admin**: ven y editan cualquier orden (corregir precios, reasignar técnico, excepciones de entrega con motivo).
- Cajero: puede recibir equipos, cobrar anticipos/saldos y entregar.

## Flujo

1. **Ingreso**: cliente existente o nuevo, marca, modelo, color, IMEI/serie, falla, accesorios, estado físico, observaciones, fotos, fecha estimada, código de desbloqueo opcional (oculto, solo visible a técnico asignado/admin, con aviso de privacidad).
2. **Orden** con número único (prefijo configurable, ej. REP-0001) y comprobante de recepción imprimible.
3. **Diagnóstico y cotización**: trabajo, repuestos del inventario, mano de obra, total. Cada cambio de precio crea una nueva cotización que requiere aprobación/rechazo del cliente antes de continuar.
4. **Estados**: recibido → en diagnóstico → esperando aprobación → esperando repuestos → en reparación → listo → entregado / cancelado. Historial con quién y cuándo.
5. **Notas internas** por orden.
6. **Repuestos**: se descuentan del inventario de la sucursal solo al consumirlos (movimiento "Reparación REP-xxxx"), nunca en cotizaciones rechazadas/canceladas; sin stock negativo. Cancelar devuelve los repuestos consumidos.
7. **Pagos**: anticipos y pago final con los métodos existentes, registrados en la caja abierta de la sucursal. Muestra total, pagado y saldo.
8. **Entrega**: bloqueada con saldo pendiente salvo excepción de admin con motivo. Comprobante final.

## Estadísticas (panel de Reparaciones + Dashboard + Reportes)

- Pendientes, atrasadas, listas para entregar.
- Por orden: ingreso, costo de repuestos, mano de obra y **ganancia** (ingreso − costo de repuestos).
- Totales del periodo: ingresos de reparaciones, costo de repuestos, ganancia neta — separados de las ventas de productos.
- **Desempeño por técnico**: órdenes, entregadas, ingresos, ganancia, tiempo promedio.
- Filtros por fechas, sucursal, estado y técnico. El técnico solo ve sus propias cifras.

## Detalles técnicos

- Enum `tenant_role` + `technician`; `ROUTE_ROLES` actualizado.
- Tablas: `repair_orders`, `repair_quotes` (+ items), `repair_parts`, `repair_status_history`, `repair_notes`, `repair_payments`, `repair_photos` (bucket privado). Numeración en `fiscal_settings`.
- RLS: miembros de la tienda con acceso a la sucursal; técnico limitado a `technician_id = auth.uid()` o `created_by`; edición de precios aprobados y excepciones solo owner/admin.
- RPCs SECURITY DEFINER: `create_repair_order`, `change_repair_status`, `approve_repair_quote`, `consume_repair_part`, `record_repair_payment` (inserta `cash_movements` tipo reparación), `deliver_repair`, `cancel_repair`.
- Hooks `use-repairs.ts`, rutas `reparaciones.tsx`, `reparaciones.$id.tsx`, comprobantes con la impresión existente, pruebas de reglas (saldo pendiente, permisos de técnico).
