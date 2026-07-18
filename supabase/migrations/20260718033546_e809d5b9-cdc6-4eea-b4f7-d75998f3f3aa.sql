
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE POLICY "Members void sales"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid, _reason text DEFAULT NULL)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _already timestamptz;
  _row public.sales;
  _it record;
BEGIN
  SELECT tenant_id, voided_at INTO _tenant, _already FROM public.sales WHERE id = _sale_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'La venta ya fue anulada'; END IF;

  -- Reverse inventory: return each sold product to stock
  FOR _it IN
    SELECT product_id, quantity, unit_cost_usd
    FROM public.sale_items
    WHERE sale_id = _sale_id AND product_id IS NOT NULL
  LOOP
    -- Handle combos: return each component's quantity
    IF EXISTS (SELECT 1 FROM public.combo_components WHERE combo_id = _it.product_id) THEN
      PERFORM public.record_inventory_movement(
        c.component_id,
        'adjustment_in',
        _it.quantity * c.quantity,
        0,
        'Anulación venta ' || _sale_id::text
      )
      FROM public.combo_components c
      WHERE c.combo_id = _it.product_id;
    ELSE
      PERFORM public.record_inventory_movement(
        _it.product_id,
        'adjustment_in',
        _it.quantity,
        COALESCE(_it.unit_cost_usd, 0),
        'Anulación venta ' || _sale_id::text
      );
    END IF;
  END LOOP;

  -- Remove any receivable created from this sale (credit sales)
  DELETE FROM public.receivables
  WHERE tenant_id = _tenant
    AND description LIKE 'Venta #' || (SELECT sale_number FROM public.sales WHERE id = _sale_id) || ' a crédito%';

  UPDATE public.sales
    SET voided_at = now(), voided_by = auth.uid(), void_reason = _reason
  WHERE id = _sale_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;
