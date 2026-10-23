-- Permite eliminar definitivamente una orden de reparación y todos sus registros vinculados
-- Solo ejecutable por Administradores o Dueños (owners) de la tienda.

CREATE OR REPLACE FUNCTION public.delete_repair_order(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _o public.repair_orders;
BEGIN
  -- 1. Buscar la orden para actualizar
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o IS NULL THEN
    RAISE EXCEPTION 'La orden de reparación no existe o ya fue eliminada.';
  END IF;

  -- 2. Validar que el usuario sea dueño (owner) o administrador (admin) del tenant
  IF NOT (
    public.has_tenant_role(auth.uid(), _o.tenant_id, 'owner') 
    OR public.has_tenant_role(auth.uid(), _o.tenant_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Solo un administrador o dueño puede eliminar definitivamente una orden de reparación.';
  END IF;

  -- 3. Eliminar registros vinculados en orden para asegurar integridad absoluta
  DELETE FROM public.repair_secrets WHERE order_id = _order_id;
  DELETE FROM public.repair_notes WHERE order_id = _order_id;
  DELETE FROM public.repair_status_history WHERE order_id = _order_id;
  DELETE FROM public.repair_quotes WHERE order_id = _order_id;
  DELETE FROM public.repair_parts WHERE order_id = _order_id;
  DELETE FROM public.repair_payments WHERE order_id = _order_id;

  -- 4. Eliminar la orden principal
  DELETE FROM public.repair_orders WHERE id = _order_id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.delete_repair_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_repair_order(uuid) TO authenticated;

-- Otorgar permisos de DELETE y políticas RLS para administradores y dueños
GRANT DELETE ON public.repair_orders, public.repair_secrets, public.repair_quotes,
  public.repair_parts, public.repair_status_history, public.repair_notes, public.repair_payments TO authenticated;

DROP POLICY IF EXISTS "repair_orders_delete" ON public.repair_orders;
CREATE POLICY "repair_orders_delete" ON public.repair_orders FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

DROP POLICY IF EXISTS "repair_secrets_delete" ON public.repair_secrets;
CREATE POLICY "repair_secrets_delete" ON public.repair_secrets FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

DROP POLICY IF EXISTS "repair_notes_delete" ON public.repair_notes;
CREATE POLICY "repair_notes_delete" ON public.repair_notes FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

DROP POLICY IF EXISTS "repair_status_history_delete" ON public.repair_status_history;
CREATE POLICY "repair_status_history_delete" ON public.repair_status_history FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

DROP POLICY IF EXISTS "repair_quotes_delete" ON public.repair_quotes;
CREATE POLICY "repair_quotes_delete" ON public.repair_quotes FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

DROP POLICY IF EXISTS "repair_parts_delete" ON public.repair_parts;
CREATE POLICY "repair_parts_delete" ON public.repair_parts FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

DROP POLICY IF EXISTS "repair_payments_delete" ON public.repair_payments;
CREATE POLICY "repair_payments_delete" ON public.repair_payments FOR DELETE TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);
