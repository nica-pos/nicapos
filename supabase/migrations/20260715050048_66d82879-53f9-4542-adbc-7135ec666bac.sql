
CREATE TABLE public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.tenant_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (tenant_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitations TO authenticated;
GRANT ALL ON public.tenant_invitations TO service_role;

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view their invitations"
  ON public.tenant_invitations FOR SELECT TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR
    public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

CREATE POLICY "Tenant admins can create invitations"
  ON public.tenant_invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR
    public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

CREATE POLICY "Tenant admins can delete invitations"
  ON public.tenant_invitations FOR DELETE TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'owner') OR
    public.has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

CREATE INDEX idx_tenant_invitations_email ON public.tenant_invitations (lower(email)) WHERE status = 'pending';

-- Extend handle_new_user to auto-accept pending invitations for the new user's email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _inv record;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auto-accept any pending invitations addressed to this email
  FOR _inv IN
    SELECT id, tenant_id, role FROM public.tenant_invitations
    WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  LOOP
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (_inv.tenant_id, NEW.id, _inv.role)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    UPDATE public.tenant_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _inv.id;
  END LOOP;

  RETURN NEW;
END;
$function$;
