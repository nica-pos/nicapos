
-- ===== Tables =====
CREATE TABLE public.repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  order_number bigint NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  brand text NOT NULL,
  model text NOT NULL,
  color text,
  imei text,
  reported_issue text NOT NULL,
  accessories text,
  physical_condition text,
  observations text,
  photo_paths text[] NOT NULL DEFAULT '{}',
  estimated_delivery date,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','diagnosing','waiting_approval','waiting_parts','in_repair','ready','delivered','cancelled')),
  technician_id uuid,
  diagnosis text,
  work_to_do text,
  labor_usd numeric NOT NULL DEFAULT 0,
  parts_usd numeric NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  quote_status text NOT NULL DEFAULT 'none' CHECK (quote_status IN ('none','pending','approved','rejected')),
  paid_usd numeric NOT NULL DEFAULT 0,
  parts_cost_usd numeric NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  delivered_by uuid,
  delivery_exception_reason text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);
CREATE INDEX repair_orders_tenant_branch_idx ON public.repair_orders(tenant_id, branch_id, status);
CREATE INDEX repair_orders_tech_idx ON public.repair_orders(technician_id);

CREATE TABLE public.repair_secrets (
  order_id uuid PRIMARY KEY REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  unlock_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.repair_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  version int NOT NULL,
  labor_usd numeric NOT NULL DEFAULT 0,
  parts_usd numeric NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.repair_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price_usd numeric NOT NULL DEFAULT 0,
  unit_cost_usd numeric NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  consumed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.repair_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.repair_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.repair_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('advance','final')),
  method text NOT NULL CHECK (method IN ('cash_nio','cash_usd','card','transfer')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency IN ('NIO','USD')),
  amount_usd numeric NOT NULL,
  exchange_rate numeric NOT NULL DEFAULT 1,
  cash_session_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.repair_orders, public.repair_secrets, public.repair_quotes, public.repair_parts,
  public.repair_status_history, public.repair_notes, public.repair_payments TO authenticated;
GRANT ALL ON public.repair_orders, public.repair_secrets, public.repair_quotes, public.repair_parts,
  public.repair_status_history, public.repair_notes, public.repair_payments TO service_role;

ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_payments ENABLE ROW LEVEL SECURITY;

-- ===== Access helpers =====
CREATE OR REPLACE FUNCTION public.can_view_repair(_uid uuid, _order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.repair_orders o
    JOIN public.tenant_members m ON m.tenant_id = o.tenant_id AND m.user_id = _uid
    WHERE o.id = _order_id
      AND public.can_access_branch(_uid, o.branch_id)
      AND (m.role <> 'technician' OR o.technician_id = _uid OR o.created_by = _uid)
  )
$$;

CREATE OR REPLACE FUNCTION public._repair_guard(_order_id uuid, _allow_accountant boolean DEFAULT false)
RETURNS public.tenant_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.tenant_role; _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.repair_orders WHERE id = _order_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF NOT public.can_view_repair(auth.uid(), _order_id) THEN RAISE EXCEPTION 'No tenés permiso sobre esta orden'; END IF;
  SELECT role INTO _role FROM public.tenant_members WHERE tenant_id = _tenant AND user_id = auth.uid();
  IF _role = 'accountant' AND NOT _allow_accountant THEN RAISE EXCEPTION 'El rol contador solo puede consultar'; END IF;
  RETURN _role;
END $$;

CREATE POLICY "repair_orders_select" ON public.repair_orders FOR SELECT TO authenticated
USING (
  public.can_access_branch(auth.uid(), branch_id) AND EXISTS (
    SELECT 1 FROM public.tenant_members m
    WHERE m.tenant_id = repair_orders.tenant_id AND m.user_id = auth.uid()
      AND (m.role <> 'technician' OR repair_orders.technician_id = auth.uid() OR repair_orders.created_by = auth.uid())
  )
);
CREATE POLICY "repair_secrets_select" ON public.repair_secrets FOR SELECT TO authenticated
USING (
  public.can_view_repair(auth.uid(), order_id) AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.repair_orders o WHERE o.id = order_id AND o.technician_id = auth.uid())
  )
);
CREATE POLICY "repair_quotes_select" ON public.repair_quotes FOR SELECT TO authenticated USING (public.can_view_repair(auth.uid(), order_id));
CREATE POLICY "repair_parts_select" ON public.repair_parts FOR SELECT TO authenticated USING (public.can_view_repair(auth.uid(), order_id));
CREATE POLICY "repair_history_select" ON public.repair_status_history FOR SELECT TO authenticated USING (public.can_view_repair(auth.uid(), order_id));
CREATE POLICY "repair_notes_select" ON public.repair_notes FOR SELECT TO authenticated USING (public.can_view_repair(auth.uid(), order_id));
CREATE POLICY "repair_payments_select" ON public.repair_payments FOR SELECT TO authenticated USING (public.can_view_repair(auth.uid(), order_id));

