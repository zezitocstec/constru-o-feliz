#!/bin/bash
# =============================================================
# MD DEPÓSITO - Deploy Completo para Supabase Self-Hosted
# Este script cria toda a estrutura necessária e faz deploy
# das Edge Functions no servidor self-hosted.
#
# Uso: chmod +x deploy-selfhost.sh && ./deploy-selfhost.sh
# =============================================================

set -e

# ===================== CONFIGURAÇÃO =====================
SUPABASE_API_URL="${SUPABASE_API_URL:-https://sb.sega4.com.br}"
PROJECT_REF="${PROJECT_REF:-default}"
BASE_DIR="$(pwd)/supabase-selfhost-deploy"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  MD DEPÓSITO - Deploy Completo Supabase Self-Hosted   ${NC}"
echo -e "${CYAN}======================================================${NC}"
echo ""
echo "API URL:     $SUPABASE_API_URL"
echo "Project Ref: $PROJECT_REF"
echo "Output Dir:  $BASE_DIR"
echo ""

# ===================== CRIAR ESTRUTURA =====================
echo -e "${YELLOW}[1/5] Criando estrutura de diretórios...${NC}"
rm -rf "$BASE_DIR"
mkdir -p "$BASE_DIR/supabase/functions/chatbot"
mkdir -p "$BASE_DIR/supabase/functions/notify-order-status"
mkdir -p "$BASE_DIR/supabase/functions/parse-product-file"
mkdir -p "$BASE_DIR/supabase/migrations"
echo -e "${GREEN}  ✓ Estrutura criada${NC}"

# ===================== CONFIG.TOML =====================
echo -e "${YELLOW}[2/5] Gerando config.toml...${NC}"
cat > "$BASE_DIR/supabase/config.toml" << 'CONFIGEOF'
project_id = "default"

[functions.chatbot]
verify_jwt = false

[functions.parse-product-file]
verify_jwt = true

[functions.notify-order-status]
verify_jwt = true
CONFIGEOF
echo -e "${GREEN}  ✓ config.toml gerado${NC}"

# ===================== EDGE FUNCTIONS =====================
echo -e "${YELLOW}[3/5] Gerando Edge Functions...${NC}"

