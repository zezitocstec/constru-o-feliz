import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { messages } = await req.json();

    // Fetch products for context
    const { data: products } = await supabase
      .from("products")
      .select("name, price, old_price, category, brand, description, stock, unit")
      .eq("is_active", true)
      .limit(200);

    // Fetch categories
    const { data: categories } = await supabase
      .from("categories")
      .select("name");

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
- Se o cliente pedir um orçamento complexo, sugira que entre em contato pelo WhatsApp ou e-mail`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chatbot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
