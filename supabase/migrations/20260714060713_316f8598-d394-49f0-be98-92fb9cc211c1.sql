-- ============ PRODUCTS (minimal catalog for POS) ============
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku text,
  barcode text,
  name text NOT NULL,
  category text,
  brand text,
  model text,
  price_usd numeric(12,2) NOT NULL DEFAULT 0,
  is_tax_exempt boolean NOT NULL DEFAULT false,
  stock numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_products_barcode ON public.products(tenant_id, barcode);
CREATE INDEX idx_products_name ON public.products(tenant_id, name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view products" ON public.products FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members update products" ON public.products FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members delete products" ON public.products FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CASH SESSIONS ============
CREATE TABLE public.cash_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_by uuid NOT NULL REFERENCES auth.users(id),
  opening_nio numeric(12,2) NOT NULL DEFAULT 0,
  opening_usd numeric(12,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id),
  counted_nio numeric(12,2),
  counted_usd numeric(12,2),
  closed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_sessions_tenant ON public.cash_sessions(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view cash_sessions" ON public.cash_sessions FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert cash_sessions" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) AND opened_by = auth.uid());
CREATE POLICY "Members update cash_sessions" ON public.cash_sessions FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_cash_sessions_updated_at BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CASH MOVEMENTS ============
CREATE TABLE public.cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NIO' CHECK (currency IN ('NIO','USD')),
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_session ON public.cash_movements(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view cash_movements" ON public.cash_movements FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert cash_movements" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) AND created_by = auth.uid());

-- ============ SALES ============
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  sale_number bigint NOT NULL,
  subtotal_usd numeric(12,2) NOT NULL DEFAULT 0,
  tax_usd numeric(12,2) NOT NULL DEFAULT 0,
  total_usd numeric(12,2) NOT NULL DEFAULT 0,
  exchange_rate numeric(12,4) NOT NULL DEFAULT 0,
  sold_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_tenant ON public.sales(tenant_id, created_at DESC);
CREATE UNIQUE INDEX idx_sales_number ON public.sales(tenant_id, sale_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view sales" ON public.sales FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) AND sold_by = auth.uid());

-- ============ SALE ITEMS ============
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price_usd numeric(12,2) NOT NULL DEFAULT 0,
  tax_usd numeric(12,2) NOT NULL DEFAULT 0,
  line_total_usd numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view sale_items" ON public.sale_items FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ============ SALE PAYMENTS (mixed payment) ============
CREATE TABLE public.sale_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash_nio','cash_usd','card','transfer')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NIO' CHECK (currency IN ('NIO','USD')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_payments_sale ON public.sale_payments(sale_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view sale_payments" ON public.sale_payments FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert sale_payments" ON public.sale_payments FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));