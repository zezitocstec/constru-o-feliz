
-- Step 1: Add product_manager role to enum (must be in its own transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'product_manager';
