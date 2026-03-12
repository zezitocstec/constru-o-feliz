import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, ShoppingCart, Trash2, RefreshCw, Plus, Pencil } from 'lucide-react';
import { QuoteEditDialog } from './QuoteEditDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { generateQuotePDF, downloadQuotePDF } from '@/utils/generateQuotePDF';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
}

interface Quote {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_percent: number;
  surcharge_percent: number;
  discount_value: number;
  surcharge_value: number;
  total: number;
  notes: string | null;
  status: string;
  valid_until: string | null;
  created_at: string;
  items?: QuoteItem[];
}

interface QuoteItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  customerName: string;
  globalDiscount: number;
  globalSurcharge: number;
  onImportQuote: (items: CartItem[], customerName: string, discount: number, surcharge: number) => void;
}

export function QuoteDialog({
  open, onOpenChange, cart, customerName, globalDiscount, globalSurcharge, onImportQuote,
}: QuoteDialogProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteCustomer, setQuoteCustomer] = useState('');
  const [quotePhone, setQuotePhone] = useState('');
  const [quoteValidDays, setQuoteValidDays] = useState('7');
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadQuotes();
      setQuoteCustomer(customerName);
    }
  }, [open, customerName]);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotes((data as Quote[]) || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar orçamentos', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const saveQuote = async () => {
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione itens ao carrinho antes de salvar o orçamento' });
      return;
    }
    setSaving(true);
    try {
      const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const discountVal = subtotal * (globalDiscount / 100);
      const surchargeVal = subtotal * (globalSurcharge / 100);
      const total = subtotal - discountVal + surchargeVal;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + (parseInt(quoteValidDays) || 7));

      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          customer_name: quoteCustomer.trim() || null,
          customer_phone: quotePhone.trim() || null,
          subtotal,
          discount_percent: globalDiscount,
          surcharge_percent: globalSurcharge,
          discount_value: discountVal,
          surcharge_value: surchargeVal,
          total,
          notes: quoteNotes.trim() || null,
          status: 'open',
          valid_until: validUntil.toISOString(),
        })
        .select('id')
        .single();

      if (quoteError) throw quoteError;

      const quoteItems = cart.map(item => ({
        quote_id: quoteData.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems);
      if (itemsError) throw itemsError;

      toast({ title: 'Orçamento salvo!', description: `Nº ${quoteData.id.slice(0, 8).toUpperCase()}` });
      setShowCreate(false);
      setQuoteNotes('');
      loadQuotes();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar orçamento', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async (quote: Quote) => {
    setGeneratingPdf(quote.id);
    try {
      // Load items
      const { data: items, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);
      if (error) throw error;

      const blob = await generateQuotePDF({
        quoteId: quote.id,
        items: (items || []).map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
        })),
        subtotal: quote.subtotal,
        discountPercent: quote.discount_percent,
        discountValue: quote.discount_value,
        surchargePercent: quote.surcharge_percent,
        surchargeValue: quote.surcharge_value,
        total: quote.total,
        customerName: quote.customer_name || undefined,
        customerPhone: quote.customer_phone || undefined,
        notes: quote.notes || undefined,
        validUntil: quote.valid_until ? new Date(quote.valid_until) : undefined,
        createdAt: new Date(quote.created_at),
      });
      downloadQuotePDF(blob, quote.id);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar PDF', description: err.message });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleImportQuote = async (quote: Quote) => {
    try {
      const { data: items, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);
      if (error) throw error;

      const cartItems: CartItem[] = (items || []).map(i => ({
        product_id: i.product_id || '',
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        cost_price: 0,
        discount: 0,
      }));

      onImportQuote(cartItems, quote.customer_name || '', quote.discount_percent, quote.surcharge_percent);

      // Update quote status
      await supabase.from('quotes').update({ status: 'converted' }).eq('id', quote.id);

      toast({ title: 'Orçamento importado para o caixa!' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao importar orçamento', description: err.message });
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      await supabase.from('quotes').delete().eq('id', id);
      toast({ title: 'Orçamento excluído' });
      loadQuotes();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Orçamentos
          </DialogTitle>
          <DialogDescription>Crie, gerencie e importe orçamentos para o caixa</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* Create new quote section */}
          {!showCreate ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreate(true)}
              disabled={cart.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento {cart.length === 0 && '(adicione itens ao carrinho)'}
            </Button>
          ) : (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="font-medium text-sm">Novo Orçamento ({cart.length} itens)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Input
                    value={quoteCustomer}
                    onChange={e => setQuoteCustomer(e.target.value)}
                    placeholder="Nome do cliente"
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={quotePhone}
                    onChange={e => setQuotePhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="mt-1 h-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Validade (dias)</Label>
                <Input
                  type="number"
                  value={quoteValidDays}
                  onChange={e => setQuoteValidDays(e.target.value)}
                  className="mt-1 h-9 w-24"
                />
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  placeholder="Condições, prazos..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveQuote} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Orçamento'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Existing quotes list */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum orçamento aberto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quotes.map(quote => (
                <div key={quote.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-bold">#{quote.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm font-medium">{quote.customer_name || 'Sem cliente'}</p>
                      {quote.customer_phone && (
                        <p className="text-xs text-muted-foreground">{quote.customer_phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(quote.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      {quote.valid_until && (
                        <p className="text-xs text-muted-foreground">
                          Válido até {new Date(quote.valid_until).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  {(quote.discount_percent > 0 || quote.surcharge_percent > 0) && (
                    <div className="flex gap-2">
                      {quote.discount_percent > 0 && (
                        <Badge variant="secondary" className="text-xs">Desc: {quote.discount_percent}%</Badge>
                      )}
                      {quote.surcharge_percent > 0 && (
                        <Badge variant="outline" className="text-xs">Acrésc: {quote.surcharge_percent}%</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingQuote(quote)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => handleImportQuote(quote)}>
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Importar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadPDF(quote)}
                      disabled={generatingPdf === quote.id}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {generatingPdf === quote.id ? '...' : 'PDF'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteQuote(quote.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={loadQuotes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
      {editingQuote && (
        <QuoteEditDialog
          open={!!editingQuote}
          onOpenChange={(open) => { if (!open) setEditingQuote(null); }}
          quote={editingQuote}
          onSaved={loadQuotes}
          onImport={(items, name, discount, surcharge) => {
            onImportQuote(items, name, discount, surcharge);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
