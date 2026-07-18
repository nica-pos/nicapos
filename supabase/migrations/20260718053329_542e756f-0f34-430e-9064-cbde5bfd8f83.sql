
-- 1) Nuevo estado
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending_trial_approval';
