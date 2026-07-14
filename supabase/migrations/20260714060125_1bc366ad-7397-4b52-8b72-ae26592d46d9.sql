-- =========================================================
-- FISCAL SETTINGS (one per tenant)
-- =========================================================
CREATE TABLE public.fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  iva_rate numeric(5,4) NOT NULL DEFAULT 0.1500,
  iva_enabled boolean NOT NULL DEFAULT true,
  ir_rate numeric(5,4) NOT NULL DEFAULT 0.0200,
  ir_enabled boolean NOT NULL DEFAULT false,
  legal_name text,
  address text,
  phone text,
  email text,
  invoice_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;
ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_fiscal_settings_updated_at
BEFORE UPDATE ON public.fiscal_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view fiscal settings" ON public.fiscal_settings FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "Owner or admin can insert fiscal settings" ON public.fiscal_settings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);
CREATE POLICY "Owner or admin can update fiscal settings" ON public.fiscal_settings FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

-- =========================================================
-- EXCHANGE RATES (historical, NIO per 1 USD)
-- =========================================================
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rate numeric(10,4) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, effective_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_exchange_rates_tenant_date ON public.exchange_rates(tenant_id, effective_date DESC);

CREATE POLICY "Members can view exchange rates" ON public.exchange_rates FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "Owner or admin can insert exchange rates" ON public.exchange_rates FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);
CREATE POLICY "Owner or admin can update exchange rates" ON public.exchange_rates FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);
CREATE POLICY "Owner or admin can delete exchange rates" ON public.exchange_rates FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin')
);

-- =========================================================
-- AUTO-CREATE FISCAL SETTINGS ON TENANT CREATION
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.fiscal_settings (tenant_id, legal_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill fiscal settings for existing tenants
INSERT INTO public.fiscal_settings (tenant_id, legal_name)
SELECT id, name FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;