
DROP POLICY IF EXISTS "branding tenant upload" ON storage.objects;
DROP POLICY IF EXISTS "branding tenant update" ON storage.objects;
DROP POLICY IF EXISTS "branding tenant delete" ON storage.objects;

CREATE POLICY "branding tenant upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (
    public.is_superadmin(auth.uid())
    OR public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "branding tenant update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND (
    public.is_superadmin(auth.uid())
    OR public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "branding tenant delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND (
    public.is_superadmin(auth.uid())
    OR public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
