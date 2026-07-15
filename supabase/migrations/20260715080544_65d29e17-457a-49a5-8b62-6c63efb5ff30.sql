
CREATE POLICY "branding read authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'branding');

CREATE POLICY "branding tenant upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "branding tenant update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "branding tenant delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
