
-- 1) Cancelar duplicados por dueño (mantener el más reciente)
UPDATE public.tenants SET status = 'cancelled', updated_at = now()
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY owner_id ORDER BY created_at DESC) AS rn
    FROM public.tenants
    WHERE status IN ('trial','active','pending_payment','pending_verification')
  ) x WHERE rn > 1
);

-- 2) Forzar expiración inmediata de los trials existentes (regla de negocio nueva)
UPDATE public.tenants
SET trial_ends_at = now() - interval '1 second', updated_at = now()
WHERE status = 'trial' AND trial_ends_at > now();

-- 3) Índice único parcial: 1 tienda activa por dueño
CREATE UNIQUE INDEX IF NOT EXISTS one_active_tenant_per_owner
  ON public.tenants(owner_id)
  WHERE status IN ('trial','active','pending_payment','pending_verification');

-- 4) Función de limpieza
CREATE OR REPLACE FUNCTION public.cleanup_stale_tenants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- pending_payment sin comprobante > 3 días -> cancelled
  UPDATE public.tenants t
  SET status = 'cancelled', updated_at = now()
  WHERE t.status = 'pending_payment'
    AND t.created_at < now() - interval '3 days'
    AND NOT EXISTS (SELECT 1 FROM public.payment_submissions ps WHERE ps.tenant_id = t.id);

  -- trial expirado > 7 días -> cancelled
  UPDATE public.tenants t
  SET status = 'cancelled', updated_at = now()
  WHERE t.status = 'trial'
    AND t.trial_ends_at IS NOT NULL
    AND t.trial_ends_at < now() - interval '7 days';

  -- trial recién vencido -> pending_payment (fuerza pago)
  UPDATE public.tenants t
  SET status = 'pending_payment', updated_at = now()
  WHERE t.status = 'trial'
    AND t.trial_ends_at IS NOT NULL
    AND t.trial_ends_at < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_tenants() TO service_role;

-- 5) Programar cron cada hora
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-tenants') THEN
    PERFORM cron.unschedule('cleanup-stale-tenants');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-stale-tenants',
  '0 * * * *',
  $cron$ SELECT public.cleanup_stale_tenants(); $cron$
);

-- Ejecutar una vez ahora para aplicar reglas de inmediato
SELECT public.cleanup_stale_tenants();
