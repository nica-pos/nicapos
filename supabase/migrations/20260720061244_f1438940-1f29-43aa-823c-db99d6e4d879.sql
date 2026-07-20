
-- 1) void_sale: reversar inventario en la sucursal real de la venta
CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid, _reason text DEFAULT NULL::text)
 RETURNS sales
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _already timestamptz;
  _branch uuid;
  _row public.sales;
  _it record;
BEGIN
  SELECT tenant_id, voided_at, branch_id INTO _tenant, _already, _branch FROM public.sales WHERE id = _sale_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'La venta ya fue anulada'; END IF;

  FOR _it IN
    SELECT product_id, quantity, unit_cost_usd
    FROM public.sale_items
    WHERE sale_id = _sale_id AND product_id IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.combo_components WHERE combo_id = _it.product_id) THEN
      PERFORM public.record_inventory_movement(
        c.component_id, 'adjustment_in', _it.quantity * c.quantity, 0,
        'Anulación venta ' || _sale_id::text, _branch
      )
      FROM public.combo_components c
      WHERE c.combo_id = _it.product_id;
    ELSE
      PERFORM public.record_inventory_movement(
        _it.product_id, 'adjustment_in', _it.quantity, COALESCE(_it.unit_cost_usd, 0),
        'Anulación venta ' || _sale_id::text, _branch
      );
    END IF;
  END LOOP;

  DELETE FROM public.receivables
  WHERE tenant_id = _tenant
    AND description LIKE 'Venta #' || (SELECT sale_number FROM public.sales WHERE id = _sale_id) || ' a crédito%';

  UPDATE public.sales
    SET voided_at = now(), voided_by = auth.uid(), void_reason = _reason
  WHERE id = _sale_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$function$;

-- 2) receive_purchase_order: ingresar stock a la sucursal de la orden
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid)
 RETURNS purchase_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _tenant uuid; _status text; _branch uuid; _row public.purchase_orders; _it record;
BEGIN
  SELECT tenant_id, status, branch_id INTO _tenant, _status, _branch FROM public.purchase_orders WHERE id = _po_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status = 'received' THEN RAISE EXCEPTION 'Pedido ya recibido'; END IF;
  FOR _it IN SELECT product_id, quantity, unit_cost_usd FROM public.purchase_order_items WHERE purchase_order_id = _po_id AND product_id IS NOT NULL LOOP
    PERFORM public.record_inventory_movement(_it.product_id, 'purchase', _it.quantity, _it.unit_cost_usd, 'PO ' || _po_id::text, _branch);
  END LOOP;
  UPDATE public.purchase_orders SET status = 'received', received_at = now(), updated_at = now()
  WHERE id = _po_id RETURNING * INTO _row;
  RETURN _row;
END; $function$;

-- 3) record_inventory_movement: bloquear stock negativo en salidas
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

  -- Guard: bloquear si dejaría el stock por debajo de cero en una salida
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
