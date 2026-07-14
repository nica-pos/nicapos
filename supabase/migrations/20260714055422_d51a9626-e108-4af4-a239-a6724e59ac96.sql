-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('superadmin', 'user');
CREATE TYPE public.tenant_role AS ENUM ('owner', 'admin', 'cashier', 'accountant');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- =========================================================
-- SHARED updated_at TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- TABLES (created first so functions can reference them)
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  max_products integer NOT NULL DEFAULT 100,
  max_cashiers integer NOT NULL DEFAULT 1,
  max_branches integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status public.subscription_status NOT NULL DEFAULT 'trial',
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ruc text,
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#f59e0b',
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL DEFAULT 'cashier',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenants_owner ON public.tenants(owner_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);

-- =========================================================
-- GRANTS
-- =========================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS (after tables exist)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'superadmin')
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = _user_id AND tenant_id = _tenant_id)
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role public.tenant_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role)
$$;

-- =========================================================
-- updated_at TRIGGERS
-- =========================================================
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenant_members_updated_at BEFORE UPDATE ON public.tenant_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS POLICIES: PROFILES
-- =========================================================
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_superadmin(auth.uid()))
WITH CHECK (id = auth.uid() OR public.is_superadmin(auth.uid()));

-- =========================================================
-- RLS POLICIES: USER ROLES
-- =========================================================
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- =========================================================
-- RLS POLICIES: PLANS
-- =========================================================
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT TO anon, authenticated
USING (is_active = true OR public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can manage plans" ON public.plans FOR ALL TO authenticated
USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- =========================================================
-- RLS POLICIES: TENANTS
-- =========================================================
CREATE POLICY "Members can view their tenant" ON public.tenants FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), id) OR owner_id = auth.uid() OR public.is_superadmin(auth.uid()));
CREATE POLICY "Users can create their own tenant" ON public.tenants FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner or admin can update tenant" ON public.tenants FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), id, 'admin') OR public.is_superadmin(auth.uid()))
WITH CHECK (owner_id = auth.uid() OR public.has_tenant_role(auth.uid(), id, 'admin') OR public.is_superadmin(auth.uid()));
CREATE POLICY "Owner or superadmin can delete tenant" ON public.tenants FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.is_superadmin(auth.uid()));

-- =========================================================
-- RLS POLICIES: TENANT MEMBERS
-- =========================================================
CREATE POLICY "Members can view co-members" ON public.tenant_members FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "Owner or admin can add members" ON public.tenant_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin') OR public.is_superadmin(auth.uid())
);
CREATE POLICY "Owner or admin can update members" ON public.tenant_members FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin') OR public.is_superadmin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin') OR public.is_superadmin(auth.uid())
);
CREATE POLICY "Owner or admin can remove members" ON public.tenant_members FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR public.has_tenant_role(auth.uid(), tenant_id, 'admin') OR public.is_superadmin(auth.uid())
);

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- WHEN A TENANT IS CREATED, MAKE OWNER A MEMBER
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant();

-- =========================================================
-- SEED DEFAULT PLANS
-- =========================================================
INSERT INTO public.plans (name, slug, price_usd, max_products, max_cashiers, max_branches, sort_order) VALUES
  ('Emprendedor', 'emprendedor', 15.00, 200, 1, 1, 1),
  ('Negocio', 'negocio', 35.00, 2000, 3, 2, 2),
  ('Empresa', 'empresa', 75.00, 999999, 10, 10, 3);