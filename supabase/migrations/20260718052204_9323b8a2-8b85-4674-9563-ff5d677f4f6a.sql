
CREATE TABLE public.trial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  business_name text NOT NULL,
  city text,
  country text,
  ip_address text,
  user_agent text,
  latitude numeric,
  longitude numeric,
  location_accuracy numeric,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_requests TO authenticated;
GRANT ALL ON public.trial_requests TO service_role;

ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;

-- Only superadmin can read / update / delete
CREATE POLICY "Superadmin manages trial requests"
  ON public.trial_requests FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE INDEX idx_trial_requests_status ON public.trial_requests (status, created_at DESC);
CREATE INDEX idx_trial_requests_email ON public.trial_requests (lower(email));
CREATE INDEX idx_trial_requests_ip ON public.trial_requests (ip_address);

CREATE TRIGGER trial_requests_updated_at
  BEFORE UPDATE ON public.trial_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public submission via SECURITY DEFINER (called from public server route with service key OR
-- from anon-authenticated context). We keep it SECURITY DEFINER and grant EXECUTE to anon.
CREATE OR REPLACE FUNCTION public.submit_trial_request(
  _full_name text, _email text, _phone text, _business_name text,
  _city text, _country text, _ip_address text, _user_agent text,
  _latitude numeric, _longitude numeric, _location_accuracy numeric, _notes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _email IS NULL OR position('@' in _email) < 2 THEN
    RAISE EXCEPTION 'Correo inválido';
  END IF;
  IF _business_name IS NULL OR length(trim(_business_name)) < 2 THEN
    RAISE EXCEPTION 'Nombre del negocio inválido';
  END IF;

  -- Cancel out any prior pending request for same email so admin only sees the latest
  UPDATE public.trial_requests
     SET status = 'rejected',
         rejection_reason = 'Reemplazada por una solicitud más reciente',
         reviewed_at = now()
   WHERE lower(email) = lower(_email) AND status = 'pending';

  INSERT INTO public.trial_requests (
    full_name, email, phone, business_name, city, country,
    ip_address, user_agent, latitude, longitude, location_accuracy, notes
  ) VALUES (
    trim(_full_name), lower(trim(_email)), _phone, trim(_business_name), _city, _country,
    _ip_address, _user_agent, _latitude, _longitude, _location_accuracy, _notes
  ) RETURNING id INTO _id;
  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.submit_trial_request(text,text,text,text,text,text,text,text,numeric,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_trial_request(text,text,text,text,text,text,text,text,numeric,numeric,numeric,text) TO anon, authenticated, service_role;

-- Superadmin approval: creates tenant with 7-day trial for an existing auth user id.
-- User creation itself needs the Auth Admin API (service role) so it stays in a server fn;
-- this function just wires the tenant + marks the request.
CREATE OR REPLACE FUNCTION public.approve_trial_request(
  _request_id uuid, _owner_user_id uuid, _tenant_name text,
  _plan_id uuid, _trial_days int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant_id uuid; _slug text;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo superadmin';
  END IF;

  _slug := regexp_replace(lower(_tenant_name), '[^a-z0-9]+', '-', 'g');
  _slug := trim(both '-' from _slug);
  IF _slug = '' THEN _slug := 'tienda'; END IF;
  _slug := _slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.tenants (name, slug, status, plan_id, owner_id, trial_ends_at)
  VALUES (_tenant_name, _slug, 'trial', _plan_id, _owner_user_id,
          now() + make_interval(days => coalesce(_trial_days, 7)))
  RETURNING id INTO _tenant_id;

  UPDATE public.trial_requests
     SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
         approved_tenant_id = _tenant_id
   WHERE id = _request_id;

  RETURN _tenant_id;
END; $$;

REVOKE ALL ON FUNCTION public.approve_trial_request(uuid,uuid,text,uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_trial_request(uuid,uuid,text,uuid,int) TO authenticated, service_role;
