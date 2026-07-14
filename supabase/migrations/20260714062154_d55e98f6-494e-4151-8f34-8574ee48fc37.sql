-- ===== Módulo 5: Créditos, Apartados y Proveedores =====

-- Clientes (cuentas por cobrar)
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  ruc text,
  phone text,
  email text,
  address text,
  credit_limit_usd numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Suppliers (proveedores)
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  ruc text,
  phone text,
  email text,
  contact_name text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Cuentas por cobrar (crédito a clientes)
CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  description text,
  total_usd numeric NOT NULL DEFAULT 0,
  paid_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage receivables" ON public.receivables
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Abonos a cuentas por cobrar
CREATE TABLE public.receivable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  amount_usd numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivable_payments TO authenticated;
GRANT ALL ON public.receivable_payments TO service_role;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage receivable_payments" ON public.receivable_payments
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Apartados / Layaway
CREATE TABLE public.layaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_usd numeric NOT NULL DEFAULT 0,
  paid_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  expires_at date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layaways TO authenticated;
GRANT ALL ON public.layaways TO service_role;
ALTER TABLE public.layaways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage layaways" ON public.layaways
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.layaway_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  layaway_id uuid NOT NULL REFERENCES public.layaways(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_usd numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layaway_items TO authenticated;
GRANT ALL ON public.layaway_items TO service_role;
ALTER TABLE public.layaway_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage layaway_items" ON public.layaway_items
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.layaway_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  layaway_id uuid NOT NULL REFERENCES public.layaways(id) ON DELETE CASCADE,
  amount_usd numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layaway_payments TO authenticated;
GRANT ALL ON public.layaway_payments TO service_role;
ALTER TABLE public.layaway_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage layaway_payments" ON public.layaway_payments
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Pedidos a proveedores
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  po_number bigserial,
  total_usd numeric NOT NULL DEFAULT 0,
  paid_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  expected_at date,
  received_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost_usd numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage purchase_order_items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Abonos / pagos a proveedores (cuentas por pagar)
CREATE TABLE public.payable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  amount_usd numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payable_payments TO authenticated;
GRANT ALL ON public.payable_payments TO service_role;
ALTER TABLE public.payable_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage payable_payments" ON public.payable_payments
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- updated_at triggers
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_receivables_updated BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_layaways_updated BEFORE UPDATE ON public.layaways FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registrar abono a cuenta por cobrar (actualiza paid/status)
CREATE OR REPLACE FUNCTION public.record_receivable_payment(_receivable_id uuid, _amount numeric, _method text DEFAULT 'cash', _note text DEFAULT NULL)
RETURNS public.receivables
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid; _total numeric; _paid numeric; _row public.receivables;
BEGIN
  SELECT tenant_id, total_usd, paid_usd INTO _tenant, _total, _paid FROM public.receivables WHERE id = _receivable_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  INSERT INTO public.receivable_payments (tenant_id, receivable_id, amount_usd, method, note, created_by)
  VALUES (_tenant, _receivable_id, abs(_amount), _method, _note, auth.uid());
  _paid := _paid + abs(_amount);
  UPDATE public.receivables SET paid_usd = _paid,
    status = CASE WHEN _paid >= _total THEN 'paid' ELSE 'open' END, updated_at = now()
  WHERE id = _receivable_id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Registrar abono a apartado
CREATE OR REPLACE FUNCTION public.record_layaway_payment(_layaway_id uuid, _amount numeric, _method text DEFAULT 'cash', _note text DEFAULT NULL)
RETURNS public.layaways
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid; _total numeric; _paid numeric; _row public.layaways;
BEGIN
  SELECT tenant_id, total_usd, paid_usd INTO _tenant, _total, _paid FROM public.layaways WHERE id = _layaway_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Apartado no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  INSERT INTO public.layaway_payments (tenant_id, layaway_id, amount_usd, method, note, created_by)
  VALUES (_tenant, _layaway_id, abs(_amount), _method, _note, auth.uid());
  _paid := _paid + abs(_amount);
  UPDATE public.layaways SET paid_usd = _paid,
    status = CASE WHEN _paid >= _total THEN 'completed' ELSE 'active' END, updated_at = now()
  WHERE id = _layaway_id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Registrar pago a proveedor
CREATE OR REPLACE FUNCTION public.record_payable_payment(_po_id uuid, _amount numeric, _method text DEFAULT 'cash', _note text DEFAULT NULL)
RETURNS public.purchase_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid; _total numeric; _paid numeric; _row public.purchase_orders;
BEGIN
  SELECT tenant_id, total_usd, paid_usd INTO _tenant, _total, _paid FROM public.purchase_orders WHERE id = _po_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  INSERT INTO public.payable_payments (tenant_id, purchase_order_id, amount_usd, method, note, created_by)
  VALUES (_tenant, _po_id, abs(_amount), _method, _note, auth.uid());
  _paid := _paid + abs(_amount);
  UPDATE public.purchase_orders SET paid_usd = _paid, updated_at = now()
  WHERE id = _po_id RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Recibir pedido: registra entrada de inventario (CPP) por cada item y marca como recibido
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid)
RETURNS public.purchase_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid; _status text; _row public.purchase_orders; _it record;
BEGIN
  SELECT tenant_id, status INTO _tenant, _status FROM public.purchase_orders WHERE id = _po_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status = 'received' THEN RAISE EXCEPTION 'Pedido ya recibido'; END IF;
  FOR _it IN SELECT product_id, quantity, unit_cost_usd FROM public.purchase_order_items WHERE purchase_order_id = _po_id AND product_id IS NOT NULL LOOP
    PERFORM public.record_inventory_movement(_it.product_id, 'purchase', _it.quantity, _it.unit_cost_usd, 'PO ' || _po_id::text);
  END LOOP;
  UPDATE public.purchase_orders SET status = 'received', received_at = now(), updated_at = now()
  WHERE id = _po_id RETURNING * INTO _row;
  RETURN _row;
END; $$;