ALTER TABLE public.payment_submissions DROP CONSTRAINT IF EXISTS payment_submissions_status_check;
ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_status_check
  CHECK (status IN ('pending','approved','rejected','superseded'));

CREATE OR REPLACE FUNCTION public.submit_payment_and_mark_pending(_tenant_id uuid, _plan_id uuid, _bank_account_id uuid, _amount numeric, _currency text, _reference text, _receipt_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub_id uuid;
BEGIN
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'No perteneces a esta tienda.';
  END IF;

  UPDATE public.payment_submissions
     SET status = 'superseded', reviewed_at = now(),
         rejection_reason = 'Reemplazado por un envío más reciente'
   WHERE tenant_id = _tenant_id AND status = 'pending';

  INSERT INTO public.payment_submissions (
    tenant_id, plan_id, bank_account_id, amount, currency, reference, receipt_url, submitted_by, status
  ) VALUES (
    _tenant_id, _plan_id, _bank_account_id, _amount, _currency, _reference, _receipt_path, auth.uid(), 'pending'
  ) RETURNING id INTO _sub_id;

  UPDATE public.tenants
  SET status = 'pending_verification', updated_at = now()
  WHERE id = _tenant_id;

  RETURN _sub_id;
END;
$function$;

WITH ranked AS (
  SELECT id,
    row_number() OVER (PARTITION BY tenant_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.payment_submissions
  WHERE status = 'pending'
)
UPDATE public.payment_submissions ps
   SET status = 'superseded', reviewed_at = now(),
       rejection_reason = 'Reemplazado por un envío más reciente'
  FROM ranked r
 WHERE ps.id = r.id AND r.rn > 1;