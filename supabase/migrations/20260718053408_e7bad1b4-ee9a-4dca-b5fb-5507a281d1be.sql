
-- 2) Índice único parcial incluyendo el nuevo estado
DROP INDEX IF EXISTS public.one_active_tenant_per_owner;
CREATE UNIQUE INDEX one_active_tenant_per_owner
  ON public.tenants(owner_id)
  WHERE status IN ('trial','active','pending_payment','pending_verification','pending_trial_approval');

-- 3) Columnas nuevas en trial_requests
ALTER TABLE public.trial_requests
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trial_requests_owner ON public.trial_requests(owner_user_id);

-- Permitir al dueño ver su propia solicitud
DROP POLICY IF EXISTS "Owner can read own trial request" ON public.trial_requests;
CREATE POLICY "Owner can read own trial request"
  ON public.trial_requests FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- 4) Nueva RPC: el usuario registrado solicita su prueba
CREATE OR REPLACE FUNCTION public.request_trial_for_current_user(
  _tenant_name text,
  _phone text,
  _city text,
  _country text,
  _ip_address text,
  _user_agent text,
  _latitude numeric,
  _longitude numeric,
  _location_accuracy numeric,
  _notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _full_name text;
  _slug text;
  _tenant_id uuid;
  _req_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT email, coalesce(full_name, split_part(email,'@',1))
    INTO _email, _full_name
  FROM public.profiles WHERE id = _uid;

  IF _email IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  -- Bloqueo: solo una tienda activa por dueño
  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE owner_id = _uid
      AND status IN ('trial','active','pending_payment','pending_verification','pending_trial_approval')
  ) THEN
    RAISE EXCEPTION 'Ya tienes una tienda activa o pendiente.';
  END IF;

  _slug := regexp_replace(lower(_tenant_name), '[^a-z0-9]+', '-', 'g');
  _slug := trim(both '-' from _slug);
  IF _slug = '' THEN _slug := 'tienda'; END IF;
  _slug := _slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.tenants (name, slug, status, plan_id, owner_id, trial_ends_at)
  VALUES (_tenant_name, _slug, 'pending_trial_approval', NULL, _uid, NULL)
  RETURNING id INTO _tenant_id;

  INSERT INTO public.trial_requests (
    full_name, email, phone, business_name, city, country,
    ip_address, user_agent, latitude, longitude, location_accuracy, notes,
    owner_user_id, pending_tenant_id, status
  ) VALUES (
    _full_name, _email, _phone, _tenant_name, _city, _country,
    _ip_address, _user_agent, _latitude, _longitude, _location_accuracy, _notes,
    _uid, _tenant_id, 'pending'
  ) RETURNING id INTO _req_id;

  RETURN _tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_trial_for_current_user(text,text,text,text,text,text,numeric,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_trial_for_current_user(text,text,text,text,text,text,numeric,numeric,numeric,text) TO authenticated;

-- 5) Actualizar approve_trial_request: activar tenant existente si vino de onboarding
CREATE OR REPLACE FUNCTION public.approve_trial_request(
  _request_id uuid, _owner_user_id uuid, _tenant_name text, _plan_id uuid, _trial_days integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _tenant_id uuid; _slug text; _pending uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo superadmin';
  END IF;

  SELECT pending_tenant_id INTO _pending
  FROM public.trial_requests WHERE id = _request_id;

  IF _pending IS NOT NULL THEN
    -- Activar tienda ya creada por el usuario
    UPDATE public.tenants
      SET status = 'trial',
          plan_id = coalesce(_plan_id, plan_id),
          trial_ends_at = now() + make_interval(days => coalesce(_trial_days, 7)),
          updated_at = now()
    WHERE id = _pending;
    _tenant_id := _pending;
  ELSE
    _slug := regexp_replace(lower(_tenant_name), '[^a-z0-9]+', '-', 'g');
    _slug := trim(both '-' from _slug);
    IF _slug = '' THEN _slug := 'tienda'; END IF;
    _slug := _slug || '-' || substr(md5(random()::text), 1, 6);

    INSERT INTO public.tenants (name, slug, status, plan_id, owner_id, trial_ends_at)
    VALUES (_tenant_name, _slug, 'trial', _plan_id, _owner_user_id,
            now() + make_interval(days => coalesce(_trial_days, 7)))
    RETURNING id INTO _tenant_id;
  END IF;

  UPDATE public.trial_requests
     SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
         approved_tenant_id = _tenant_id
   WHERE id = _request_id;

  RETURN _tenant_id;
END; $$;

-- 6) Al rechazar, cancelar tienda pendiente asociada
CREATE OR REPLACE FUNCTION public.reject_trial_request(_request_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pending uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo superadmin';
  END IF;

  SELECT pending_tenant_id INTO _pending
  FROM public.trial_requests WHERE id = _request_id AND status = 'pending';

  UPDATE public.trial_requests
    SET status = 'rejected', rejection_reason = _reason,
        reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = _request_id AND status = 'pending';

  IF _pending IS NOT NULL THEN
    UPDATE public.tenants SET status = 'cancelled', updated_at = now()
    WHERE id = _pending;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.reject_trial_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_trial_request(uuid, text) TO authenticated;
