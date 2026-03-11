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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { fileContent, fileType, fileName } = await req.json();

    if (!fileContent) {
      throw new Error('No file content provided');
    }

    // For CSV/TXT, parse directly without AI
    if (fileType === 'csv' || fileType === 'txt') {
      const products = parseCSVorTXT(fileContent, fileType);
      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For PDF and other formats, use AI to extract product data
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error [${response.status}]: ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Extract JSON from the response
    let jsonStr = content;
    const jsonMatch = content.match(/```json?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    // Also try to find raw JSON object
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

  // Detect separator
  const firstLine = lines[0];
  let separator = ',';
  if (firstLine.includes('\t')) separator = '\t';
  else if (firstLine.includes(';')) separator = ';';
  else if (firstLine.includes('|')) separator = '|';

  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  // Map common header names
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
