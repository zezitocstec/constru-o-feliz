
-- Drop the overly permissive policy and replace with a more secure one
DROP POLICY IF EXISTS "Anyone can insert site order items" ON public.sale_items;

-- Only allow inserting sale items for site orders
CREATE POLICY "Anyone can insert site order items" ON public.sale_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales 
      WHERE sales.id = sale_id 
      AND sales.source = 'site'
    )
  );
