
-- 1) Restrict tenants policies to authenticated role
ALTER POLICY "Owner admin or superadmin can update tenant" ON public.tenants TO authenticated;
ALTER POLICY "Owner or superadmin can delete tenant" ON public.tenants TO authenticated;
ALTER POLICY "Superadmin can view all tenants" ON public.tenants TO authenticated;

-- 2) Restrict trial_requests superadmin policy to authenticated
ALTER POLICY "Superadmin manages trial requests" ON public.trial_requests TO authenticated;

-- 3) Tenant-scoped read on product-images bucket
DROP POLICY IF EXISTS "product images read" ON storage.objects;
CREATE POLICY "product images read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 4) Revoke anon EXECUTE on privileged SECURITY DEFINER functions.
-- submit_trial_request stays public (called from the public trial API route).
REVOKE EXECUTE ON FUNCTION public.approve_trial_request(uuid, uuid, text, uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.protect_default_branch() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_create_branch(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_branch_limit() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_cashier_limit() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_product_limit() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submit_payment_and_mark_pending(uuid, uuid, uuid, numeric, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.void_sale(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_default_branch() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.approve_trial_request(uuid, uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_and_mark_pending(uuid, uuid, uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text, uuid) TO authenticated;
