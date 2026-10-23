-- Permitir recibir pagos en efectivo de reparaciones sin obligar a tener abierta la caja del POS.
-- Si hay una sesión de caja de mostrador abierta en la sucursal, se registra el movimiento en ella;
-- si no hay sesión abierta, se registra el pago en repair_payments de forma independiente para el taller.

CREATE OR REPLACE FUNCTION public.record_repair_payment(
  _order_id uuid,
  _amount numeric,
  _method text,
  _currency text,
  _kind text DEFAULT 'advance'
)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.repair_orders; _rate numeric; _usd numeric; _session uuid; _cur text := _currency;
BEGIN
  PERFORM public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.status = 'cancelled' THEN RAISE EXCEPTION 'La orden está cancelada'; END IF;
  IF coalesce(_amount,0) <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF _method = 'cash_nio' THEN _cur := 'NIO'; ELSIF _method = 'cash_usd' THEN _cur := 'USD'; END IF;
  IF _cur NOT IN ('NIO','USD') THEN RAISE EXCEPTION 'Moneda inválida'; END IF;

  SELECT rate INTO _rate FROM public.exchange_rates WHERE tenant_id = _o.tenant_id ORDER BY effective_date DESC, created_at DESC LIMIT 1;
  IF _cur = 'NIO' AND coalesce(_rate,0) <= 0 THEN RAISE EXCEPTION 'Configurá el tipo de cambio antes de cobrar en córdobas'; END IF;
  _usd := round(CASE WHEN _cur = 'USD' THEN _amount ELSE _amount / _rate END, 2);
  IF _o.total_usd > 0 AND _usd > (_o.total_usd - _o.paid_usd) + 0.01 THEN
    RAISE EXCEPTION 'El pago supera el saldo pendiente ($%)', round(_o.total_usd - _o.paid_usd, 2);
  END IF;

  IF _method IN ('cash_nio','cash_usd') THEN
    SELECT id INTO _session FROM public.cash_sessions WHERE branch_id = _o.branch_id AND status = 'open' ORDER BY opened_at DESC LIMIT 1;
    -- Si la caja de la sucursal está abierta, registra el movimiento en ella.
    -- Si no hay caja abierta, permite recibir el pago directamente para el taller sin bloquear la entrega.
    IF _session IS NOT NULL THEN
      INSERT INTO public.cash_movements (tenant_id, session_id, branch_id, type, amount, currency, reason, created_by)
      VALUES (_o.tenant_id, _session, _o.branch_id, 'income', _amount, _cur,
        'Reparación REP-' || lpad(_o.order_number::text, 5, '0') || CASE WHEN _kind = 'advance' THEN ' (anticipo)' ELSE ' (pago)' END, auth.uid());
    END IF;
  END IF;

  INSERT INTO public.repair_payments (tenant_id, order_id, branch_id, kind, method, amount, currency, amount_usd, exchange_rate, cash_session_id, created_by)
  VALUES (_o.tenant_id, _order_id, _o.branch_id, CASE WHEN _kind = 'final' THEN 'final' ELSE 'advance' END, _method, _amount, _cur, _usd, coalesce(_rate,1), _session, auth.uid());
  
  UPDATE public.repair_orders SET paid_usd = paid_usd + _usd, updated_at = now() WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;
