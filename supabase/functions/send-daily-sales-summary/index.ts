import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

function fmtDateBR(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Janela do "dia" em horário de Brasília (UTC-3) — sem DST
function getBrasiliaDayRange(reference?: Date) {
  const now = reference ?? new Date();
  // Converte "agora UTC" para BRT (-3h) e pega o dia local correspondente
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = brt.getUTCMonth();
  const d = brt.getUTCDate();
  // Início do dia BRT em UTC = 03:00Z
  const startUtc = new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  const labelDate = new Date(Date.UTC(y, m, d, 12, 0, 0, 0));
  return { startUtc, endUtc, labelDate };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const force: boolean = !!body.force;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Carrega configurações do PDV
    const { data: settings, error: settingsError } = await supabase
      .from('pdv_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Configurações do PDV não encontradas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    if (!force && !settings.daily_summary_enabled) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'daily_summary_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { startUtc, endUtc, labelDate } = getBrasiliaDayRange();
    const dayLabel = fmtDateBR(labelDate);

    // 2) Vendas do dia (PDV + NFC-e), excluindo canceladas
    const { data: salesAll, error: salesErr } = await supabase
      .from('sales')
      .select('id, total, profit, status, source, sale_type, payment_method, created_at, customer_name')
      .gte('created_at', startUtc.toISOString())
      .lt('created_at', endUtc.toISOString())
      .in('source', ['pdv']); // movimentação de caixa (PDV/NFC-e). Pedidos do site têm fluxo próprio.

    if (salesErr) throw salesErr;

    const sales = (salesAll || []).filter((s: any) => s.status !== 'cancelled');
    const cancelled = (salesAll || []).filter((s: any) => s.status === 'cancelled');

    const pdvSales = sales.filter((s: any) => (s.sale_type ?? 'pdv') === 'pdv');
    const nfceSales = sales.filter((s: any) => s.sale_type === 'nfce');

    const sumTotal = (arr: any[]) => arr.reduce((a, x) => a + Number(x.total || 0), 0);
    const sumProfit = (arr: any[]) => arr.reduce((a, x) => a + Number(x.profit || 0), 0);

    const totalVendas = sumTotal(sales);
    const totalLucro = sumProfit(sales);
    const totalPdv = sumTotal(pdvSales);
    const totalNfce = sumTotal(nfceSales);
    const totalCancelado = sumTotal(cancelled);

    // Pagamentos
    const byPayment: Record<string, { count: number; total: number }> = {};
    for (const s of sales) {
      const k = s.payment_method || 'não informado';
      byPayment[k] = byPayment[k] || { count: 0, total: 0 };
      byPayment[k].count++;
      byPayment[k].total += Number(s.total || 0);
    }

    // 3) Cupons (orçamentos) emitidos no dia
    const { data: quotes, error: quotesErr } = await supabase
      .from('quotes')
      .select('id, total, status, customer_name, created_at')
      .gte('created_at', startUtc.toISOString())
      .lt('created_at', endUtc.toISOString());
    if (quotesErr) throw quotesErr;

    const quotesCount = (quotes || []).length;
    const quotesTotal = (quotes || []).reduce((a, x) => a + Number(x.total || 0), 0);

    // 4) Itens cancelados / devoluções (movimentações de estoque tipo 'return' no dia)
    const { data: returns, error: returnsErr } = await supabase
      .from('stock_movements')
      .select('id, product_id, quantity, reason, created_at')
      .eq('type', 'return')
      .gte('created_at', startUtc.toISOString())
      .lt('created_at', endUtc.toISOString());
    if (returnsErr) console.warn('returns query error', returnsErr);

    const returnsCount = (returns || []).length;
    const returnsQty = (returns || []).reduce((a, x) => a + Number(x.quantity || 0), 0);

    // 5) Monta mensagens
    const company = settings.company_name || 'PDV';
    const lineSep = '━━━━━━━━━━━━━━━━━━━';

    const paymentLines = Object.entries(byPayment)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([k, v]) => `• ${k}: ${v.count}x — ${fmtBRL(v.total)}`)
      .join('\n') || '• (sem vendas)';

    const whatsappMsg =
`📊 *Resumo do Caixa — ${dayLabel}*
${company}
${lineSep}
🧾 *Vendas:* ${sales.length}
   • PDV: ${pdvSales.length} (${fmtBRL(totalPdv)})
   • NFC-e: ${nfceSales.length} (${fmtBRL(totalNfce)})
💰 *Faturamento:* ${fmtBRL(totalVendas)}
📈 *Lucro estimado:* ${fmtBRL(totalLucro)}

❌ *Canceladas:* ${cancelled.length} (${fmtBRL(totalCancelado)})
↩️ *Itens devolvidos:* ${returnsCount} mov. / ${returnsQty} un.
🧮 *Cupons (orçamentos):* ${quotesCount} (${fmtBRL(quotesTotal)})
${lineSep}
*Por forma de pagamento:*
${paymentLines}`;

    const htmlEmail = `
<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f6f8fb; padding:24px; color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">Resumo do Caixa — ${dayLabel}</h1>
      <p style="margin:4px 0 0;opacity:.8;font-size:13px;">${company}</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;">🧾 Vendas totais</td><td style="text-align:right;font-weight:600;">${sales.length}</td></tr>
        <tr><td style="padding:8px 0;">— PDV</td><td style="text-align:right;">${pdvSales.length} · ${fmtBRL(totalPdv)}</td></tr>
        <tr><td style="padding:8px 0;">— NFC-e</td><td style="text-align:right;">${nfceSales.length} · ${fmtBRL(totalNfce)}</td></tr>
        <tr><td style="padding:8px 0;border-top:1px solid #e2e8f0;">💰 Faturamento</td><td style="text-align:right;border-top:1px solid #e2e8f0;font-weight:700;">${fmtBRL(totalVendas)}</td></tr>
        <tr><td style="padding:8px 0;">📈 Lucro estimado</td><td style="text-align:right;color:#16a34a;font-weight:600;">${fmtBRL(totalLucro)}</td></tr>
        <tr><td style="padding:8px 0;color:#dc2626;">❌ Vendas canceladas</td><td style="text-align:right;color:#dc2626;">${cancelled.length} · ${fmtBRL(totalCancelado)}</td></tr>
        <tr><td style="padding:8px 0;">↩️ Itens devolvidos</td><td style="text-align:right;">${returnsCount} mov. · ${returnsQty} un.</td></tr>
        <tr><td style="padding:8px 0;">🧮 Cupons (orçamentos)</td><td style="text-align:right;">${quotesCount} · ${fmtBRL(quotesTotal)}</td></tr>
      </table>

      <h3 style="margin:24px 0 8px;font-size:14px;">Por forma de pagamento</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${Object.entries(byPayment).sort((a,b)=>b[1].total-a[1].total).map(([k,v]) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">${k}</td><td style="text-align:right;border-bottom:1px solid #f1f5f9;">${v.count}x</td><td style="text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">${fmtBRL(v.total)}</td></tr>`
        ).join('') || '<tr><td style="padding:6px 0;color:#64748b;">Sem vendas no período.</td></tr>'}
      </table>

      <p style="color:#64748b;font-size:12px;margin-top:24px;">Mensagem automática enviada pelo sistema PDV.</p>
    </div>
  </div>
