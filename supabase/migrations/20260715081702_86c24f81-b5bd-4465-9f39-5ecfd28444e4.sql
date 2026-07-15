DROP POLICY IF EXISTS "Members can view their tenant" ON public.tenants;
CREATE POLICY "Members can view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner or admin can update tenant" ON public.tenants;
CREATE POLICY "Owner or admin can update tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), id, 'admin'::public.tenant_role))
WITH CHECK (owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), id, 'admin'::public.tenant_role));

DROP POLICY IF EXISTS "Owner or superadmin can delete tenant" ON public.tenants;
CREATE POLICY "Owner can delete tenant"
ON public.tenants
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());