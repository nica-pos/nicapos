
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.reject_trial_request(_request_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pending uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo superadmin';
  END IF;

  SELECT pending_tenant_id INTO _pending
  FROM public.trial_requests WHERE id = _request_id AND status = 'pending';

  UPDATE public.trial_requests
    SET status = 'rejected', rejection_reason = _reason,
        reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = _request_id AND status = 'pending';

  IF _pending IS NOT NULL THEN
    UPDATE public.tenants
      SET status = 'cancelled',
          cancellation_reason = _reason,
          cancelled_at = now(),
          updated_at = now()
    WHERE id = _pending;
  END IF;
END; $function$;

-- Backfill visible reason for the existing cancelled tenant so the user sees something.
UPDATE public.tenants
SET cancellation_reason = COALESCE(cancellation_reason,
  'Tu solicitud fue rechazada por el equipo administrativo. Si consideras que es un error o realizaste un pago, contáctanos para revisar tu caso.'),
    cancelled_at = COALESCE(cancelled_at, now())
WHERE status = 'cancelled' AND cancellation_reason IS NULL;