# --- chatbot/index.ts ---
cat > "$BASE_DIR/supabase/functions/chatbot/index.ts" << 'FNEOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Conversation-Id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { messages, conversation_id, session_id, customer_name, customer_phone } = await req.json();

    const { data: products } = await supabase
      .from("products")
      .select("name, price, old_price, category, brand, description, stock, unit")
      .eq("is_active", true)
      .limit(200);

    const { data: categories } = await supabase.from("categories").select("name");

    const productList = (products || []).map(p =>
      `- ${p.name} | Preço: R$${p.price.toFixed(2)}${p.old_price ? ` (antes R$${p.old_price.toFixed(2)})` : ''} | Categoria: ${p.category || 'N/A'} | Marca: ${p.brand || 'N/A'} | Estoque: ${p.stock} ${p.unit || 'UN'}${p.description ? ` | ${p.description}` : ''}`
    ).join('\n');

    const categoryList = (categories || []).map(c => c.name).join(', ');

    const systemPrompt = `Você é o assistente virtual do MD DEPÓSITO - Materiais de Construção, localizado em Fortaleza, CE.

## Sobre a Loja
- Nome: MD DEPÓSITO - Materiais de Construção
- Endereço: R. Camélia - Cristo Redentor - Fortaleza - CE, 60337-380
- Telefone: (85) 98510-2376
- E-mail: contato@depositoconstruir.com.br / orcamento@depositoconstruir.com.br
- Horário: Segunda a Sexta: 7h às 18h | Sábado: 7h às 14h
- Entrega para toda a região de Fortaleza e redondezas
- WhatsApp disponível para orçamentos

## Categorias Disponíveis
${categoryList || 'Alvenaria, Tintas, Ferramentas, Elétrica, Hidráulica, Madeiras, Segurança, Iluminação'}

## Catálogo de Produtos Atual
${productList || 'Nenhum produto cadastrado no momento.'}

## Cliente Atual
- Nome: ${customer_name || 'Não informado'}
- Telefone: ${customer_phone || 'Não informado'}

## Suas Responsabilidades
1. Responder perguntas sobre produtos, preços, disponibilidade e estoque
2. Fazer cálculos de materiais (ex: quantos sacos de cimento para X m², quantas latas de tinta para Y m², etc)
3. Sugerir produtos adequados para cada tipo de obra/reforma
4. Informar sobre formas de pagamento, entrega e horários
5. Ajudar clientes a montar orçamentos
6. Comparar produtos e recomendar o melhor custo-benefício

## Regras
- Sempre responda em português brasileiro
- Seja simpático, profissional e objetivo
- Use os preços EXATOS do catálogo acima
- Se não souber algo específico, direcione o cliente para o WhatsApp (85) 98510-2376
- Para cálculos de materiais, use fórmulas padrão da construção civil
- Formate valores monetários como R$ X,XX
- Use emojis com moderação para tornar a conversa amigável
- Se o cliente pedir um orçamento complexo, sugira que entre em contato pelo WhatsApp ou e-mail
- Chame o cliente pelo nome quando possível`;

    let convId = conversation_id;
    const lastUserMsg = messages[messages.length - 1];

    if (!convId && session_id) {
      const { data: conv } = await supabaseAdmin
        .from("chat_conversations")
        .insert({
          session_id,
          customer_name: (customer_name || '').slice(0, 100) || null,
          customer_phone: (customer_phone || '').replace(/\D/g, '').slice(0, 11) || null,
          status: "active",
          messages_count: 1,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      convId = conv?.id;
    } else if (convId) {
      await supabaseAdmin
        .from("chat_conversations")
        .update({ messages_count: messages.length, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    if (convId && lastUserMsg) {
      await supabaseAdmin
        .from("chat_messages")
        .insert({ conversation_id: convId, role: lastUserMsg.role, content: lastUserMsg.content });
    }

    const geminiContents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido! Estou pronto para ajudar os clientes do MD DEPÓSITO." }] },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    let fullAssistantContent = "";

    (async () => {
      try {
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullAssistantContent += text;
                const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {}
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } finally {
        await writer.close();
        if (convId && fullAssistantContent) {
          await supabaseAdmin
            .from("chat_messages")
            .insert({ conversation_id: convId, role: "assistant", content: fullAssistantContent });
        }
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId || "" },
    });
  } catch (e) {
    console.error("chatbot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
FNEOF
echo -e "${GREEN}  ✓ chatbot/index.ts${NC}"

# --- notify-order-status/index.ts ---
cat > "$BASE_DIR/supabase/functions/notify-order-status/index.ts" << 'FNEOF'
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, newStatus } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { data: order, error: orderError } = await supabaseClient
      .from('sales')
      .select('customer_name, customer_phone, whatsapp_opt_in, tracking_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (!order.whatsapp_opt_in || !order.customer_phone) {
      return new Response(
        JSON.stringify({ message: 'Customer did not opt-in or no phone provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL');
    const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY');

    if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
      console.log('WhatsApp API credentials not configured. Skipping message send.');
      return new Response(
        JSON.stringify({
          message: 'WhatsApp API credentials not configured.',
          simulated: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let message = '';
    const name = order.customer_name || 'Cliente';
    const orderCode = orderId.substring(0, 8).toUpperCase();

    if (newStatus === 'on_the_way') {
      message = `Olá ${name}! 🚚 Seu pedido #${orderCode} está a caminho. Prepare-se para recebê-lo em breve!`;
    } else if (newStatus === 'delivered') {
      message = `Olá ${name}! ✅ Seu pedido #${orderCode} foi entregue. Agradecemos a preferência e esperamos vê-lo novamente!`;
    } else {
      return new Response(
        JSON.stringify({ message: 'Status does not require notification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let phone = order.customer_phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    const payload = { number: phone, text: message };

    const res = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': WHATSAPP_API_KEY,
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Failed to send WhatsApp message: ${await res.text()}`);
    }

    return new Response(
      JSON.stringify({ message: 'WhatsApp notification sent successfully!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
FNEOF
echo -e "${GREEN}  ✓ notify-order-status/index.ts${NC}"

# --- parse-product-file/index.ts ---
cat > "$BASE_DIR/supabase/functions/parse-product-file/index.ts" << 'FNEOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }

    const { fileContent, fileType, fileName } = await req.json();

    if (!fileContent) {
      throw new Error('No file content provided');
    }

    if (fileType === 'csv' || fileType === 'txt') {
      const products = parseCSVorTXT(fileContent, fileType);
      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Você é um assistente especializado em extrair dados de produtos a partir de documentos de sistemas de automação comercial brasileiros (como Syspdv, Alterdata, Linx, Totvs, etc).

Analise o conteúdo abaixo e extraia TODOS os produtos encontrados. O documento pode conter listas de produtos com informações como:
- Nome/Descrição do produto
- Código do produto (EAN, código interno, SKU)
- Preço de venda
- Preço de custo
- Estoque/Quantidade
- Categoria/Grupo/Seção
- Unidade (UN, KG, CX, PCT, etc)
- NCM, CFOP, CST (dados fiscais)
- Marca

Retorne APENAS um JSON válido no seguinte formato, sem nenhum texto adicional:
{
  "products": [
    {
      "name": "Nome do produto",
      "product_code": "código ou null",
      "ean": "código de barras ou null",
      "price": 0.00,
      "cost_price": 0.00,
      "stock": 0,
      "category": "categoria ou null",
      "unit": "UN",
      "ncm": "ncm ou null",
      "cfop": "cfop ou null",
      "cst": "cst ou null",
      "brand": "marca ou null",
      "description": "descrição ou null"
    }
  ]
}

Se um campo não estiver disponível, use null para strings e 0 para números.
Extraia o máximo de produtos possível. Não invente dados.

Conteúdo do arquivo "${fileName}":
${fileContent}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error [${response.status}]: ${errorText}`);
    }

    const geminiResponse = await response.json();
    const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let jsonStr = content;
    const jsonMatch = content.match(/```json?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    const rawJsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (rawJsonMatch) {
      jsonStr = rawJsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    return new Response(JSON.stringify({ products: parsed.products || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error parsing product file:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to parse file',
      products: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseCSVorTXT(content: string, type: string): any[] {
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  let separator = ',';
  if (firstLine.includes('\t')) separator = '\t';
  else if (firstLine.includes(';')) separator = ';';
  else if (firstLine.includes('|')) separator = '|';

  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

  const headerMap: Record<string, string> = {};
  headers.forEach((h, i) => {
    const normalized = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^(nome|descricao|description|produto|item)$/i.test(normalized)) headerMap['name'] = String(i);
    if (/^(codigo|code|sku|cod|product_code|codigo_produto)$/i.test(normalized)) headerMap['product_code'] = String(i);
    if (/^(ean|gtin|barras|codigo_barras)$/i.test(normalized)) headerMap['ean'] = String(i);
    if (/^(preco|price|preco_venda|valor|vlr_venda)$/i.test(normalized)) headerMap['price'] = String(i);
    if (/^(custo|cost|preco_custo|cost_price|vlr_custo)$/i.test(normalized)) headerMap['cost_price'] = String(i);
    if (/^(estoque|stock|qtd|quantidade|qty)$/i.test(normalized)) headerMap['stock'] = String(i);
    if (/^(categoria|category|grupo|secao|departamento)$/i.test(normalized)) headerMap['category'] = String(i);
    if (/^(unidade|unit|un|medida)$/i.test(normalized)) headerMap['unit'] = String(i);
    if (/^(ncm)$/i.test(normalized)) headerMap['ncm'] = String(i);
    if (/^(marca|brand)$/i.test(normalized)) headerMap['brand'] = String(i);
  });

  const products: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
    const name = headerMap['name'] ? values[parseInt(headerMap['name'])] : values[0];
    if (!name || !name.trim()) continue;

    products.push({
      name: name.trim(),
      product_code: headerMap['product_code'] ? values[parseInt(headerMap['product_code'])] || null : null,
      ean: headerMap['ean'] ? values[parseInt(headerMap['ean'])] || null : null,
      price: headerMap['price'] ? parseFloat(values[parseInt(headerMap['price'])]?.replace(',', '.')) || 0 : 0,
      cost_price: headerMap['cost_price'] ? parseFloat(values[parseInt(headerMap['cost_price'])]?.replace(',', '.')) || 0 : 0,
      stock: headerMap['stock'] ? parseInt(values[parseInt(headerMap['stock'])]) || 0 : 0,
      category: headerMap['category'] ? values[parseInt(headerMap['category'])] || null : null,
      unit: headerMap['unit'] ? values[parseInt(headerMap['unit'])] || 'UN' : 'UN',
      ncm: headerMap['ncm'] ? values[parseInt(headerMap['ncm'])] || null : null,
      brand: headerMap['brand'] ? values[parseInt(headerMap['brand'])] || null : null,
      description: null,
      cfop: null,
      cst: null,
    });
  }

  return products;
}
FNEOF
echo -e "${GREEN}  ✓ parse-product-file/index.ts${NC}"

# ===================== MIGRATION SQL =====================
echo -e "${YELLOW}[4/5] Gerando migration do schema completo...${NC}"

cat > "$BASE_DIR/supabase/migrations/00000000000000_full_schema.sql" << 'SQLEOF'
-- ============================================================
-- MD DEPÓSITO - Schema Completo
-- ============================================================

-- 1. ENUM DE ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'product_manager');

-- 2. TABELA USER_ROLES
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. FUNÇÃO HAS_ROLE
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. FUNÇÃO UPDATE_UPDATED_AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. FUNÇÃO HANDLE_NEW_USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. POLICIES USER_ROLES
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. TABELA PROFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. TABELA PRODUCTS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    old_price NUMERIC DEFAULT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    image_url TEXT,
    brand TEXT,
    tag TEXT DEFAULT NULL,
    ncm TEXT, cfop TEXT, cst TEXT, ean TEXT, product_code TEXT,
    unit TEXT DEFAULT 'UN',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Product managers can manage products" ON public.products FOR ALL USING (has_role(auth.uid(), 'product_manager'::app_role));
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. TABELA CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
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

-- 10. TABELA SALES
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT, customer_phone TEXT, customer_email TEXT,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    profit DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT, notes TEXT,
    delivery_type TEXT NOT NULL DEFAULT 'local',
    tracking_status TEXT NOT NULL DEFAULT 'pending',
    delivery_address TEXT, delivery_phone TEXT, delivery_notes TEXT,
    source TEXT NOT NULL DEFAULT 'pdv',
    sale_type TEXT NOT NULL DEFAULT 'pdv',
    whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage sales" ON public.sales FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert site orders" ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (source = 'site'::text);
CREATE POLICY "Anyone can view site orders" ON public.sales FOR SELECT TO anon, authenticated USING (source = 'site'::text);
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- 11. TABELA SALE_ITEMS
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage sale items" ON public.sale_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert site order items" ON public.sale_items FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.source = 'site'::text));

-- 12. TABELA STOCK_MOVEMENTS
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL, quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL DEFAULT 0, new_stock INTEGER NOT NULL DEFAULT 0,
  reason TEXT, reference_id UUID, created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage stock movements" ON public.stock_movements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Product managers can manage stock movements" ON public.stock_movements FOR ALL USING (has_role(auth.uid(), 'product_manager'::app_role));
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- 13. TABELA AUDIT_LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL, record_id UUID NOT NULL, action TEXT NOT NULL,
  old_values JSONB, new_values JSONB, changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON public.audit_log(changed_at DESC);

-- 14. TABELA CART_ITEMS
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select their own cart" ON public.cart_items FOR SELECT USING (true);
CREATE POLICY "Users can insert into their own cart" ON public.cart_items FOR INSERT WITH CHECK (session_id IS NOT NULL AND length(session_id) > 0);
CREATE POLICY "Users can update their own cart" ON public.cart_items FOR UPDATE USING (session_id IS NOT NULL AND length(session_id) > 0);
CREATE POLICY "Users can delete their own cart" ON public.cart_items FOR DELETE USING (session_id IS NOT NULL AND length(session_id) > 0);
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_cart_items_session_id ON public.cart_items(session_id);

-- 15. TABELA PRODUCT_REVIEWS
CREATE TABLE public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL, customer_email TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved reviews" ON public.product_reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Admins can manage reviews" ON public.product_reviews FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can submit reviews" ON public.product_reviews FOR INSERT WITH CHECK (true);
CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. TABELA CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, cpf TEXT, cnpj TEXT, email TEXT, phone TEXT,
  cep TEXT, address TEXT, city TEXT, state TEXT, neighborhood TEXT, company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Product managers can view customers" ON public.customers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'product_manager'::app_role));

-- 17. TABELA SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT UNIQUE, name TEXT NOT NULL, trade_name TEXT, phone TEXT, email TEXT,
  address TEXT, city TEXT, state TEXT, cep TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Product managers can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'product_manager'::app_role));

-- 18. TABELA SUPPLIER_PRODUCTS
CREATE TABLE public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_product_code TEXT, supplier_price NUMERIC NOT NULL DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, product_id)
);
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage supplier_products" ON public.supplier_products FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Product managers can view supplier_products" ON public.supplier_products FOR SELECT TO authenticated USING (has_role(auth.uid(), 'product_manager'::app_role));

-- 19. TABELA XML_IMPORTS
CREATE TABLE public.xml_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  nfe_number TEXT, nfe_series TEXT, nfe_key TEXT,
  total_value NUMERIC NOT NULL DEFAULT 0, items_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(), imported_by UUID, raw_xml TEXT
);
ALTER TABLE public.xml_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage xml_imports" ON public.xml_imports FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 20. TABELA QUOTES
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT, customer_phone TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0, surcharge_percent NUMERIC NOT NULL DEFAULT 0,
  discount_value NUMERIC NOT NULL DEFAULT 0, surcharge_value NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0, notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  valid_until TIMESTAMP WITH TIME ZONE, created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0, subtotal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage quotes" ON public.quotes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage quote_items" ON public.quote_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 21. TABELA PDV_SETTINGS
CREATE TABLE public.pdv_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'MD DEPÓSITO',
  company_cnpj TEXT NOT NULL DEFAULT '00.000.000/0001-00',
  company_address TEXT NOT NULL DEFAULT 'R. Camélia - Cristo Redentor - Fortaleza - CE',
  company_phone TEXT NOT NULL DEFAULT '(85) 98510-2376',
  company_logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pdv_settings_single_row_idx ON public.pdv_settings((true));
ALTER TABLE public.pdv_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage pdv settings" ON public.pdv_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view pdv settings" ON public.pdv_settings FOR SELECT USING (true);
INSERT INTO public.pdv_settings (company_name) VALUES ('MD DEPÓSITO');

-- 22. TABELA CHAT_CONVERSATIONS
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL, customer_name TEXT, customer_phone TEXT, customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  messages_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert conversations" ON public.chat_conversations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update conversations" ON public.chat_conversations FOR UPDATE TO public USING (true);
CREATE POLICY "Admins can view conversations" ON public.chat_conversations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE INDEX idx_chat_conversations_session ON public.chat_conversations(session_id);

-- 23. TABELA CHAT_MESSAGES
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert messages" ON public.chat_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view messages" ON public.chat_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id));
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);

-- 24. TRIGGER DE NOVO USUÁRIO
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SQLEOF
echo -e "${GREEN}  ✓ Migration do schema completo gerada${NC}"

# ===================== DEPLOY SCRIPT =====================
echo -e "${YELLOW}[5/5] Gerando script de deploy...${NC}"

cat > "$BASE_DIR/deploy.sh" << 'DEPLOYEOF'
#!/bin/bash
# =============================================================
# Deploy para Supabase Self-Hosted
# Executa migrations e faz deploy das edge functions
# =============================================================
set -e

SUPABASE_API_URL="${SUPABASE_API_URL:-https://sb.sega4.com.br}"
PROJECT_REF="${PROJECT_REF:-default}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MD DEPÓSITO - Deploy Self-Hosted      ${NC}"
echo -e "${GREEN}========================================${NC}"

# Verificar Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Supabase CLI não encontrado. Instale: https://supabase.com/docs/guides/cli${NC}"
    exit 1
fi

# Inicializar projeto se necessário
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo -e "${YELLOW}Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_REF"
fi

# Executar migration
echo -e "${YELLOW}Executando migrations...${NC}"
supabase db push --project-ref "$PROJECT_REF" 2>&1 && \
    echo -e "${GREEN}  ✓ Migrations aplicadas${NC}" || \
    echo -e "${YELLOW}  ⚠ Migrations podem já ter sido aplicadas${NC}"

# Configurar secrets
if [ -z "$GOOGLE_GEMINI_API_KEY" ]; then
    read -p "Digite sua GOOGLE_GEMINI_API_KEY: " GOOGLE_GEMINI_API_KEY
fi

if [ -n "$GOOGLE_GEMINI_API_KEY" ]; then
    supabase secrets set GOOGLE_GEMINI_API_KEY="$GOOGLE_GEMINI_API_KEY" --project-ref "$PROJECT_REF" 2>/dev/null || true
fi

# Deploy Edge Functions
FUNCTIONS=("chatbot" "parse-product-file" "notify-order-status")
echo -e "${YELLOW}Deploying Edge Functions...${NC}"

for fn in "${FUNCTIONS[@]}"; do
    NO_VERIFY=""
    if [ "$fn" = "chatbot" ]; then
        NO_VERIFY="--no-verify-jwt"
    fi
    
    echo -n "  $fn... "
    if supabase functions deploy "$fn" --project-ref "$PROJECT_REF" $NO_VERIFY 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
done

# Teste rápido
echo ""
echo -e "${YELLOW}Testando chatbot...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$SUPABASE_API_URL/functions/v1/chatbot" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"oi"}],"session_id":"test"}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}  ✓ Chatbot OK (HTTP 200)${NC}"
else
    echo -e "${YELLOW}  ⚠ HTTP $HTTP_CODE${NC}"
fi

echo ""
echo -e "${GREEN}Deploy finalizado!${NC}"
echo "URLs:"
for fn in "${FUNCTIONS[@]}"; do
    echo "  $SUPABASE_API_URL/functions/v1/$fn"
done
DEPLOYEOF

chmod +x "$BASE_DIR/deploy.sh"
echo -e "${GREEN}  ✓ deploy.sh gerado${NC}"

# ===================== RESULTADO =====================
echo ""
echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  ✓ TUDO PRONTO!                                      ${NC}"
echo -e "${CYAN}======================================================${NC}"
echo ""
echo "Arquivos gerados em: $BASE_DIR/"
echo ""
echo "Estrutura:"
echo "  supabase-selfhost-deploy/"
echo "  ├── deploy.sh                          (script de deploy)"
echo "  └── supabase/"
echo "      ├── config.toml                    (configuração)"
echo "      ├── migrations/"
echo "      │   └── 00000000000000_full_schema.sql"
echo "      └── functions/"
echo "          ├── chatbot/index.ts"
echo "          ├── notify-order-status/index.ts"
echo "          └── parse-product-file/index.ts"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1. Copie a pasta para o servidor:"
echo "     scp -r $BASE_DIR usuario@servidor:/opt/"
echo ""
echo "  2. No servidor, execute:"
echo "     cd /opt/supabase-selfhost-deploy"
echo "     GOOGLE_GEMINI_API_KEY=sua_chave ./deploy.sh"
echo ""
