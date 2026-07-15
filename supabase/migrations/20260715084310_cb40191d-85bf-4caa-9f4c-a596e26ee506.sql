
-- 1. Añadir estados al enum
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending_verification';

-- 2. Tabla bank_accounts
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL DEFAULT 'savings',
  currency text NOT NULL CHECK (currency IN ('NIO','USD')),
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can view active bank accounts"
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (is_active = true OR public.is_superadmin(auth.uid()));

CREATE POLICY "superadmin can manage bank accounts"
  ON public.bank_accounts FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabla payment_submissions
CREATE TABLE public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL CHECK (currency IN ('NIO','USD')),
  reference text,
  receipt_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  months_covered integer,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_submissions_tenant ON public.payment_submissions(tenant_id);
CREATE INDEX idx_payment_submissions_status ON public.payment_submissions(status);

GRANT SELECT, INSERT ON public.payment_submissions TO authenticated;
GRANT ALL ON public.payment_submissions TO service_role;

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view own tenant submissions"
  ON public.payment_submissions FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "members can insert own tenant submissions"
  ON public.payment_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) AND submitted_by = auth.uid());

CREATE POLICY "superadmin can update submissions"
  ON public.payment_submissions FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE TRIGGER payment_submissions_updated_at
  BEFORE UPDATE ON public.payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS policies on storage.objects for payment-receipts bucket
-- Path convention: <tenant_id>/<filename>
CREATE POLICY "tenant members can upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND public.is_tenant_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "tenant members can view own receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      public.is_superadmin(auth.uid())
      OR public.is_tenant_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    )
  );

CREATE POLICY "superadmin can delete receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.is_superadmin(auth.uid()));
