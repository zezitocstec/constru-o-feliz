import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Minus, Trash2, X, ShoppingCart } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface QuoteItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
}

interface QuoteEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote;
  onSaved: () => void;
  onImport: (items: CartItem[], customerName: string, discount: number, surcharge: number) => void;
}

export function QuoteEditDialog({ open, onOpenChange, quote, onSaved, onImport }: QuoteEditDialogProps) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && quote) {
      setCustomerName(quote.customer_name || '');
      setCustomerPhone(quote.customer_phone || '');
      setDiscountPercent(quote.discount_percent);
      setSurchargePercent(quote.surcharge_percent);
      setNotes(quote.notes || '');
      loadItems();
    }
  }, [open, quote]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);
      if (error) throw error;
      setItems((data as QuoteItem[]) || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar itens', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (index: number, delta: number) => {
    setItems(prev => {
      const item = prev[index];
      const newQty = Math.max(1, item.quantity + delta);
      return prev.map((it, i) =>
        i === index ? { ...it, quantity: newQty, subtotal: newQty * it.unit_price } : it
      );
    });
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    setItems(prev =>
      prev.map((it, i) =>
        i === index ? { ...it, unit_price: newPrice, subtotal: it.quantity * newPrice } : it
      )
    );
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast({ variant: 'destructive', title: 'O orçamento precisa ter pelo menos 1 item' });
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const discountValue = subtotal * (discountPercent / 100);
  const surchargeValue = subtotal * (surchargePercent / 100);
  const total = subtotal - discountValue + surchargeValue;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update quote header
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          subtotal,
          discount_percent: discountPercent,
          surcharge_percent: surchargePercent,
          discount_value: discountValue,
          surcharge_value: surchargeValue,
          total,
          notes: notes.trim() || null,
        })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // Delete old items and insert updated ones
      const { error: deleteError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', quote.id);
      if (deleteError) throw deleteError;

      const newItems = items.map(item => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: insertError } = await supabase.from('quote_items').insert(newItems);
      if (insertError) throw insertError;

      toast({ title: 'Orçamento atualizado!' });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    // Save first, then import
    await handleSave();
    const cartItems: CartItem[] = items.map(i => ({
      product_id: i.product_id || '',
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      cost_price: 0,
      discount: 0,
    }));
    onImport(cartItems, customerName, discountPercent, surchargePercent);

    // Mark as converted
    await supabase.from('quotes').update({ status: 'converted' }).eq('id', quote.id);
    toast({ title: 'Orçamento importado para o caixa!' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Orçamento #{quote.id.slice(0, 8).toUpperCase()}</DialogTitle>
          <DialogDescription>Altere itens, preços e dados do cliente antes de importar</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="mt-1 h-9" />
            </div>
          </div>

          {/* Items table */}
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-4">Carregando itens...</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs w-28">Preço Un.</TableHead>
                    <TableHead className="text-xs w-32">Qtd</TableHead>
                    <TableHead className="text-xs w-24 text-right">Subtotal</TableHead>
                    <TableHead className="text-xs w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium py-2">{item.product_name}</TableCell>
                      <TableCell className="py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={e => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateItemQuantity(idx, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateItemQuantity(idx, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium py-2">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Discount & Surcharge */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Acréscimo (%)</Label>
              <Input
                type="number"
                min="0"
                value={surchargePercent}
                onChange={e => setSurchargePercent(parseFloat(e.target.value) || 0)}
                className="mt-1 h-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1" />
          </div>

          {/* Totals */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Desconto ({discountPercent}%):</span>
                <span>- {formatCurrency(discountValue)}</span>
              </div>
            )}
            {surchargePercent > 0 && (
              <div className="flex justify-between text-sm text-primary">
                <span>Acréscimo ({surchargePercent}%):</span>
                <span>+ {formatCurrency(surchargeValue)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-border pt-1">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={saving || items.length === 0}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={handleImport} disabled={saving || items.length === 0}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Salvar e Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
