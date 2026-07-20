
-- Enforce max_cashiers on tenant_members
CREATE OR REPLACE FUNCTION public.enforce_cashier_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max int;
  _count int;
BEGIN
  IF NEW.role <> 'cashier' THEN
    RETURN NEW;
  END IF;

  -- If updating and role was already cashier for same user/tenant, allow
  IF TG_OP = 'UPDATE' AND OLD.role = 'cashier' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.max_cashiers, 1) INTO _max
  FROM public.tenants t
  LEFT JOIN public.plans p ON p.id = t.plan_id
  WHERE t.id = NEW.tenant_id;

  IF _max IS NULL THEN _max := 1; END IF;

  SELECT count(*) INTO _count
  FROM public.tenant_members
  WHERE tenant_id = NEW.tenant_id AND role = 'cashier';

  IF _count >= _max THEN
    RAISE EXCEPTION 'Tu plan permite % cajero(s). Sube de plan para agregar más.', _max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cashier_limit ON public.tenant_members;
CREATE TRIGGER trg_enforce_cashier_limit
  BEFORE INSERT OR UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cashier_limit();

-- Enforce max_products on products
CREATE OR REPLACE FUNCTION public.enforce_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max int;
  _count int;
BEGIN
  SELECT COALESCE(p.max_products, 50) INTO _max
  FROM public.tenants t
  LEFT JOIN public.plans p ON p.id = t.plan_id
  WHERE t.id = NEW.tenant_id;

  IF _max IS NULL THEN _max := 50; END IF;

  SELECT count(*) INTO _count
  FROM public.products
  WHERE tenant_id = NEW.tenant_id;

  IF _count >= _max THEN
    RAISE EXCEPTION 'Tu plan permite % producto(s). Sube de plan para agregar más.', _max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_product_limit ON public.products;
CREATE TRIGGER trg_enforce_product_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_limit();
