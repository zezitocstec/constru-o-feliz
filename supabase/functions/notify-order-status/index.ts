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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Fetch order details
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

    // Configure credentials via Supabase Secrets
    const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL'); 
    const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY');

    if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
      console.log('WhatsApp API credentials not configured. Skipping message send.');
      return new Response(
        JSON.stringify({ 
          message: 'WhatsApp API credentials not configured. Please add WHATSAPP_API_URL and WHATSAPP_API_KEY to Supabase Secrets.',
          simulated: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare message
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

    // Format phone number to include country code if missing
    let phone = order.customer_phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    const payload = {
      number: phone,
      text: message
    };

    const res = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': WHATSAPP_API_KEY, 
        // fallback headers that some APIs use
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
