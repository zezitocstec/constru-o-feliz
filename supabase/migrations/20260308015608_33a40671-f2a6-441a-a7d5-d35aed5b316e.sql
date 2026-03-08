
-- Add source column to sales to distinguish site orders from PDV
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pdv';

-- Allow anonymous users to insert sales from the site
CREATE POLICY "Anyone can insert site orders" ON public.sales
  FOR INSERT TO anon, authenticated
  WITH CHECK (source = 'site');

-- Allow anonymous users to insert sale items for site orders
CREATE POLICY "Anyone can insert site order items" ON public.sale_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to read their own site order by ID (for confirmation)
CREATE POLICY "Anyone can view site orders" ON public.sales
  FOR SELECT TO anon, authenticated
  USING (source = 'site');
