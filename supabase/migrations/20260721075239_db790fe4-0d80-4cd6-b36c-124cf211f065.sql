DO $$
DECLARE _pid uuid; _tid uuid; _bid uuid;
BEGIN
  SELECT p.id, p.tenant_id, ps.branch_id
    INTO _pid, _tid, _bid
  FROM public.products p
  JOIN public.product_stock ps ON ps.product_id = p.id
  WHERE p.name = 'iPhone 16 Pro' AND ps.stock < 0
  LIMIT 1;

  UPDATE public.product_stock SET stock = 0, updated_at = now()
   WHERE product_id = _pid AND branch_id = _bid;

  UPDATE public.products SET
    stock = COALESCE((SELECT sum(stock) FROM public.product_stock WHERE product_id = _pid), 0),
    updated_at = now()
  WHERE id = _pid;

  INSERT INTO public.inventory_movements
    (tenant_id, branch_id, product_id, movement_type, quantity, unit_cost_usd, balance_qty, avg_cost_usd, reference)
  VALUES
    (_tid, _bid, _pid, 'adjustment_in', 7, 0, 0, 0, 'Ajuste manual: corrección de stock negativo');
END $$;