import { useState, useRef } from 'react';
import { Upload, FileText, Package, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface ParsedSupplier {
  cnpj: string;
  name: string;
  tradeName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}

interface ParsedItem {
  productCode: string;
  ean: string;
  name: string;
  ncm: string;
  cfop: string;
  cst: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'new' | 'existing' | 'matched';
  existingProductId?: string;
  existingProductName?: string;
}

interface ParsedNFe {
  nfeNumber: string;
  nfeSeries: string;
  nfeKey: string;
  supplier: ParsedSupplier;
  items: ParsedItem[];
  totalValue: number;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getTextContent(parent: Element, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() || '';
}

function parseNFeXML(xmlText: string): ParsedNFe {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Find NFe element (handles both nfeProc wrapper and direct NFe)
  const nfe = doc.getElementsByTagName('NFe')[0] || doc.getElementsByTagName('nfeProc')[0];
  if (!nfe) throw new Error('XML inválido: elemento NFe não encontrado');

  const infNFe = nfe.getElementsByTagName('infNFe')[0];
  if (!infNFe) throw new Error('XML inválido: elemento infNFe não encontrado');

  const ide = infNFe.getElementsByTagName('ide')[0];
  const emit = infNFe.getElementsByTagName('emit')[0];
  const enderEmit = emit?.getElementsByTagName('enderEmit')[0];

  const nfeKey = infNFe.getAttribute('Id')?.replace('NFe', '') || '';

  const supplier: ParsedSupplier = {
    cnpj: getTextContent(emit, 'CNPJ'),
    name: getTextContent(emit, 'xNome'),
    tradeName: getTextContent(emit, 'xFant'),
    phone: getTextContent(emit, 'fone'),
    address: enderEmit
      ? `${getTextContent(enderEmit, 'xLgr')}, ${getTextContent(enderEmit, 'nro')} - ${getTextContent(enderEmit, 'xBairro')}`
      : '',
    city: enderEmit ? getTextContent(enderEmit, 'xMun') : '',
    state: enderEmit ? getTextContent(enderEmit, 'UF') : '',
    cep: enderEmit ? getTextContent(enderEmit, 'CEP') : '',
  };

  const detElements = infNFe.getElementsByTagName('det');
  const items: ParsedItem[] = [];

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = det.getElementsByTagName('prod')[0];
    const imposto = det.getElementsByTagName('imposto')[0];

    // Try to get CST from ICMS
    let cst = '';
    if (imposto) {
      const icmsGroups = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90', 'ICMSSN101', 'ICMSSN102', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500', 'ICMSSN900'];
      for (const grp of icmsGroups) {
        const el = imposto.getElementsByTagName(grp)[0];
        if (el) {
          cst = getTextContent(el, 'CST') || getTextContent(el, 'CSOSN');
          break;
        }
      }
    }

    items.push({
      productCode: getTextContent(prod, 'cProd'),
      ean: getTextContent(prod, 'cEAN') || getTextContent(prod, 'cEANTrib'),
      name: getTextContent(prod, 'xProd'),
      ncm: getTextContent(prod, 'NCM'),
      cfop: getTextContent(prod, 'CFOP'),
      cst,
      unit: getTextContent(prod, 'uCom'),
      quantity: parseFloat(getTextContent(prod, 'qCom')) || 0,
      unitPrice: parseFloat(getTextContent(prod, 'vUnCom')) || 0,
      totalPrice: parseFloat(getTextContent(prod, 'vProd')) || 0,
      status: 'new',
    });
  }

  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    nfeNumber: getTextContent(ide, 'nNF'),
    nfeSeries: getTextContent(ide, 'serie'),
    nfeKey,
    supplier,
    items,
    totalValue: total,
  };
}

