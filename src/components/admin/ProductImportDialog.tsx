import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ParsedProduct {
  name: string;
  product_code: string | null;
  ean: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category: string | null;
  unit: string | null;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  brand: string | null;
  description: string | null;
  selected?: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const SUPPORTED_FORMATS = [
  { ext: '.pdf', label: 'PDF', icon: FileText, desc: 'Relatórios de produtos de sistemas (Syspdv, Alterdata, Linx, etc.)' },
  { ext: '.csv', label: 'CSV', icon: FileSpreadsheet, desc: 'Planilhas separadas por vírgula ou ponto-e-vírgula' },
  { ext: '.txt', label: 'TXT', icon: FileText, desc: 'Arquivos texto tabulados ou separados por delimitador' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function ProductImportDialog({ open, onOpenChange, onImportComplete }: ProductImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [importProgress, setImportProgress] = useState(0);

  const resetState = () => {
    setStep('upload');
    setParsing(false);
    setFileName('');
    setProducts([]);
    setSelectAll(true);
    setImportProgress(0);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const getFileType = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'csv') return 'csv';
    if (ext === 'txt') return 'txt';
    return 'unknown';
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = getFileType(file.name);
    if (fileType === 'unknown') {
      toast({ variant: 'destructive', title: 'Formato não suportado', description: 'Use arquivos PDF, CSV ou TXT.' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'O arquivo deve ter no máximo 10MB.' });
      return;
    }

    setFileName(file.name);
    setParsing(true);

    try {
      let fileContent: string;

      if (fileType === 'pdf') {
        // For PDF, read as base64 and send text content extracted
        // We'll read as text first (works for text-based PDFs from automation systems)
        // If that fails, fall back to base64
        try {
          fileContent = await readFileAsText(file);
          // If content looks like binary/garbled, it's a real PDF
          if (fileContent.startsWith('%PDF') || fileContent.includes('\x00')) {
            // Read as base64 for AI processing
            const base64 = await readFileAsBase64(file);
            fileContent = `[Base64 encoded PDF - file: ${file.name}]\n${base64.substring(0, 50000)}`;
          }
        } catch {
          fileContent = await readFileAsText(file);
        }
      } else {
        fileContent = await readFileAsText(file);
      }

      const { data, error } = await supabase.functions.invoke('parse-product-file', {
        body: { fileContent, fileType, fileName: file.name },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const parsed = (data?.products || []).map((p: any) => ({ ...p, selected: true }));

      if (parsed.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum produto encontrado', description: 'Não foi possível extrair produtos do arquivo. Verifique o formato.' });
        setParsing(false);
        return;
      }

      setProducts(parsed);
      setStep('preview');
      toast({ title: `${parsed.length} produtos encontrados`, description: 'Revise os dados antes de importar.' });
    } catch (err: any) {
      console.error('Parse error:', err);
      toast({ variant: 'destructive', title: 'Erro ao processar', description: err.message || 'Não foi possível ler o arquivo.' });
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleProduct = (index: number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setProducts(prev => prev.map(p => ({ ...p, selected: checked })));
  };

  const selectedCount = products.filter(p => p.selected).length;

  const handleImport = async () => {
    const toImport = products.filter(p => p.selected);
    if (toImport.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione produtos', description: 'Selecione ao menos um produto para importar.' });
      return;
    }

    setStep('importing');
    setImportProgress(0);

    try {
      const batchSize = 20;
      let imported = 0;

      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize).map(p => ({
          name: p.name,
          description: p.description || null,
          price: p.price || 0,
          cost_price: p.cost_price || 0,
          stock: p.stock || 0,
          category: p.category || null,
          product_code: p.product_code || null,
          ean: p.ean || null,
          unit: p.unit || 'UN',
          ncm: p.ncm || null,
          cfop: p.cfop || null,
          cst: p.cst || null,
          brand: p.brand || null,
          is_active: true,
        }));

        const { error } = await supabase.from('products').insert(batch);
        if (error) throw error;

        imported += batch.length;
        setImportProgress(Math.round((imported / toImport.length) * 100));
      }

      toast({ title: 'Importação concluída!', description: `${imported} produtos foram importados com sucesso.` });
      onImportComplete();
      handleClose(false);
    } catch (err: any) {
      console.error('Import error:', err);
      toast({ variant: 'destructive', title: 'Erro na importação', description: err.message });
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Produtos
          </DialogTitle>
          <DialogDescription>
            Importe produtos de arquivos PDF, CSV ou TXT de outros sistemas de automação comercial.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            {/* Upload area */}
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? (
                <div className="space-y-3">
                  <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
                  <p className="font-medium">Processando {fileName}...</p>
                  <p className="text-sm text-muted-foreground">Extraindo produtos com inteligência artificial</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="font-medium">Clique para selecionar um arquivo</p>
                  <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.txt"
              className="hidden"
              onChange={handleFileSelect}
              disabled={parsing}
            />

            {/* Supported formats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Formatos suportados:</h4>
              <div className="grid gap-2">
                {SUPPORTED_FORMATS.map(fmt => (
                  <div key={fmt.ext} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <fmt.icon className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <span className="font-medium">{fmt.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">({fmt.ext})</span>
                      <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-primary">Dica</p>
                  <p className="text-muted-foreground">
                    Para PDFs, o sistema usa IA para identificar automaticamente os produtos. 
                    Para CSV/TXT, use cabeçalhos como: nome, codigo, preco, custo, estoque, categoria, unidade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{fileName}</Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} de {products.length} selecionados
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { resetState(); }}>
                <X className="h-4 w-4 mr-1" />
                Novo arquivo
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead>Un</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, idx) => (
                    <TableRow key={idx} className={!product.selected ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={product.selected}
                          onCheckedChange={() => toggleProduct(idx)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                      <TableCell className="text-sm">{product.product_code || product.ean || '-'}</TableCell>
                      <TableCell className="text-sm">{product.category || '-'}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(product.price)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(product.cost_price)}</TableCell>
                      <TableCell className="text-right text-sm">{product.stock}</TableCell>
                      <TableCell className="text-sm">{product.unit || 'UN'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
            <p className="font-medium">Importando produtos...</p>
            <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{importProgress}%</p>
          </div>
        )}

        {step === 'preview' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={selectedCount === 0} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Importar {selectedCount} produto{selectedCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
