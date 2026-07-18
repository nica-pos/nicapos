ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

DROP POLICY IF EXISTS "product images read" ON storage.objects;
CREATE POLICY "product images read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product images tenant write" ON storage.objects;
CREATE POLICY "product images tenant write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "product images tenant update" ON storage.objects;
CREATE POLICY "product images tenant update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "product images tenant delete" ON storage.objects;
CREATE POLICY "product images tenant delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);