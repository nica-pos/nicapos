CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  from_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  to_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  note text,
  status text NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit','received','cancelled')),
  created_by uuid,
  received_by uuid,
  received_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant transfers"
ON public.stock_transfers FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX idx_stock_transfers_tenant ON public.stock_transfers(tenant_id, status, created_at DESC);

CREATE TRIGGER update_stock_transfers_updated_at
BEFORE UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crear traslado (descuenta origen, queda en tránsito)
CREATE OR REPLACE FUNCTION public.create_stock_transfer(
  _product_id uuid, _from_branch uuid, _to_branch uuid, _quantity numeric, _note text DEFAULT NULL
) RETURNS public.stock_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid; _ft uuid; _tt uuid; _stock numeric; _row public.stock_transfers;
BEGIN
  IF _from_branch = _to_branch THEN RAISE EXCEPTION 'Sucursal origen y destino iguales'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

  SELECT tenant_id INTO _tenant FROM public.products WHERE id = _product_id;
  SELECT tenant_id INTO _ft FROM public.branches WHERE id = _from_branch;
  SELECT tenant_id INTO _tt FROM public.branches WHERE id = _to_branch;
  IF _tenant IS NULL OR _tenant <> _ft OR _tenant <> _tt THEN RAISE EXCEPTION 'Sucursales de otra tienda'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT public.can_access_branch(auth.uid(), _from_branch) THEN
    RAISE EXCEPTION 'No tenés permiso sobre la sucursal de origen';
  END IF;

  SELECT stock INTO _stock FROM public.product_stock WHERE product_id = _product_id AND branch_id = _from_branch;
  IF COALESCE(_stock, 0) < _quantity THEN RAISE EXCEPTION 'Stock insuficiente en sucursal origen'; END IF;

  PERFORM public.record_inventory_movement(_product_id, 'transfer_out', _quantity, 0,
    COALESCE(_note, 'Traslado a sucursal'), _from_branch);

  INSERT INTO public.stock_transfers (tenant_id, product_id, from_branch_id, to_branch_id, quantity, note, created_by)
  VALUES (_tenant, _product_id, _from_branch, _to_branch, _quantity, _note, auth.uid())
  RETURNING * INTO _row;

  RETURN _row;
END; $$;

-- Confirmar recepción (suma destino)
CREATE OR REPLACE FUNCTION public.receive_stock_transfer(_transfer_id uuid)
RETURNS public.stock_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.stock_transfers; _row public.stock_transfers;
BEGIN
  SELECT * INTO _t FROM public.stock_transfers WHERE id = _transfer_id;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Traslado no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _t.tenant_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _t.status <> 'in_transit' THEN RAISE EXCEPTION 'El traslado ya fue procesado'; END IF;
  IF NOT public.can_access_branch(auth.uid(), _t.to_branch_id) THEN
    RAISE EXCEPTION 'No tenés permiso sobre la sucursal de destino';
  END IF;

  PERFORM public.record_inventory_movement(_t.product_id, 'transfer_in', _t.quantity, 0,
    COALESCE(_t.note, 'Traslado desde sucursal'), _t.to_branch_id);

  UPDATE public.stock_transfers
     SET status = 'received', received_by = auth.uid(), received_at = now(), updated_at = now()
   WHERE id = _transfer_id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Cancelar traslado (devuelve al origen)
CREATE OR REPLACE FUNCTION public.cancel_stock_transfer(_transfer_id uuid, _reason text DEFAULT NULL)
RETURNS public.stock_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.stock_transfers; _row public.stock_transfers;
BEGIN
  SELECT * INTO _t FROM public.stock_transfers WHERE id = _transfer_id;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Traslado no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _t.tenant_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _t.status <> 'in_transit' THEN RAISE EXCEPTION 'El traslado ya fue procesado'; END IF;
  IF NOT (public.can_access_branch(auth.uid(), _t.from_branch_id) OR public.can_access_branch(auth.uid(), _t.to_branch_id)) THEN
    RAISE EXCEPTION 'No tenés permiso sobre este traslado';
  END IF;

  PERFORM public.record_inventory_movement(_t.product_id, 'transfer_in', _t.quantity, 0,
    'Cancelación de traslado', _t.from_branch_id);

  UPDATE public.stock_transfers
     SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
         cancel_reason = _reason, updated_at = now()
   WHERE id = _transfer_id RETURNING * INTO _row;
  RETURN _row;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_stock_transfer(uuid,uuid,uuid,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.receive_stock_transfer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_stock_transfer(uuid,text) FROM anon;