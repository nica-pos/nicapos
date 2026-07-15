DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cash_sessions','cash_movements','products','sales','sale_items','sale_payments',
    'inventory_movements','customers','suppliers','purchase_orders','purchase_order_items',
    'payable_payments','receivables','receivable_payments','layaways','layaway_items','layaway_payments',
    'stock_audits','stock_audit_items','promotions','combo_components','categories','brands','product_models',
    'fiscal_settings','exchange_rates','audit_logs'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Superadmin full access" ON public.%I', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Members can view exchange rates" ON public.exchange_rates;
CREATE POLICY "Members can view exchange rates"
ON public.exchange_rates
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Members can view fiscal settings" ON public.fiscal_settings;
CREATE POLICY "Members can view fiscal settings"
ON public.fiscal_settings
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Members can view co-members" ON public.tenant_members;
CREATE POLICY "Members can view co-members"
ON public.tenant_members
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Owner or admin can add members" ON public.tenant_members;
CREATE POLICY "Owner or admin can add members"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::public.tenant_role)
);

DROP POLICY IF EXISTS "Owner or admin can remove members" ON public.tenant_members;
CREATE POLICY "Owner or admin can remove members"
ON public.tenant_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::public.tenant_role)
);

DROP POLICY IF EXISTS "Owner or admin can update members" ON public.tenant_members;
CREATE POLICY "Owner or admin can update members"
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::public.tenant_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_members.tenant_id
      AND t.owner_id = auth.uid()
  )
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::public.tenant_role)
);

DROP POLICY IF EXISTS "Tenant members read their subscription" ON public.tenant_subscriptions;
CREATE POLICY "Tenant members read their subscription"
ON public.tenant_subscriptions
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "branding tenant upload" ON storage.objects;
DROP POLICY IF EXISTS "branding tenant update" ON storage.objects;
DROP POLICY IF EXISTS "branding tenant delete" ON storage.objects;

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
)
WITH CHECK (
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