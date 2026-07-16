
CREATE POLICY "Superadmin can view all tenants" ON public.tenants
  FOR SELECT USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Owner or admin can update tenant" ON public.tenants;
CREATE POLICY "Owner admin or superadmin can update tenant" ON public.tenants
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR public.has_tenant_role(auth.uid(), id, 'admin'::tenant_role)
    OR public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Owner can delete tenant" ON public.tenants;
CREATE POLICY "Owner or superadmin can delete tenant" ON public.tenants
  FOR DELETE USING (
    owner_id = auth.uid() OR public.is_superadmin(auth.uid())
  );