</body></html>`;

    const results: Record<string, any> = { whatsapp: null, email: null };

    // 6) Envia WhatsApp (se configurado)
    if (settings.manager_whatsapp) {
      const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL');
      const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY');
      if (WHATSAPP_API_URL && WHATSAPP_API_KEY) {
        let phone = String(settings.manager_whatsapp).replace(/\D/g, '');
        if (!phone.startsWith('55')) phone = '55' + phone;
        try {
          const wRes = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': WHATSAPP_API_KEY,
              'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
            },
            body: JSON.stringify({ number: phone, text: whatsappMsg }),
          });
          results.whatsapp = { ok: wRes.ok, status: wRes.status };
          if (!wRes.ok) results.whatsapp.body = await wRes.text();
        } catch (e: any) {
          results.whatsapp = { ok: false, error: e.message };
        }
      } else {
        results.whatsapp = { ok: false, simulated: true, reason: 'whatsapp_api_not_configured', preview: whatsappMsg };
        console.log('WhatsApp simulado:\n' + whatsappMsg);
      }
    } else {
      results.whatsapp = { skipped: true, reason: 'no_manager_whatsapp' };
    }

    // 7) Envia E-mail (Resend via gateway)
    if (settings.manager_email) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
        results.email = { ok: false, reason: 'resend_not_configured' };
      } else {
        try {
          const subject = `Resumo do Caixa ${dayLabel} — ${fmtBRL(totalVendas)} em vendas`;
          const r = await fetch(`${RESEND_GATEWAY_URL}/emails`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: `${company} <onboarding@resend.dev>`,
              to: [settings.manager_email],
              subject,
              html: htmlEmail,
            }),
          });
          const j = await r.json().catch(() => ({}));
          results.email = { ok: r.ok, status: r.status, response: j };
        } catch (e: any) {
          results.email = { ok: false, error: e.message };
        }
      }
    } else {
      results.email = { skipped: true, reason: 'no_manager_email' };
    }

    // 8) Marca último envio
    await supabase
      .from('pdv_settings')
      .update({ daily_summary_last_sent_at: new Date().toISOString() })
      .eq('id', settings.id);

    return new Response(
      JSON.stringify({
        ok: true,
        day: dayLabel,
        totals: {
          sales_count: sales.length,
          revenue: totalVendas,
          profit: totalLucro,
          cancelled_count: cancelled.length,
          cancelled_total: totalCancelado,
          quotes_count: quotesCount,
          returns_count: returnsCount,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('send-daily-sales-summary error:', error?.message);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