-- Allow repair stock movements
ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_movements_movement_type_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY['purchase','sale','adjustment_in','adjustment_out','audit','repair_out','repair_return','transfer_in','transfer_out']));

CREATE OR REPLACE FUNCTION public._repair_log(_o public.repair_orders, _to text, _note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.repair_status_history (tenant_id, order_id, from_status, to_status, note, changed_by)
  VALUES (_o.tenant_id, _o.id, _o.status, _to, _note, auth.uid());
$$;

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.create_repair_order(_branch_id uuid, _customer_id uuid, _data jsonb, _unlock_code text DEFAULT NULL, _technician_id uuid DEFAULT NULL)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid; _role public.tenant_role; _num bigint; _o public.repair_orders; _tech uuid := _technician_id;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.branches WHERE id = _branch_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Sucursal no encontrada'; END IF;
  SELECT role INTO _role FROM public.tenant_members WHERE tenant_id = _tenant AND user_id = auth.uid();
  IF _role IS NULL OR _role = 'accountant' THEN RAISE EXCEPTION 'No autorizado para crear órdenes'; END IF;
  IF NOT public.can_access_branch(auth.uid(), _branch_id) THEN RAISE EXCEPTION 'No tenés acceso a esta sucursal'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id AND tenant_id = _tenant) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  IF coalesce(trim(_data->>'brand'),'') = '' OR coalesce(trim(_data->>'model'),'') = '' OR coalesce(trim(_data->>'reported_issue'),'') = '' THEN
    RAISE EXCEPTION 'Marca, modelo y falla reportada son obligatorios';
  END IF;
  IF _role = 'technician' THEN _tech := auth.uid(); END IF;
  IF _tech IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant AND user_id = _tech) THEN
    RAISE EXCEPTION 'Técnico inválido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('repair-' || _tenant::text));
  SELECT coalesce(max(order_number), 0) + 1 INTO _num FROM public.repair_orders WHERE tenant_id = _tenant;

  INSERT INTO public.repair_orders (tenant_id, branch_id, order_number, customer_id, brand, model, color, imei,
    reported_issue, accessories, physical_condition, observations, estimated_delivery, technician_id, created_by, photo_paths)
  VALUES (_tenant, _branch_id, _num, _customer_id, trim(_data->>'brand'), trim(_data->>'model'), nullif(_data->>'color',''),
    nullif(_data->>'imei',''), trim(_data->>'reported_issue'), nullif(_data->>'accessories',''), nullif(_data->>'physical_condition',''),
    nullif(_data->>'observations',''), nullif(_data->>'estimated_delivery','')::date, _tech, auth.uid(),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(_data->'photo_paths')), '{}'))
  RETURNING * INTO _o;

  IF coalesce(trim(_unlock_code),'') <> '' THEN
    INSERT INTO public.repair_secrets (order_id, tenant_id, unlock_code) VALUES (_o.id, _tenant, trim(_unlock_code));
  END IF;
  INSERT INTO public.repair_status_history (tenant_id, order_id, from_status, to_status, note, changed_by)
  VALUES (_tenant, _o.id, NULL, 'received', 'Equipo recibido', auth.uid());
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.update_repair_order(_order_id uuid, _data jsonb)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.tenant_role; _o public.repair_orders;
BEGIN
  _role := public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.status IN ('delivered','cancelled') AND _role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'La orden está cerrada';
  END IF;
  IF _data ? 'technician_id' AND _role = 'technician' AND nullif(_data->>'technician_id','')::uuid IS DISTINCT FROM _o.technician_id THEN
    RAISE EXCEPTION 'Solo un administrador puede reasignar el técnico';
  END IF;
  IF _data ? 'technician_id' AND nullif(_data->>'technician_id','') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = _o.tenant_id AND user_id = (_data->>'technician_id')::uuid) THEN
    RAISE EXCEPTION 'Técnico inválido';
  END IF;

  UPDATE public.repair_orders SET
    brand = CASE WHEN _data ? 'brand' THEN coalesce(nullif(trim(_data->>'brand'),''), brand) ELSE brand END,
    model = CASE WHEN _data ? 'model' THEN coalesce(nullif(trim(_data->>'model'),''), model) ELSE model END,
    color = CASE WHEN _data ? 'color' THEN nullif(_data->>'color','') ELSE color END,
    imei = CASE WHEN _data ? 'imei' THEN nullif(_data->>'imei','') ELSE imei END,
    reported_issue = CASE WHEN _data ? 'reported_issue' THEN coalesce(nullif(trim(_data->>'reported_issue'),''), reported_issue) ELSE reported_issue END,
    accessories = CASE WHEN _data ? 'accessories' THEN nullif(_data->>'accessories','') ELSE accessories END,
    physical_condition = CASE WHEN _data ? 'physical_condition' THEN nullif(_data->>'physical_condition','') ELSE physical_condition END,
    observations = CASE WHEN _data ? 'observations' THEN nullif(_data->>'observations','') ELSE observations END,
    estimated_delivery = CASE WHEN _data ? 'estimated_delivery' THEN nullif(_data->>'estimated_delivery','')::date ELSE estimated_delivery END,
    diagnosis = CASE WHEN _data ? 'diagnosis' THEN nullif(_data->>'diagnosis','') ELSE diagnosis END,
    work_to_do = CASE WHEN _data ? 'work_to_do' THEN nullif(_data->>'work_to_do','') ELSE work_to_do END,
    technician_id = CASE WHEN _data ? 'technician_id' THEN nullif(_data->>'technician_id','')::uuid ELSE technician_id END,
    photo_paths = CASE WHEN _data ? 'photo_paths' THEN coalesce(ARRAY(SELECT jsonb_array_elements_text(_data->'photo_paths')), '{}') ELSE photo_paths END,
    updated_at = now()
  WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.save_repair_quote(_order_id uuid, _labor numeric, _parts jsonb, _skip_approval boolean DEFAULT false, _note text DEFAULT NULL)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.tenant_role; _o public.repair_orders; _p jsonb; _parts_total numeric; _total numeric; _ver int;