const XMLImport = () => {
  const [parsedNFe, setParsedNFe] = useState<ParsedNFe | null>(null);
  const [rawXml, setRawXml] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState<{ created: number; updated: number; matched: number }>({ created: 0, updated: 0, matched: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setRawXml(text);
      const parsed = parseNFeXML(text);

      // Match items against existing products
      const { data: existingProducts } = await supabase
        .from('products')
        .select('id, name, ean, product_code');

      if (existingProducts) {
        for (const item of parsed.items) {
          // Match by EAN first, then by product_code
          const matchByEan = item.ean && item.ean !== 'SEM GTIN'
            ? existingProducts.find((p: any) => p.ean === item.ean)
            : null;
          const matchByCode = !matchByEan && item.productCode
            ? existingProducts.find((p: any) => p.product_code === item.productCode)
            : null;

          const match = matchByEan || matchByCode;
          if (match) {
            item.status = item.unitPrice > 0 ? 'existing' : 'matched';
            item.existingProductId = match.id;
            item.existingProductName = match.name;
          }
        }
      }

      setParsedNFe(parsed);
      setImportDone(false);
      toast({ title: 'XML lido com sucesso', description: `${parsed.items.length} itens encontrados` });
    } catch (err: any) {
      toast({ title: 'Erro ao ler XML', description: err.message, variant: 'destructive' });
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!parsedNFe) return;
    setIsImporting(true);

    try {
      const { supplier, items } = parsedNFe;

      // 1. Upsert supplier
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .upsert({
          cnpj: supplier.cnpj,
          name: supplier.name,
          trade_name: supplier.tradeName,
          phone: supplier.phone,
          address: supplier.address,
          city: supplier.city,
          state: supplier.state,
          cep: supplier.cep,
        }, { onConflict: 'cnpj' })
        .select('id')
        .single();

      if (supplierError) throw supplierError;
      const supplierId = supplierData.id;

      let created = 0, updated = 0, matched = 0;

      for (const item of items) {
        let productId = item.existingProductId;

        if (productId) {
          // Existing product: update stock and fiscal info
          const { data: currentProduct } = await supabase
            .from('products')
            .select('stock, cost_price')
            .eq('id', productId)
            .single();

          const currentStock = currentProduct?.stock || 0;
          const newStock = currentStock + item.quantity;

          await supabase
            .from('products')
            .update({
              ncm: item.ncm,
              cfop: item.cfop,
              cst: item.cst,
              ean: item.ean !== 'SEM GTIN' ? item.ean : undefined,
              product_code: item.productCode,
              unit: item.unit,
              cost_price: item.unitPrice > 0 ? item.unitPrice : currentProduct?.cost_price,
              stock: newStock,
            })
            .eq('id', productId);

          // Record stock movement
          await supabase.from('stock_movements').insert({
            product_id: productId,
            type: 'entry',
            quantity: item.quantity,
            previous_stock: currentStock,
            new_stock: newStock,
            reason: `Entrada NF-e ${parsedNFe.nfeNumber} - ${supplier.name}`,
          });

          if (item.status === 'matched') matched++;
          else updated++;
        } else {
          // New product
          const { data: newProduct, error: prodError } = await supabase
            .from('products')
            .insert({
              name: item.name,
              cost_price: item.unitPrice,
              price: item.unitPrice * 1.3, // Default markup 30%
              stock: item.quantity,
              ncm: item.ncm,
              cfop: item.cfop,
              cst: item.cst,
              ean: item.ean !== 'SEM GTIN' ? item.ean : null,
              product_code: item.productCode,
              unit: item.unit,
              is_active: true,
            })
            .select('id')
            .single();

          if (prodError) throw prodError;
          productId = newProduct.id;

          // Record stock movement
          await supabase.from('stock_movements').insert({
            product_id: productId,
            type: 'entry',
            quantity: item.quantity,
            previous_stock: 0,
            new_stock: item.quantity,
            reason: `Entrada NF-e ${parsedNFe.nfeNumber} - ${supplier.name}`,
          });

          created++;
        }

        // Link supplier to product
        await supabase.from('supplier_products').upsert({
          supplier_id: supplierId,
          product_id: productId,
          supplier_product_code: item.productCode,
          supplier_price: item.unitPrice,
          last_purchase_date: new Date().toISOString(),
        }, { onConflict: 'supplier_id,product_id' });
      }

      // Log the import
      await supabase.from('xml_imports').insert({
        supplier_id: supplierId,
        nfe_number: parsedNFe.nfeNumber,
        nfe_series: parsedNFe.nfeSeries,
        nfe_key: parsedNFe.nfeKey,
        total_value: parsedNFe.totalValue,
        items_count: items.length,
        raw_xml: rawXml,
      });

      setImportSummary({ created, updated, matched });
      setImportDone(true);
      toast({ title: 'Importação concluída!', description: `${created} novos, ${updated} atualizados, ${matched} vinculados` });
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setParsedNFe(null);
    setRawXml('');
    setImportDone(false);
    setImportSummary({ created: 0, updated: 0, matched: 0 });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Importar XML NF-e</h1>
            <p className="text-muted-foreground">Importe notas fiscais para dar entrada em produtos e cadastrar fornecedores automaticamente</p>
          </div>
        </div>

        {/* Upload area */}
        {!parsedNFe && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Selecione o arquivo XML da NF-e</h3>
                <p className="text-sm text-muted-foreground">Suporta até 100 itens por nota</p>
              </div>
              <Input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="max-w-xs"
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>
        )}

        {/* Parsed data preview */}
        {parsedNFe && (
          <>
            {/* Supplier info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  NF-e #{parsedNFe.nfeNumber} - Série {parsedNFe.nfeSeries}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fornecedor</p>
                    <p className="font-semibold">{parsedNFe.supplier.name}</p>
                    <p className="text-sm">{parsedNFe.supplier.tradeName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CNPJ</p>
                    <p className="font-semibold">{parsedNFe.supplier.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Localização</p>
                    <p className="font-semibold">{parsedNFe.supplier.city}/{parsedNFe.supplier.state}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {parsedNFe.items.length} itens
                  </Badge>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    Total: {formatCurrency(parsedNFe.totalValue)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Items table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens da Nota ({parsedNFe.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>NCM</TableHead>
                        <TableHead>CFOP</TableHead>
                        <TableHead>CST</TableHead>
                        <TableHead>Und</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Vlr Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedNFe.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{item.productCode}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              {item.existingProductName && item.existingProductName !== item.name && (
                                <p className="text-xs text-muted-foreground">→ {item.existingProductName}</p>
                              )}
                              {item.ean && item.ean !== 'SEM GTIN' && (
                                <p className="text-xs text-muted-foreground">EAN: {item.ean}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.ncm}</TableCell>
                          <TableCell className="font-mono text-xs">{item.cfop}</TableCell>
                          <TableCell className="font-mono text-xs">{item.cst}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell>
                          <TableCell>
                            {item.status === 'new' && (
                              <Badge className="bg-emerald-600">Novo</Badge>
                            )}
                            {item.status === 'existing' && (
                              <Badge variant="secondary">Existente</Badge>
                            )}
                            {item.status === 'matched' && (
                              <Badge className="bg-amber-500">Vinculado</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Import done summary */}
            {importDone && (
              <Card className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
                <CardContent className="py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Check className="h-6 w-6 text-emerald-600" />
                    <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">Importação concluída!</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importSummary.created}</p>
                      <p className="text-sm text-muted-foreground">Produtos novos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{importSummary.updated}</p>
                      <p className="text-sm text-muted-foreground">Estoque atualizado</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{importSummary.matched}</p>
                      <p className="text-sm text-muted-foreground">Vinculados (preço zero)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {!importDone ? (
                <>
                  <Button onClick={handleImport} disabled={isImporting} className="gap-2">
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {isImporting ? 'Importando...' : 'Confirmar Importação'}
                  </Button>
                  <Button variant="outline" onClick={resetImport} disabled={isImporting}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={resetImport} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Importar outra NF-e
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default XMLImport;
