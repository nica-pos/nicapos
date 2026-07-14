CREATE OR REPLACE FUNCTION public.shares_tenant(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members m1
    JOIN public.tenant_members m2 ON m1.tenant_id = m2.tenant_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  )
$$;

CREATE POLICY "Co-members can view each other profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.shares_tenant(auth.uid(), id));