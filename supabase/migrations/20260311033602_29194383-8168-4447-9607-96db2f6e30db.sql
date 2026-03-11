
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can manage quote_items" ON public.quote_items;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Admins can manage quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage quote_items"
ON public.quote_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
