
-- =========================================================
-- MULTI-SUCURSAL: base de datos
-- =========================================================

-- 1) Límite por plan
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_branches int NOT NULL DEFAULT 1;

-- 2) Tabla de sucursales
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches: members read"
  ON public.branches FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "branches: owner/admin manage"
  ON public.branches FOR ALL TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner'::tenant_role)
    OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::tenant_role)
  )
  WITH CHECK (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner'::tenant_role)
    OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::tenant_role)
  );

-- Solo una sucursal por defecto por tenant
CREATE UNIQUE INDEX IF NOT EXISTS branches_one_default_per_tenant
  ON public.branches(tenant_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS branches_tenant_active_idx
  ON public.branches(tenant_id) WHERE is_active;

CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Crear sucursal principal para cada tenant existente
INSERT INTO public.branches (tenant_id, name, is_default, is_active)
SELECT t.id, 'Principal', true, true
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.tenant_id = t.id);

-- 4) Trigger: auto-crear sucursal principal en cada tenant nuevo
CREATE OR REPLACE FUNCTION public.create_default_branch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.branches (tenant_id, name, is_default, is_active)
  VALUES (NEW.id, 'Principal', true, true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tenants_create_default_branch ON public.tenants;
CREATE TRIGGER tenants_create_default_branch
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_branch();

-- 5) Validación del límite por plan (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.enforce_branch_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _max int;
  _count int;
BEGIN
  SELECT COALESCE(p.max_branches, 1) INTO _max
  FROM public.tenants t
  LEFT JOIN public.plans p ON p.id = t.plan_id
  WHERE t.id = NEW.tenant_id;

  IF _max IS NULL THEN _max := 1; END IF;

  SELECT count(*) INTO _count
  FROM public.branches
  WHERE tenant_id = NEW.tenant_id AND is_active;

  IF _count >= _max THEN
    RAISE EXCEPTION 'Tu plan permite % sucursal(es). Sube de plan para agregar más.', _max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS branches_enforce_limit ON public.branches;
CREATE TRIGGER branches_enforce_limit
  BEFORE INSERT ON public.branches
  FOR EACH ROW
  WHEN (NEW.is_active AND NEW.is_default IS DISTINCT FROM true)
  EXECUTE FUNCTION public.enforce_branch_limit();

-- Helper para el frontend
CREATE OR REPLACE FUNCTION public.can_create_branch(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*) FROM public.branches WHERE tenant_id = _tenant_id AND is_active
  ) < COALESCE(
    (SELECT p.max_branches FROM public.tenants t LEFT JOIN public.plans p ON p.id = t.plan_id WHERE t.id = _tenant_id),
    1
  )
$$;

-- 6) Añadir branch_id a tablas operativas + backfill + NOT NULL
DO $$
DECLARE _default_branch uuid;
BEGIN
  -- sales
  ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
  UPDATE public.sales s SET branch_id = b.id
    FROM public.branches b WHERE b.tenant_id = s.tenant_id AND b.is_default AND s.branch_id IS NULL;
  ALTER TABLE public.sales ALTER COLUMN branch_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS sales_branch_idx ON public.sales(branch_id);

  -- cash_sessions
  ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
  UPDATE public.cash_sessions s SET branch_id = b.id
    FROM public.branches b WHERE b.tenant_id = s.tenant_id AND b.is_default AND s.branch_id IS NULL;
  ALTER TABLE public.cash_sessions ALTER COLUMN branch_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS cash_sessions_branch_idx ON public.cash_sessions(branch_id);

  -- cash_movements
  ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
  UPDATE public.cash_movements s SET branch_id = b.id
    FROM public.branches b WHERE b.tenant_id = s.tenant_id AND b.is_default AND s.branch_id IS NULL;
  ALTER TABLE public.cash_movements ALTER COLUMN branch_id SET NOT NULL;

  -- inventory_movements
  ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
  UPDATE public.inventory_movements s SET branch_id = b.id
    FROM public.branches b WHERE b.tenant_id = s.tenant_id AND b.is_default AND s.branch_id IS NULL;
  ALTER TABLE public.inventory_movements ALTER COLUMN branch_id SET NOT NULL;

  -- stock_audits
  ALTER TABLE public.stock_audits ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
  UPDATE public.stock_audits s SET branch_id = b.id
    FROM public.branches b WHERE b.tenant_id = s.tenant_id AND b.is_default AND s.branch_id IS NULL;
  ALTER TABLE public.stock_audits ALTER COLUMN branch_id SET NOT NULL;

  -- layaways
  ALTER TABLE public.layaways ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
  UPDATE public.layaways s SET branch_id = b.id
    FROM public.branches b WHERE b.tenant_id = s.tenant_id AND b.is_default AND s.branch_id IS NULL;
  ALTER TABLE public.layaways ALTER COLUMN branch_id SET NOT NULL;

  -- purchase_orders (opcional, nullable: la compra puede aún no estar recibida)
  ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
