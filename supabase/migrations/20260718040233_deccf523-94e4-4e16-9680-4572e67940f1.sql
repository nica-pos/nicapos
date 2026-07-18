CREATE POLICY "Owner/admin can delete voided sales"
ON public.sales
FOR DELETE
TO authenticated
USING (
  voided_at IS NOT NULL
  AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner'::tenant_role)
    OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::tenant_role)
  )
);