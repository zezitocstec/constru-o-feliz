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

    // Fetch products for context
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

    // Save conversation and user message
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

    // Convert OpenAI-style messages to Gemini format
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
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body!.getReader();
    let fullAssistantContent = "";

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
          const text = new TextDecoder().decode(value);
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullAssistantContent += content;
            } catch {}
          }
        }
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
