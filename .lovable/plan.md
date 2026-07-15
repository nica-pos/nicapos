# Cobro de planes con Stripe y PayPal

Objetivo: que los dueños de tienda paguen su plan (Free/Pro/etc) con **Stripe** o **PayPal**, y que tú (superadmin) puedas pegar/actualizar las credenciales de PayPal desde `/admin` cuando quieras, sin tocar código.

## Fase 1 — Stripe (integrado en Lovable)

- Activo la integración de pagos Stripe de Lovable (no necesitas cuenta propia para empezar; después la reclamas para recibir el dinero).
- Creo los productos/precios en Stripe a partir de la tabla `plans` que ya existe (Free se salta; los de pago se sincronizan).
- En la landing (`/precios`) y en `Configuración → Plan`, el botón "Suscribirme" abre Stripe Checkout.
- Webhook de Stripe (`/api/public/webhooks/stripe`) actualiza el `plan_id` y estado del tenant cuando el pago se confirma / se cancela / falla.

## Fase 2 — PayPal (manual, credenciales tuyas configurables)

### Panel superadmin
Nueva sección en `/admin → Configuración de pagos`:
- Campos: `Client ID`, `Client Secret`, modo (`Sandbox` / `Live`), activar/desactivar PayPal.
- Botón "Probar conexión" (llama a PayPal para verificar que el token OAuth funciona).
- Guardar y editar cuando quieras.

### Almacenamiento seguro
- Tabla nueva `payment_provider_settings` (una fila por proveedor, solo lectura/escritura para superadmin vía RLS).
- El `client_secret` se cifra con AES-256-GCM usando una clave del entorno (`PAYPAL_CREDENTIALS_SECRET`, generada automáticamente).
- Solo server functions con rol `superadmin` pueden leer/escribir; nunca llega al navegador en texto plano.

### Flujo de pago
- Server function `createPaypalSubscription({ plan_id })`:
  1. Lee credenciales cifradas → obtiene access token de PayPal.
  2. Crea/reutiliza `Product` + `Plan` de PayPal correspondientes al plan interno.
  3. Crea `Subscription` y devuelve el `approve_url`.
  4. Redirige al usuario a PayPal.
- Endpoint público `/api/public/webhooks/paypal` verifica la firma con las credenciales guardadas y actualiza el estado del tenant (activo / cancelado / fallido).
- Si PayPal está desactivado en el panel superadmin, el botón "Pagar con PayPal" no aparece.

## Fase 3 — UI del usuario final

En `Configuración → Plan` (dentro de la tienda):
- Muestra el plan actual y estado (activo, por vencer, cancelado).
- Botones: "Pagar con tarjeta (Stripe)" y "Pagar con PayPal" (este último solo si superadmin lo activó).
- Después de pagar, el tenant queda en el plan nuevo automáticamente vía webhook.

En la landing `/precios`:
- Mismos dos botones por plan, redirigen a auth si no hay sesión.

## Detalles técnicos

- **Tablas nuevas**:
  - `payment_provider_settings` (id, provider, is_enabled, mode, client_id, client_secret_ciphertext, updated_at, updated_by). RLS: solo superadmin.
  - `tenant_subscriptions` (tenant_id, provider, external_subscription_id, status, current_period_end, plan_id). RLS: miembros del tenant leen su fila; solo webhooks (service role) escriben.
- **Server fns nuevas** (todas en `src/lib/billing.functions.ts`):
  - `getPaymentProviderSettings` (superadmin)
  - `savePaymentProviderSettings` (superadmin, cifra el secret)
  - `testPaypalCredentials` (superadmin)
  - `createStripeCheckout({ plan_id })`
  - `createPaypalSubscription({ plan_id })`
  - `getMySubscription()`
- **Server routes nuevas** (webhooks públicos con verificación de firma):
  - `src/routes/api/public/webhooks/stripe.ts`
  - `src/routes/api/public/webhooks/paypal.ts`
- **Secrets**:
  - Stripe: los inyecta Lovable al activar la integración.
  - PayPal: no se piden por `add_secret` — el superadmin los pega en la UI. Solo se genera `PAYPAL_CREDENTIALS_SECRET` (clave de cifrado interna).

## Lo que NO incluye este plan

- Facturación automática/reintentos avanzados (dejo que Stripe/PayPal manejen retries nativos).
- Métodos manuales tipo transferencia bancaria (se puede agregar después con la misma estructura).
- Cambio de plan a mitad de ciclo con prorrateo (por ahora: cancelar y crear nuevo).

## Orden de entrega

1. Migraciones (tablas + RLS + GRANT).
2. Server fns + panel superadmin de credenciales PayPal.
3. Activar Stripe integrado + productos.
4. Webhooks Stripe + PayPal.
5. UI de pago en `/precios` y en `Configuración → Plan`.

Cuando apruebes, arranco por la Fase 1 (Stripe integrado) porque necesita activarse antes de escribir código, y en paralelo dejo la Fase 2 lista.
