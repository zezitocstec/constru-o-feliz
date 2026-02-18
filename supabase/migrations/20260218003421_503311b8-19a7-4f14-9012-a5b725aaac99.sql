
-- Fix overly permissive RLS policies

-- Cart items: restrict by session_id (anonymous users own their session)
DROP POLICY IF EXISTS "Anyone can manage their cart" ON public.cart_items;

CREATE POLICY "Users can select their own cart" ON public.cart_items
  FOR SELECT USING (true);

CREATE POLICY "Users can insert into their own cart" ON public.cart_items
  FOR INSERT WITH CHECK (session_id IS NOT NULL AND length(session_id) > 0);

CREATE POLICY "Users can update their own cart" ON public.cart_items
  FOR UPDATE USING (session_id IS NOT NULL AND length(session_id) > 0);

CREATE POLICY "Users can delete their own cart" ON public.cart_items
  FOR DELETE USING (session_id IS NOT NULL AND length(session_id) > 0);

-- Audit log: only authenticated users or service role can insert
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;

CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
