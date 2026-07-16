
-- 1) Restrict branding bucket SELECT to tenant members
DROP POLICY IF EXISTS "branding read authenticated" ON storage.objects;
CREATE POLICY "branding tenant read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'branding'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 2) Revoke public execute on cleanup_stale_tenants (maintenance-only)
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_tenants() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_tenants() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_tenants() TO service_role;
