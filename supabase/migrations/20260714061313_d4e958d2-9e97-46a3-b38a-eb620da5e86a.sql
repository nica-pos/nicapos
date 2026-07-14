-- ========== CATEGORIES / BRANDS / MODELS ==========
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage categories" ON public.categories FOR ALL TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_brands_tenant ON public.brands(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage brands" ON public.brands FOR ALL TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_models (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_models_tenant ON public.product_models(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_models TO authenticated;
GRANT ALL ON public.product_models TO service_role;
ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage models" ON public.product_models FOR ALL TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON public.product_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== EXTEND PRODUCTS ==========
ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN model_id uuid REFERENCES public.product_models(id) ON DELETE SET NULL,
  ADD COLUMN min_stock numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN cost_usd numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN is_combo boolean NOT NULL DEFAULT false;

-- ========== COMBO COMPONENTS ==========
CREATE TABLE public.combo_components (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  combo_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_combo_components_combo ON public.combo_components(combo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_components TO authenticated;
GRANT ALL ON public.combo_components TO service_role;
ALTER TABLE public.combo_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage combo_components" ON public.combo_components FOR ALL TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ========== PROMOTIONS ==========
CREATE TABLE public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','amount')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  starts_at date,
  ends_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promotions_tenant ON public.promotions(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage promotions" ON public.promotions FOR ALL TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== INVENTORY MOVEMENTS (KARDEX) ==========
CREATE TABLE public.inventory_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','sale','adjustment_in','adjustment_out','audit')),
  quantity numeric(12,2) NOT NULL,
  unit_cost_usd numeric(12,4) NOT NULL DEFAULT 0,
  balance_qty numeric(12,2) NOT NULL DEFAULT 0,
  avg_cost_usd numeric(12,4) NOT NULL DEFAULT 0,
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_mov_product ON public.inventory_movements(product_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view inventory_movements" ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert inventory_movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ========== STOCK AUDITS ==========
CREATE TABLE public.stock_audits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_audits_tenant ON public.stock_audits(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_audits TO authenticated;
GRANT ALL ON public.stock_audits TO service_role;
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view stock_audits" ON public.stock_audits FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members insert stock_audits" ON public.stock_audits FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) AND created_by = auth.uid());
CREATE POLICY "Members update stock_audits" ON public.stock_audits FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER update_stock_audits_updated_at BEFORE UPDATE ON public.stock_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_audit_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.stock_audits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  system_qty numeric(12,2) NOT NULL DEFAULT 0,
  counted_qty numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_items_audit ON public.stock_audit_items(audit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_audit_items TO authenticated;
GRANT ALL ON public.stock_audit_items TO service_role;
ALTER TABLE public.stock_audit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage stock_audit_items" ON public.stock_audit_items FOR ALL TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ========== CPP MOVEMENT FUNCTION ==========
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  _product_id uuid,
  _movement_type text,
  _quantity numeric,
  _unit_cost numeric DEFAULT 0,
  _reference text DEFAULT NULL
)
RETURNS public.inventory_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _cur_qty numeric;
  _cur_cost numeric;
  _new_qty numeric;
  _new_cost numeric;
  _signed numeric;
  _row public.inventory_movements;
BEGIN
  SELECT tenant_id, stock, cost_usd INTO _tenant_id, _cur_qty, _cur_cost
  FROM public.products WHERE id = _product_id;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- inbound movements are positive, outbound negative
  IF _movement_type IN ('purchase','adjustment_in') THEN
    _signed := abs(_quantity);
  ELSE
    _signed := -abs(_quantity);
  END IF;

  _new_qty := _cur_qty + _signed;

  -- Weighted average cost only recalculated on inbound with a cost
  IF _signed > 0 AND _unit_cost > 0 THEN
    _new_cost := ((_cur_qty * _cur_cost) + (_signed * _unit_cost)) / NULLIF(_new_qty, 0);
  ELSE
    _new_cost := _cur_cost;
  END IF;
  _new_cost := COALESCE(_new_cost, _cur_cost);

  UPDATE public.products
  SET stock = _new_qty, cost_usd = _new_cost, updated_at = now()
  WHERE id = _product_id;

  INSERT INTO public.inventory_movements (
    tenant_id, product_id, movement_type, quantity, unit_cost_usd,
    balance_qty, avg_cost_usd, reference, created_by
  ) VALUES (
    _tenant_id, _product_id, _movement_type, _signed,
    CASE WHEN _signed > 0 THEN _unit_cost ELSE _cur_cost END,
    _new_qty, _new_cost, _reference, auth.uid()
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text) TO authenticated;