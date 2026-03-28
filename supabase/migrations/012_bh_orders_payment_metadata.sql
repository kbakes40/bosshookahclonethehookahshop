-- Plaid Transfer (and future) payment metadata — IDs, transfer status, etc. No raw bank numbers.
ALTER TABLE public.bh_orders
  ADD COLUMN IF NOT EXISTS payment_metadata jsonb;
