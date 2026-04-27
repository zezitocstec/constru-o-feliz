ALTER TABLE public.pdv_settings
  ADD COLUMN IF NOT EXISTS manager_whatsapp text,
  ADD COLUMN IF NOT EXISTS manager_email text,
  ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_summary_last_sent_at timestamp with time zone;