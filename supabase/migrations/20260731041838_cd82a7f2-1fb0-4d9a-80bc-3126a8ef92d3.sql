ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON public.audit_logs(branch_id);

CREATE OR REPLACE FUNCTION public.log_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _entity_id uuid;
  _details jsonb;
  _action text;
  _rec jsonb;
  _branch uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant := OLD.tenant_id;
    _entity_id := OLD.id;
    _rec := to_jsonb(OLD);
  ELSE
    _tenant := NEW.tenant_id;
    _entity_id := NEW.id;
    _rec := to_jsonb(NEW);
  END IF;

  IF _rec ? 'branch_id' AND _rec->>'branch_id' IS NOT NULL THEN
    _branch := (_rec->>'branch_id')::uuid;
  END IF;

  _action := lower(TG_OP);

  IF TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE' THEN
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

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, details, branch_id)
  VALUES (_tenant, auth.uid(), _action, TG_TABLE_NAME, _entity_id, COALESCE(_details, '{}'::jsonb), _branch);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $function$;