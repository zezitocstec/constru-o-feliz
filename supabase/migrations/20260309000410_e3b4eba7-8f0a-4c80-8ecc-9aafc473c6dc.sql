CREATE TABLE public.pdv_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'itsega4PDV',
  company_cnpj TEXT NOT NULL DEFAULT '00.000.000/0001-00',
  company_address TEXT NOT NULL DEFAULT 'Endereço da Empresa, 123 - Cidade/UF',
  company_phone TEXT NOT NULL DEFAULT '(00) 0000-0000',
  company_logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pdv_settings_single_row_idx ON public.pdv_settings((true));

ALTER TABLE public.pdv_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pdv settings" 
ON public.pdv_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view pdv settings" 
ON public.pdv_settings 
FOR SELECT 
USING (true);

INSERT INTO public.pdv_settings (company_name) VALUES ('itsega4PDV');