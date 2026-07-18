
CREATE OR REPLACE FUNCTION public.submit_payment_and_mark_pending(
  _tenant_id uuid,
  _plan_id uuid,
  _bank_account_id uuid,
  _amount numeric,
  _currency text,
  _reference text,
  _receipt_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub_id uuid;
BEGIN
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'No perteneces a esta tienda.';
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.submit_payment_and_mark_pending(uuid, uuid, uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment_and_mark_pending(uuid, uuid, uuid, numeric, text, text, text) TO authenticated;

-- Allow superadmin to read receipts from storage (for signed URLs)
DROP POLICY IF EXISTS "Superadmin can read payment receipts" ON storage.objects;
CREATE POLICY "Superadmin can read payment receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'superadmin')
);
