
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS tracking_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_phone text,
  ADD COLUMN IF NOT EXISTS delivery_notes text;