BEGIN
  _role := public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.status IN ('delivered','cancelled') AND _role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'La orden está cerrada'; END IF;
  IF _o.status = 'cancelled' THEN RAISE EXCEPTION 'La orden está cancelada'; END IF;
  IF _skip_approval AND _role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Solo un administrador puede corregir precios sin aprobación'; END IF;
  IF coalesce(_labor,0) < 0 THEN RAISE EXCEPTION 'Mano de obra inválida'; END IF;

  -- Reemplaza repuestos no consumidos; los consumidos se conservan.
  DELETE FROM public.repair_parts WHERE order_id = _order_id AND NOT consumed;
  FOR _p IN SELECT * FROM jsonb_array_elements(coalesce(_parts,'[]'::jsonb)) LOOP
    IF coalesce((_p->>'quantity')::numeric,0) <= 0 OR coalesce(trim(_p->>'name'),'') = '' THEN
      RAISE EXCEPTION 'Cada repuesto necesita nombre y cantidad';
    END IF;
    IF (_p->>'id') IS NOT NULL AND EXISTS (SELECT 1 FROM public.repair_parts WHERE id = (_p->>'id')::uuid AND order_id = _order_id AND consumed) THEN
      -- Precio de un repuesto ya consumido: solo admin lo corrige
      IF _role IN ('owner','admin') THEN
        UPDATE public.repair_parts SET unit_price_usd = greatest(0, coalesce((_p->>'unit_price_usd')::numeric,0))
        WHERE id = (_p->>'id')::uuid;
      END IF;
      CONTINUE;
    END IF;
    INSERT INTO public.repair_parts (tenant_id, order_id, product_id, name, quantity, unit_price_usd, created_by)
    VALUES (_o.tenant_id, _order_id, nullif(_p->>'product_id','')::uuid, trim(_p->>'name'), (_p->>'quantity')::numeric,
      greatest(0, coalesce((_p->>'unit_price_usd')::numeric,0)), auth.uid());
  END LOOP;

  SELECT coalesce(sum(quantity * unit_price_usd),0) INTO _parts_total FROM public.repair_parts WHERE order_id = _order_id;
  _total := round(coalesce(_labor,0) + _parts_total, 2);

  SELECT coalesce(max(version),0) + 1 INTO _ver FROM public.repair_quotes WHERE order_id = _order_id;
  UPDATE public.repair_quotes SET status = 'superseded' WHERE order_id = _order_id AND status = 'pending';

  IF _skip_approval OR (_o.quote_status = 'approved' AND _total = _o.total_usd) THEN
    INSERT INTO public.repair_quotes (tenant_id, order_id, version, labor_usd, parts_usd, total_usd, status, note, decided_by, decided_at, created_by)
    VALUES (_o.tenant_id, _order_id, _ver, coalesce(_labor,0), _parts_total, _total, 'approved',
      coalesce(_note, CASE WHEN _skip_approval THEN 'Corrección administrativa' ELSE 'Sin cambio de precio' END), auth.uid(), now(), auth.uid());
    UPDATE public.repair_orders SET labor_usd = coalesce(_labor,0), parts_usd = _parts_total, total_usd = _total,
      quote_status = CASE WHEN _skip_approval THEN 'approved' ELSE quote_status END, updated_at = now()
    WHERE id = _order_id RETURNING * INTO _o;
    IF _skip_approval THEN
      PERFORM public._repair_log(_o, _o.status, 'Precio corregido por administrador: $' || _total::text || coalesce(' — ' || _note, ''));
    END IF;
  ELSE
    INSERT INTO public.repair_quotes (tenant_id, order_id, version, labor_usd, parts_usd, total_usd, status, note, created_by)
    VALUES (_o.tenant_id, _order_id, _ver, coalesce(_labor,0), _parts_total, _total, 'pending', _note, auth.uid());
    PERFORM public._repair_log(_o, 'waiting_approval', 'Cotización v' || _ver || ': $' || _total::text);
    UPDATE public.repair_orders SET labor_usd = coalesce(_labor,0), parts_usd = _parts_total, total_usd = _total,
      quote_status = 'pending', status = 'waiting_approval', updated_at = now()
    WHERE id = _order_id RETURNING * INTO _o;
  END IF;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.decide_repair_quote(_order_id uuid, _approved boolean, _note text DEFAULT NULL)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.repair_orders; _to text;