END $$;

-- 7) Stock por sucursal
CREATE TABLE IF NOT EXISTS public.product_stock (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stock numeric NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, branch_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO authenticated;
GRANT ALL ON public.product_stock TO service_role;

ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_stock: members access"
  ON public.product_stock FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS product_stock_branch_idx ON public.product_stock(branch_id);
CREATE INDEX IF NOT EXISTS product_stock_tenant_idx ON public.product_stock(tenant_id);

-- Backfill: por cada producto, una fila en la sucursal por defecto
INSERT INTO public.product_stock (product_id, branch_id, tenant_id, stock, cost_usd)
SELECT p.id, b.id, p.tenant_id, COALESCE(p.stock, 0), COALESCE(p.cost_usd, 0)
FROM public.products p
JOIN public.branches b ON b.tenant_id = p.tenant_id AND b.is_default
ON CONFLICT DO NOTHING;

-- 8) Actualizar record_inventory_movement para usar product_stock por sucursal
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  _product_id uuid,
  _movement_type text,
  _quantity numeric,
  _unit_cost numeric DEFAULT 0,
  _reference text DEFAULT NULL::text,
  _branch_id uuid DEFAULT NULL
)
RETURNS inventory_movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  -- Si no se pasó branch, usar la por defecto del tenant
  IF _branch IS NULL THEN
    SELECT id INTO _branch FROM public.branches WHERE tenant_id = _tenant_id AND is_default LIMIT 1;
  END IF;

  -- Asegurar fila en product_stock
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

  IF _signed > 0 AND _unit_cost > 0 THEN
    _new_cost := ((_cur_qty * _cur_cost) + (_signed * _unit_cost)) / NULLIF(_new_qty, 0);
  ELSE
    _new_cost := _cur_cost;
  END IF;
  _new_cost := COALESCE(_new_cost, _cur_cost);

  UPDATE public.product_stock
    SET stock = _new_qty, cost_usd = _new_cost, updated_at = now()
  WHERE product_id = _product_id AND branch_id = _branch;

  -- Mantener totales en products (suma / promedio ponderado a nivel tienda)
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

-- 9) Traslado entre sucursales
CREATE OR REPLACE FUNCTION public.transfer_stock(
  _product_id uuid, _from_branch uuid, _to_branch uuid, _quantity numeric, _note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT stock INTO _stock FROM public.product_stock WHERE product_id = _product_id AND branch_id = _from_branch;
  IF COALESCE(_stock, 0) < _quantity THEN RAISE EXCEPTION 'Stock insuficiente en sucursal origen'; END IF;

  PERFORM public.record_inventory_movement(_product_id, 'transfer_out', _quantity, 0,
    COALESCE(_note, 'Traslado a sucursal'), _from_branch);
  PERFORM public.record_inventory_movement(_product_id, 'transfer_in', _quantity, 0,
    COALESCE(_note, 'Traslado desde sucursal'), _to_branch);
END; $$;

-- 10) Asignación de sucursal a miembros (para cashier)
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- 11) Defaults de max_branches para planes existentes (los dejo en 1 salvo que ya vengan editados)
-- (no cambia nada porque el default es 1)

-- 12) Impedir eliminar la sucursal por defecto o la última activa
CREATE OR REPLACE FUNCTION public.protect_default_branch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN RAISE EXCEPTION 'No puedes eliminar la sucursal principal'; END IF;
    IF (SELECT count(*) FROM public.branches WHERE tenant_id = OLD.tenant_id AND is_active AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Debe quedar al menos una sucursal activa';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: si se está desactivando
  IF OLD.is_active AND NOT NEW.is_active THEN
    IF (SELECT count(*) FROM public.branches WHERE tenant_id = OLD.tenant_id AND is_active AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Debe quedar al menos una sucursal activa';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS branches_protect ON public.branches;
CREATE TRIGGER branches_protect
  BEFORE UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.protect_default_branch();
