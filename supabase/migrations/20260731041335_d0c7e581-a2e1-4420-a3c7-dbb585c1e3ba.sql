CREATE TABLE public.user_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branches TO authenticated;
GRANT ALL ON public.user_branches TO service_role;

ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven asignaciones de su tienda"
ON public.user_branches FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Owner o admin gestionan asignaciones"
ON public.user_branches FOR ALL TO authenticated
USING (
  public.has_tenant_role(auth.uid(), tenant_id, 'owner')
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  (public.has_tenant_role(auth.uid(), tenant_id, 'owner')
   OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'))
  AND EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_id AND b.tenant_id = user_branches.tenant_id)
  AND public.is_tenant_member(user_id, tenant_id)
);

CREATE INDEX idx_user_branches_user ON public.user_branches(user_id);
CREATE INDEX idx_user_branches_tenant ON public.user_branches(tenant_id);

CREATE TRIGGER update_user_branches_updated_at
BEFORE UPDATE ON public.user_branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permiso de acceso a sucursal
CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant uuid;
  _role tenant_role;
  _assigned int;
  _main uuid;
BEGIN
  IF _user_id IS NULL OR _branch_id IS NULL THEN RETURN false; END IF;

  SELECT tenant_id INTO _tenant FROM public.branches WHERE id = _branch_id;
  IF _tenant IS NULL THEN RETURN false; END IF;

  SELECT role, branch_id INTO _role, _main
  FROM public.tenant_members WHERE user_id = _user_id AND tenant_id = _tenant;

  IF _role IS NULL THEN RETURN false; END IF;
  IF _role IN ('owner','admin','accountant') THEN RETURN true; END IF;

  SELECT count(*) INTO _assigned
  FROM public.user_branches WHERE user_id = _user_id AND tenant_id = _tenant;

  IF _assigned > 0 THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_branches
      WHERE user_id = _user_id AND branch_id = _branch_id
    );
  END IF;

  IF _main IS NOT NULL THEN RETURN _main = _branch_id; END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_branch(uuid, uuid) FROM anon;

-- Validar sucursal en movimientos de inventario
CREATE OR REPLACE FUNCTION public.record_inventory_movement(_product_id uuid, _movement_type text, _quantity numeric, _unit_cost numeric DEFAULT 0, _reference text DEFAULT NULL::text, _branch_id uuid DEFAULT NULL::uuid)
 RETURNS inventory_movements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _cur_qty numeric;
  _cur_cost numeric;
  _new_qty numeric;
  _new_cost numeric;
  _signed numeric;
  _row public.inventory_movements;
  _branch uuid := _branch_id;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM public.products WHERE id = _product_id;
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;

  IF _branch IS NULL THEN
    SELECT id INTO _branch FROM public.branches WHERE tenant_id = _tenant_id AND is_default LIMIT 1;
  END IF;

  IF NOT public.can_access_branch(auth.uid(), _branch) THEN
    RAISE EXCEPTION 'No tenés permiso para operar en esta sucursal';
  END IF;

  INSERT INTO public.product_stock (product_id, branch_id, tenant_id, stock, cost_usd)
  VALUES (_product_id, _branch, _tenant_id, 0, 0)
  ON CONFLICT DO NOTHING;

  SELECT stock, cost_usd INTO _cur_qty, _cur_cost
  FROM public.product_stock WHERE product_id = _product_id AND branch_id = _branch;

  IF _movement_type IN ('purchase','adjustment_in','transfer_in') THEN
    _signed := abs(_quantity);
  ELSE
    _signed := -abs(_quantity);
  END IF;

  _new_qty := _cur_qty + _signed;

  IF _signed < 0 AND _new_qty < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente en la sucursal (disponible: %, solicitado: %)', _cur_qty, abs(_signed)
      USING ERRCODE = 'check_violation';
  END IF;

  IF _signed > 0 AND _unit_cost > 0 THEN
    _new_cost := ((_cur_qty * _cur_cost) + (_signed * _unit_cost)) / NULLIF(_new_qty, 0);
  ELSE
    _new_cost := _cur_cost;
  END IF;
  _new_cost := COALESCE(_new_cost, _cur_cost);

  UPDATE public.product_stock
    SET stock = _new_qty, cost_usd = _new_cost, updated_at = now()
  WHERE product_id = _product_id AND branch_id = _branch;

  UPDATE public.products p SET
    stock = COALESCE((SELECT sum(stock) FROM public.product_stock WHERE product_id = p.id), 0),
    cost_usd = COALESCE(
      (SELECT CASE WHEN sum(stock) > 0 THEN sum(stock * cost_usd) / sum(stock) ELSE 0 END
        FROM public.product_stock WHERE product_id = p.id),
      p.cost_usd
    ),
    updated_at = now()
  WHERE p.id = _product_id;

  INSERT INTO public.inventory_movements (
    tenant_id, branch_id, product_id, movement_type, quantity, unit_cost_usd,
    balance_qty, avg_cost_usd, reference, created_by
  ) VALUES (
    _tenant_id, _branch, _product_id, _movement_type, _signed,
    CASE WHEN _signed > 0 THEN _unit_cost ELSE _cur_cost END,
    _new_qty, _new_cost, _reference, auth.uid()
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$function$;

-- Validar sucursal en traslados
CREATE OR REPLACE FUNCTION public.transfer_stock(_product_id uuid, _from_branch uuid, _to_branch uuid, _quantity numeric, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _tenant uuid; _from_tenant uuid; _to_tenant uuid; _stock numeric;
BEGIN
  IF _from_branch = _to_branch THEN RAISE EXCEPTION 'Sucursal origen y destino iguales'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

  SELECT tenant_id INTO _tenant FROM public.products WHERE id = _product_id;
  SELECT tenant_id INTO _from_tenant FROM public.branches WHERE id = _from_branch;
  SELECT tenant_id INTO _to_tenant FROM public.branches WHERE id = _to_branch;

  IF _tenant IS NULL OR _tenant <> _from_tenant OR _tenant <> _to_tenant THEN
    RAISE EXCEPTION 'Sucursales de otra tienda';
  END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT public.can_access_branch(auth.uid(), _from_branch) THEN
    RAISE EXCEPTION 'No tenés permiso sobre la sucursal de origen';
  END IF;

  SELECT stock INTO _stock FROM public.product_stock WHERE product_id = _product_id AND branch_id = _from_branch;
  IF COALESCE(_stock, 0) < _quantity THEN RAISE EXCEPTION 'Stock insuficiente en sucursal origen'; END IF;

  PERFORM public.record_inventory_movement(_product_id, 'transfer_out', _quantity, 0,
    COALESCE(_note, 'Traslado a sucursal'), _from_branch);
  PERFORM public.record_inventory_movement(_product_id, 'transfer_in', _quantity, 0,
    COALESCE(_note, 'Traslado desde sucursal'), _to_branch);
END; $function$;