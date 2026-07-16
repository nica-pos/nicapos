ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'USD'
  CHECK (price_currency IN ('USD','NIO'));