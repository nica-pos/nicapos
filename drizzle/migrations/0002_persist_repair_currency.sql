ALTER TABLE public.repair_orders ADD COLUMN currency text NOT NULL DEFAULT 'USD', ADD COLUMN exchange_rate numeric NOT NULL DEFAULT 36.62, ADD COLUMN total_amount numeric NOT NULL DEFAULT 0, ADD COLUMN paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.repair_orders ADD CONSTRAINT repair_currency_valid CHECK (currency IN ('USD','NIO')), ADD CONSTRAINT repair_rate_positive CHECK (exchange_rate > 0);
UPDATE public.repair_orders o SET currency = CASE WHEN EXISTS (SELECT 1 FROM public.repair_quotes q WHERE q.order_id=o.id AND q.note LIKE 'Pactado al ingreso en NIO:%') THEN 'NIO' ELSE 'USD' END, exchange_rate = coalesce((SELECT p.exchange_rate FROM public.repair_payments p WHERE p.order_id=o.id AND p.exchange_rate>0 ORDER BY p.created_at LIMIT 1),(SELECT e.rate FROM public.exchange_rates e WHERE e.tenant_id=o.tenant_id AND e.rate>0 ORDER BY e.effective_date DESC LIMIT 1),36.62);
UPDATE public.repair_orders o SET total_amount = CASE WHEN currency='NIO' THEN coalesce((SELECT replace(substring(q.note FROM 'C\$ ([0-9,.]+)'),',','')::numeric FROM public.repair_quotes q WHERE q.order_id=o.id AND q.note LIKE 'Pactado al ingreso en NIO:%' ORDER BY q.version DESC LIMIT 1),round(total_usd*exchange_rate,2)) ELSE total_usd END, paid_amount = coalesce((SELECT sum(CASE WHEN p.currency=o.currency THEN p.amount WHEN o.currency='NIO' THEN p.amount_usd*o.exchange_rate ELSE p.amount_usd END) FROM public.repair_payments p WHERE p.order_id=o.id),CASE WHEN currency='NIO' THEN paid_usd*exchange_rate ELSE paid_usd END);
CREATE OR REPLACE FUNCTION public.sync_repair_currency_amounts() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.currency='USD' THEN NEW.total_amount:=NEW.total_usd; NEW.paid_amount:=NEW.paid_usd;
 ELSE
  IF NEW.total_usd IS DISTINCT FROM OLD.total_usd AND round(NEW.total_amount/NEW.exchange_rate,2) IS DISTINCT FROM NEW.total_usd THEN NEW.total_amount:=round(NEW.total_usd*NEW.exchange_rate,2); END IF;
  IF NEW.paid_usd IS DISTINCT FROM OLD.paid_usd THEN SELECT coalesce(sum(CASE WHEN p.currency='NIO' THEN p.amount ELSE p.amount_usd*NEW.exchange_rate END),0) INTO NEW.paid_amount FROM public.repair_payments p WHERE p.order_id=NEW.id; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER sync_repair_currency_amounts BEFORE UPDATE ON public.repair_orders FOR EACH ROW EXECUTE FUNCTION public.sync_repair_currency_amounts();
DO $$ DECLARE def text; BEGIN
 def:=pg_get_functiondef('public.create_repair_order(uuid,uuid,jsonb,text,uuid)'::regprocedure);
 def:=replace(def,'created_by, photo_paths)','created_by, photo_paths, currency, exchange_rate, total_amount)');
 def:=replace(def,'coalesce(ARRAY(SELECT jsonb_array_elements_text(_data->''photo_paths'')), ''{}''))','coalesce(ARRAY(SELECT jsonb_array_elements_text(_data->''photo_paths'')), ''{}''), coalesce(_data->>''currency'',''USD''), coalesce((_data->>''exchange_rate'')::numeric,36.62), coalesce((_data->>''total_amount'')::numeric,0))');
 EXECUTE def;
 def:=pg_get_functiondef('public.record_repair_payment(uuid,numeric,text,text,text)'::regprocedure);
 def:=replace(def,'SELECT rate INTO _rate FROM public.exchange_rates WHERE tenant_id = _o.tenant_id ORDER BY effective_date DESC, created_at DESC LIMIT 1;','_rate := _o.exchange_rate;');
 EXECUTE def;
END $$;