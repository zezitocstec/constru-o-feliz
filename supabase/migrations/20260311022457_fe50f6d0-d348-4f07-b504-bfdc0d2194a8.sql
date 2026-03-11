
-- Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE,
  name text NOT NULL,
  trade_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  cep text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Product managers can view suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'product_manager'::app_role));

-- Add fiscal fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS cst text,
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'UN';

-- Supplier-product relationship (tracks which supplier provides which product, with supplier-specific info)
CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_product_code text,
  supplier_price numeric NOT NULL DEFAULT 0,
  last_purchase_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, product_id)
);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier_products" ON public.supplier_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Product managers can view supplier_products" ON public.supplier_products FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'product_manager'::app_role));

-- XML import log
CREATE TABLE public.xml_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id),
  nfe_number text,
  nfe_series text,
  nfe_key text,
  total_value numeric NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid,
  raw_xml text
);

ALTER TABLE public.xml_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage xml_imports" ON public.xml_imports FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
