-- Costo unitario en líneas de venta (para COGS)
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS unit_cost_usd numeric NOT NULL DEFAULT 0;

-- ===== Bitácora de auditoría =====
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins/owners de la tienda pueden ver la bitácora
CREATE POLICY "tenant admins read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);

-- Función de trigger genérica de auditoría
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant uuid;
  _entity_id uuid;
  _details jsonb;
  _action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant := OLD.tenant_id;
    _entity_id := OLD.id;
  ELSE
    _tenant := NEW.tenant_id;
    _entity_id := NEW.id;
  END IF;

  _action := lower(TG_OP);

  IF TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE' THEN
    -- Solo registrar cambios de precio o costo (antifraude)
    IF NEW.price_usd = OLD.price_usd AND NEW.cost_usd = OLD.cost_usd THEN
      RETURN NEW;
    END IF;
    _details := jsonb_build_object(
      'name', NEW.name,
      'old_price', OLD.price_usd, 'new_price', NEW.price_usd,
      'old_cost', OLD.cost_usd, 'new_cost', NEW.cost_usd
    );
  ELSIF TG_TABLE_NAME = 'sales' THEN
    _details := jsonb_build_object('sale_number', NEW.sale_number, 'total_usd', NEW.total_usd);
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    _details := jsonb_build_object('type', NEW.type, 'amount', NEW.amount, 'currency', NEW.currency, 'reason', NEW.reason);
  ELSIF TG_TABLE_NAME = 'receivable_payments' THEN
    _details := jsonb_build_object('amount_usd', NEW.amount_usd, 'method', NEW.method);
  ELSIF TG_TABLE_NAME = 'payable_payments' THEN
    _details := jsonb_build_object('amount_usd', NEW.amount_usd, 'method', NEW.method);
  ELSIF TG_TABLE_NAME = 'stock_audits' THEN
    _details := to_jsonb(NEW) - 'tenant_id';
  ELSE
    _details := '{}'::jsonb;
  END IF;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, details)
  VALUES (_tenant, auth.uid(), _action, TG_TABLE_NAME, _entity_id, COALESCE(_details, '{}'::jsonb));

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

-- Disparadores
CREATE TRIGGER audit_sales AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_cash_movements AFTER INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_products AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_receivable_payments AFTER INSERT ON public.receivable_payments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_payable_payments AFTER INSERT ON public.payable_payments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_stock_audits AFTER INSERT OR UPDATE ON public.stock_audits
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();