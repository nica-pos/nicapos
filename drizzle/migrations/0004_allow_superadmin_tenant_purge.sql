CREATE OR REPLACE FUNCTION public.protect_default_branch()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.purging_tenant', true) IS NOT NULL
     AND current_setting('app.purging_tenant', true) = COALESCE(OLD.tenant_id::text, '') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN RAISE EXCEPTION 'No puedes eliminar la sucursal principal'; END IF;
    IF (SELECT count(*) FROM public.branches WHERE tenant_id = OLD.tenant_id AND is_active AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Debe quedar al menos una sucursal activa';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_active AND NOT NEW.is_active THEN
    IF (SELECT count(*) FROM public.branches WHERE tenant_id = OLD.tenant_id AND is_active AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Debe quedar al menos una sucursal activa';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.log_audit_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid; _entity_id uuid; _details jsonb; _action text; _rec jsonb; _branch uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.purging_tenant', true) = OLD.tenant_id::text THEN RETURN OLD; END IF;
    _tenant := OLD.tenant_id; _entity_id := OLD.id; _rec := to_jsonb(OLD);
  ELSE
    _tenant := NEW.tenant_id; _entity_id := NEW.id; _rec := to_jsonb(NEW);
  END IF;
  IF _rec ? 'branch_id' AND _rec->>'branch_id' IS NOT NULL THEN _branch := (_rec->>'branch_id')::uuid; END IF;
  _action := lower(TG_OP);
  IF TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE' THEN
    IF NEW.price_usd = OLD.price_usd AND NEW.cost_usd = OLD.cost_usd THEN RETURN NEW; END IF;
    _details := jsonb_build_object('name', NEW.name,'old_price', OLD.price_usd, 'new_price', NEW.price_usd,'old_cost', OLD.cost_usd, 'new_cost', NEW.cost_usd);
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

CREATE OR REPLACE FUNCTION public.admin_purge_tenant(_tenant_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo el superadmin puede eliminar empresas';
  END IF;
  PERFORM set_config('app.purging_tenant', _tenant_id::text, true);
  UPDATE public.trial_requests SET approved_tenant_id = NULL WHERE approved_tenant_id = _tenant_id;
  UPDATE public.trial_requests SET pending_tenant_id = NULL WHERE pending_tenant_id = _tenant_id;
  DELETE FROM public.repair_payments WHERE tenant_id = _tenant_id;
  DELETE FROM public.repair_notes WHERE tenant_id = _tenant_id;
  DELETE FROM public.repair_status_history WHERE tenant_id = _tenant_id;
  DELETE FROM public.repair_quotes WHERE tenant_id = _tenant_id;
  DELETE FROM public.repair_parts WHERE tenant_id = _tenant_id;
  DELETE FROM public.repair_secrets WHERE tenant_id = _tenant_id;
  DELETE FROM public.repair_orders WHERE tenant_id = _tenant_id;
  DELETE FROM public.audit_logs WHERE tenant_id = _tenant_id;
  DELETE FROM public.tenants WHERE id = _tenant_id;
  DELETE FROM public.audit_logs WHERE tenant_id = _tenant_id;
  PERFORM set_config('app.purging_tenant', '', true);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.admin_purge_tenant(uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_tenant(uuid) TO service_role;