BEGIN
  PERFORM public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.quote_status <> 'pending' THEN RAISE EXCEPTION 'No hay cotización pendiente de aprobación'; END IF;
  UPDATE public.repair_quotes SET status = CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
    decided_by = auth.uid(), decided_at = now(), note = coalesce(_note, note)
  WHERE order_id = _order_id AND status = 'pending';
  _to := CASE WHEN _approved THEN
           CASE WHEN EXISTS (SELECT 1 FROM public.repair_parts WHERE order_id = _order_id AND NOT consumed) THEN 'waiting_parts' ELSE 'in_repair' END
         ELSE 'diagnosing' END;
  PERFORM public._repair_log(_o, _to, CASE WHEN _approved THEN 'Cliente aprobó la cotización' ELSE 'Cliente rechazó la cotización' END || coalesce(' — ' || _note, ''));
  UPDATE public.repair_orders SET quote_status = CASE WHEN _approved THEN 'approved' ELSE 'rejected' END, status = _to, updated_at = now()
  WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.change_repair_status(_order_id uuid, _status text, _note text DEFAULT NULL)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.repair_orders;
BEGIN
  PERFORM public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'La orden está cerrada'; END IF;
  IF _status NOT IN ('received','diagnosing','waiting_parts','in_repair','ready') THEN
    RAISE EXCEPTION 'Usá la acción correspondiente para este estado';
  END IF;
  IF _status IN ('waiting_parts','in_repair','ready') AND _o.quote_status <> 'approved' THEN
    RAISE EXCEPTION 'El cliente debe aprobar la cotización antes de continuar';
  END IF;
  IF _status = _o.status THEN RETURN _o; END IF;
  PERFORM public._repair_log(_o, _status, _note);
  UPDATE public.repair_orders SET status = _status, updated_at = now() WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.consume_repair_part(_part_id uuid)
