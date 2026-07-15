
-- 1) Payment provider settings (superadmin-only)
CREATE TABLE public.payment_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox','live')),
  client_id text,
  client_secret_ciphertext text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_provider_settings TO authenticated;
GRANT ALL ON public.payment_provider_settings TO service_role;

ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin manages provider settings"
  ON public.payment_provider_settings
  FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER trg_payment_provider_settings_updated
  BEFORE UPDATE ON public.payment_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rows so the admin UI can just toggle/edit them
INSERT INTO public.payment_provider_settings (provider, is_enabled, mode)
VALUES ('paypal', false, 'sandbox'), ('stripe', false, 'live')
ON CONFLICT (provider) DO NOTHING;


-- 2) Tenant subscriptions
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  provider text NOT NULL CHECK (provider IN ('stripe','paypal','manual')),
  external_customer_id text,
  external_subscription_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','past_due','canceled','failed','trialing')),
  current_period_end timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_subscription_id)
);

CREATE INDEX idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read their subscription"
  ON public.tenant_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin manages subscriptions"
  ON public.tenant_subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER trg_tenant_subscriptions_updated
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
