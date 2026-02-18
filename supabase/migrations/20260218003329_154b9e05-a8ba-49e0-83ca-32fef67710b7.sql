
-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text,
  color text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default categories
INSERT INTO public.categories (name, icon, color) VALUES
  ('Alvenaria', 'hammer', '#F97316'),
  ('Tintas', 'paintbrush', '#3B82F6'),
  ('Ferramentas', 'wrench', '#6B7280'),
  ('Elétrica', 'zap', '#EAB308'),
  ('Hidráulica', 'droplets', '#06B6D4'),
  ('Madeiras', 'trees', '#92400E'),
  ('Segurança', 'shield', '#EC4899'),
  ('Iluminação', 'lightbulb', '#F59E0B')
ON CONFLICT (name) DO NOTHING;

-- Stock movements table (entradas e saídas)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste')),
  quantity integer NOT NULL,
  previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0,
  reason text,
  reference_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stock movements" ON public.stock_movements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Product managers can manage stock movements" ON public.stock_movements
  FOR ALL USING (has_role(auth.uid(), 'product_manager'::app_role));

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" ON public.audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- Cart items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage their cart" ON public.cart_items
  FOR ALL USING (true);

-- Product managers can manage products
CREATE POLICY "Product managers can manage products" ON public.products
  FOR ALL USING (has_role(auth.uid(), 'product_manager'::app_role));

-- Trigger to update cart_items updated_at
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON public.cart_items(session_id);
