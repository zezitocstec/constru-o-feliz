import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_MESSAGES: Record<string, (name: string, code: string) => string> = {
  pending: (n, c) => `Olá ${n}! 🧾 Recebemos seu pedido #${c}. Status: *Pendente* — aguardando confirmação no caixa.`,
  confirmed: (n, c) => `Olá ${n}! ✅ Seu pedido #${c} foi *Confirmado*! Pagamento recebido, em breve preparamos seu pedido.`,
  leaving_warehouse: (n, c) => `Olá ${n}! 📦 Seu pedido #${c} está *Saindo do Depósito* e logo entrará em rota de entrega.`,
  on_the_way: (n, c) => `Olá ${n}! 🚚 Seu pedido #${c} está *A Caminho*! Prepare-se para recebê-lo em breve.`,
  delivered: (n, c) => `Olá ${n}! 🎉 Seu pedido #${c} foi *Entregue*. Obrigado pela preferência!`,
  cancelled: (n, c) => `Olá ${n}. ⚠️ Seu pedido #${c} foi *Cancelado*. Em caso de dúvidas, entre em contato conosco.`,
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
      .select('customer_name, customer_phone, tracking_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (!order.customer_phone) {
      return new Response(
        JSON.stringify({ message: 'No phone number available for this order' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const buildMessage = STATUS_MESSAGES[newStatus];
    if (!buildMessage) {
      return new Response(
        JSON.stringify({ message: `Status "${newStatus}" does not require notification` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const name = order.customer_name || 'Cliente';
    const orderCode = orderId.substring(0, 8).toUpperCase();
    const message = buildMessage(name, orderCode);

    const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL');
    const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY');

    if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
      console.log('WhatsApp API credentials not configured. Simulated message:', message);
      return new Response(
        JSON.stringify({
          message: 'WhatsApp API credentials not configured. Add WHATSAPP_API_URL and WHATSAPP_API_KEY to Supabase Secrets.',
          simulated: true,
          preview: message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let phone = order.customer_phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) phone = '55' + phone;

    const payload = { number: phone, text: message };

    const res = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': WHATSAPP_API_KEY,
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to send WhatsApp message: ${await res.text()}`);
    }

    return new Response(
      JSON.stringify({ message: 'WhatsApp notification sent successfully!', status: newStatus }),
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