RETURNS public.repair_parts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.repair_parts; _o public.repair_orders; _cost numeric;
BEGIN
  SELECT * INTO _p FROM public.repair_parts WHERE id = _part_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Repuesto no encontrado'; END IF;
  PERFORM public._repair_guard(_p.order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _p.order_id FOR UPDATE;
  IF _o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'La orden está cerrada'; END IF;
  IF _o.quote_status <> 'approved' THEN RAISE EXCEPTION 'No se descuentan repuestos sin cotización aprobada'; END IF;
  IF _p.consumed THEN RAISE EXCEPTION 'Este repuesto ya fue descontado'; END IF;

  IF _p.product_id IS NOT NULL THEN
    SELECT cost_usd INTO _cost FROM public.product_stock WHERE product_id = _p.product_id AND branch_id = _o.branch_id;
    PERFORM public.record_inventory_movement(_p.product_id, 'repair_out', _p.quantity, 0,
      'Reparación REP-' || lpad(_o.order_number::text, 5, '0'), _o.branch_id);
  END IF;
  UPDATE public.repair_parts SET consumed = true, consumed_at = now(), unit_cost_usd = coalesce(_cost, unit_cost_usd)
  WHERE id = _part_id RETURNING * INTO _p;
  UPDATE public.repair_orders SET parts_cost_usd = (
      SELECT coalesce(sum(quantity * unit_cost_usd),0) FROM public.repair_parts WHERE order_id = _o.id AND consumed),
    updated_at = now() WHERE id = _o.id;
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.set_repair_part_cost(_part_id uuid, _unit_cost numeric)
RETURNS public.repair_parts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.repair_parts; _role public.tenant_role;
BEGIN
  SELECT * INTO _p FROM public.repair_parts WHERE id = _part_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Repuesto no encontrado'; END IF;
  _role := public._repair_guard(_p.order_id);
  IF _p.product_id IS NOT NULL AND _role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Solo un administrador corrige el costo de repuestos de inventario';
  END IF;
  UPDATE public.repair_parts SET unit_cost_usd = greatest(0, coalesce(_unit_cost,0)) WHERE id = _part_id RETURNING * INTO _p;
  UPDATE public.repair_orders SET parts_cost_usd = (
      SELECT coalesce(sum(quantity * unit_cost_usd),0) FROM public.repair_parts WHERE order_id = _p.order_id AND consumed),
    updated_at = now() WHERE id = _p.order_id;
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.record_repair_payment(_order_id uuid, _amount numeric, _method text, _currency text, _kind text DEFAULT 'advance')
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
    IF _session IS NULL THEN RAISE EXCEPTION 'Abrí la caja de esta sucursal para recibir efectivo'; END IF;
    INSERT INTO public.cash_movements (tenant_id, session_id, branch_id, type, amount, currency, reason, created_by)
    VALUES (_o.tenant_id, _session, _o.branch_id, 'income', _amount, _cur,
      'Reparación REP-' || lpad(_o.order_number::text, 5, '0') || CASE WHEN _kind = 'advance' THEN ' (anticipo)' ELSE ' (pago)' END, auth.uid());
  END IF;

  INSERT INTO public.repair_payments (tenant_id, order_id, branch_id, kind, method, amount, currency, amount_usd, exchange_rate, cash_session_id, created_by)
  VALUES (_o.tenant_id, _order_id, _o.branch_id, CASE WHEN _kind = 'final' THEN 'final' ELSE 'advance' END, _method, _amount, _cur, _usd, coalesce(_rate,1), _session, auth.uid());
  UPDATE public.repair_orders SET paid_usd = paid_usd + _usd, updated_at = now() WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.deliver_repair(_order_id uuid, _exception_reason text DEFAULT NULL)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.tenant_role; _o public.repair_orders; _bal numeric;
BEGIN
  _role := public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.status <> 'ready' THEN RAISE EXCEPTION 'Solo se entregan órdenes listas para entregar'; END IF;
  _bal := round(_o.total_usd - _o.paid_usd, 2);
  IF _bal > 0.009 THEN
    IF _role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'La orden tiene saldo pendiente ($%). Solo un administrador puede autorizar la entrega', _bal; END IF;
    IF coalesce(trim(_exception_reason),'') = '' THEN RAISE EXCEPTION 'Indicá el motivo de la excepción'; END IF;
  END IF;
  PERFORM public._repair_log(_o, 'delivered', CASE WHEN _bal > 0.009 THEN 'Entregado con saldo pendiente: ' || _exception_reason ELSE 'Entregado' END);
  UPDATE public.repair_orders SET status = 'delivered', delivered_at = now(), delivered_by = auth.uid(),
    delivery_exception_reason = CASE WHEN _bal > 0.009 THEN trim(_exception_reason) END, updated_at = now()
  WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_repair(_order_id uuid, _reason text)
RETURNS public.repair_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.repair_orders; _p public.repair_parts;
BEGIN
  PERFORM public._repair_guard(_order_id);
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id FOR UPDATE;
  IF _o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'La orden ya está cerrada'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Indicá el motivo de cancelación'; END IF;
  FOR _p IN SELECT * FROM public.repair_parts WHERE order_id = _order_id AND consumed AND product_id IS NOT NULL LOOP
    PERFORM public.record_inventory_movement(_p.product_id, 'repair_return', _p.quantity, _p.unit_cost_usd,
      'Devolución reparación REP-' || lpad(_o.order_number::text, 5, '0'), _o.branch_id);
  END LOOP;
  UPDATE public.repair_parts SET consumed = false, consumed_at = NULL WHERE order_id = _order_id AND consumed;
  UPDATE public.repair_quotes SET status = 'rejected', decided_by = auth.uid(), decided_at = now() WHERE order_id = _order_id AND status = 'pending';
  PERFORM public._repair_log(_o, 'cancelled', _reason);
  UPDATE public.repair_orders SET status = 'cancelled', cancelled_at = now(), cancel_reason = trim(_reason),
    parts_cost_usd = 0, quote_status = CASE WHEN quote_status = 'pending' THEN 'rejected' ELSE quote_status END, updated_at = now()
  WHERE id = _order_id RETURNING * INTO _o;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.add_repair_note(_order_id uuid, _note text)
RETURNS public.repair_notes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.repair_orders; _n public.repair_notes;
BEGIN
  PERFORM public._repair_guard(_order_id, true);
  IF coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'La nota está vacía'; END IF;
  SELECT * INTO _o FROM public.repair_orders WHERE id = _order_id;
  INSERT INTO public.repair_notes (tenant_id, order_id, note, created_by) VALUES (_o.tenant_id, _order_id, trim(_note), auth.uid()) RETURNING * INTO _n;
  RETURN _n;
END $$;

-- repair_return must add stock: extend record_inventory_movement in-list
DO $$
DECLARE _def text;
BEGIN
  SELECT pg_get_functiondef('public.record_inventory_movement'::regproc) INTO _def;
  _def := replace(_def, $q$IN ('purchase','adjustment_in','transfer_in')$q$, $q$IN ('purchase','adjustment_in','transfer_in','repair_return')$q$);
  EXECUTE _def;
END $$;

REVOKE ALL ON FUNCTION public.can_view_repair(uuid, uuid), public._repair_guard(uuid, boolean), public._repair_log(public.repair_orders, text, text),
  public.create_repair_order(uuid, uuid, jsonb, text, uuid), public.update_repair_order(uuid, jsonb),
  public.save_repair_quote(uuid, numeric, jsonb, boolean, text), public.decide_repair_quote(uuid, boolean, text),
  public.change_repair_status(uuid, text, text), public.consume_repair_part(uuid), public.set_repair_part_cost(uuid, numeric),
  public.record_repair_payment(uuid, numeric, text, text, text), public.deliver_repair(uuid, text),
  public.cancel_repair(uuid, text), public.add_repair_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_repair(uuid, uuid),
  public.create_repair_order(uuid, uuid, jsonb, text, uuid), public.update_repair_order(uuid, jsonb),
  public.save_repair_quote(uuid, numeric, jsonb, boolean, text), public.decide_repair_quote(uuid, boolean, text),
  public.change_repair_status(uuid, text, text), public.consume_repair_part(uuid), public.set_repair_part_cost(uuid, numeric),
  public.record_repair_payment(uuid, numeric, text, text, text), public.deliver_repair(uuid, text),
  public.cancel_repair(uuid, text), public.add_repair_note(uuid, text) TO authenticated;

-- ===== Storage policies (repair-photos/{tenant_id}/...) =====
CREATE POLICY "repair_photos_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'repair-photos' AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "repair_photos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'repair-photos' AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "repair_photos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'repair-photos' AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
