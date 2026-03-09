
-- Fix sales policies: drop restrictive and recreate as permissive
DROP POLICY IF EXISTS "Anyone can insert site orders" ON public.sales;
DROP POLICY IF EXISTS "Anyone can view site orders" ON public.sales;
DROP POLICY IF EXISTS "Admins can manage sales" ON public.sales;

CREATE POLICY "Admins can manage sales" ON public.sales FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert site orders" ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (source = 'site'::text);

CREATE POLICY "Anyone can view site orders" ON public.sales FOR SELECT TO anon, authenticated USING (source = 'site'::text);

-- Fix sale_items policies
DROP POLICY IF EXISTS "Anyone can insert site order items" ON public.sale_items;
DROP POLICY IF EXISTS "Admins can manage sale items" ON public.sale_items;

CREATE POLICY "Admins can manage sale items" ON public.sale_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert site order items" ON public.sale_items FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.source = 'site'::text));
