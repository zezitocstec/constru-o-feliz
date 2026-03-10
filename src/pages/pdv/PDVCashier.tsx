import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Barcode, Percent, X, Check, RefreshCw, FileDown, Globe, Package } from 'lucide-react';
import { generateReceiptPDF, downloadReceiptPDF } from '@/utils/generateReceiptPDF';
import { supabase } from '@/integrations/supabase/client';
import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  category: string | null;
  brand: string | null;
  tag: string | null;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
}

interface SiteOrder {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: number; product_id: string | null; subtotal: number }[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Notification sound logic moved to PDVLayout.tsx

const PDVCashier = () => {
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [saleType, setSaleType] = useState<'pdv' | 'nfce'>('pdv');
  const [mixedPayments, setMixedPayments] = useState<{ method: string; amount: number }[]>([]);
  const [currentMixedMethod, setCurrentMixedMethod] = useState('');
  const [currentMixedAmount, setCurrentMixedAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountItem, setDiscountItem] = useState<number | null>(null);
  const [discountValue, setDiscountValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [productsCache, setProductsCache] = useState<Product[]>([]);
  const [siteOrders, setSiteOrders] = useState<SiteOrder[]>([]);
  const [isSiteOrdersOpen, setIsSiteOrdersOpen] = useState(false);
  const [loadingSiteOrders, setLoadingSiteOrders] = useState(false);
  const [activeSiteOrderId, setActiveSiteOrderId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());
  const { toast } = useToast();

  // Load all products into cache on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Real-time listener for orders moved to PDVLayout.tsx for global PDV notifications


  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, cost_price, stock, category, brand, tag')
      .eq('is_active', true)
      .gt('stock', 0)
      .order('name');
    
    if (error) {
      console.error('Error loading products:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar produtos', description: error.message });
      return;
    }
    setProductsCache(data || []);
  };

  const loadSiteOrders = async () => {
    setLoadingSiteOrders(true);
    try {
      const { data: orders, error } = await supabase
        .from('sales')
        .select('id, customer_name, customer_phone, total, created_at')
        .eq('source', 'site')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersWithItems: SiteOrder[] = [];
      for (const order of orders || []) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('product_name, quantity, unit_price, product_id, subtotal')
          .eq('sale_id', order.id);
        ordersWithItems.push({ ...order, items: items || [] });
      }
      setSiteOrders(ordersWithItems);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar pedidos do site', description: error.message });
    } finally {
      setLoadingSiteOrders(false);
    }
  };

  const importSiteOrder = (order: SiteOrder) => {
    const newCart: CartItem[] = order.items.map(item => {
      const product = productsCache.find(p => p.id === item.product_id);
      return {
        product_id: item.product_id || '',
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: product?.cost_price || 0,
        discount: 0,
      };
    });
    setCart(newCart);
    setCustomerName(order.customer_name || '');
    setActiveSiteOrderId(order.id);
    setIsSiteOrdersOpen(false);
    toast({ title: `Pedido #${order.id.substring(0, 8).toUpperCase()} importado`, description: `Cliente: ${order.customer_name || 'N/A'}` });
  };

  const searchProducts = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // First try local cache
    const lower = term.toLowerCase();
    const localResults = productsCache.filter(
      p =>
        p.name.toLowerCase().includes(lower) ||
        p.id.toLowerCase().includes(lower) ||
        (p.brand && p.brand.toLowerCase().includes(lower)) ||
        (p.category && p.category.toLowerCase().includes(lower)) ||
        (p.tag && p.tag.toLowerCase().includes(lower))
    );

    if (localResults.length > 0) {
      setSearchResults(localResults.slice(0, 10));
      setIsSearching(false);
      return;
    }

    // If no local results, query database directly
    setIsSearching(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, cost_price, stock, category, brand, tag')
      .eq('is_active', true)
      .gt('stock', 0)
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%,id.ilike.%${term}%,tag.ilike.%${term}%`)
      .order('name')
      .limit(10);

    if (error) {
      console.error('Search error:', error);
      toast({ variant: 'destructive', title: 'Erro na busca' });
    } else {
      setSearchResults(data || []);
    }
    setIsSearching(false);
  }, [productsCache, toast]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchProducts(term);
    }, 200);
  }, [searchProducts]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ variant: 'destructive', title: 'Estoque insuficiente' });
          return prev;
        }
        return prev.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          cost_price: product.cost_price,
          discount: 0,
        },
      ];
    });
    setSearchTerm('');
    setSearchResults([]);
    searchRef.current?.focus();
  }, [toast]);

  const handleBarcodeSubmit = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) return;

    const lower = code.toLowerCase();

    const exactMatch = productsCache.find(p =>
      p.id.toLowerCase() === lower || (p.tag && p.tag.toLowerCase() === lower)
    );

    if (exactMatch) {
      addToCart(exactMatch);
      return;
    }

    // Fallback: if results already listed, add first one quickly
    if (searchResults.length > 0) {
      addToCart(searchResults[0]);
      return;
    }

    // Fallback: direct lookup by tag in the database (covers cases before cache loads)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, cost_price, stock, category, brand, tag')
      .eq('is_active', true)
      .gt('stock', 0)
      .eq('tag', code)
      .maybeSingle();

    if (error) {
      console.error('Barcode lookup error:', error);
    }

    if (data) {
      addToCart(data);
      return;
    }

    setSearchTerm(code);
    setSearchResults([]);
    toast({ variant: 'destructive', title: 'Produto não encontrado', description: `Código: ${code}` });
  }, [addToCart, productsCache, searchResults, toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setIsFinishOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setSearchTerm('');
        setSearchResults([]);
        return;
      }

      // Barcode scanner global capture (typing speed detection)
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      
      // If more than 50ms between keys, it's likely human typing, not a scanner
      if (timeDiff > 50) {
        barcodeBuffer.current = '';
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          const code = barcodeBuffer.current;
          barcodeBuffer.current = '';
          
          void handleBarcodeSubmit(code);
          return;
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        barcodeBuffer.current += e.key;
      }
      
      lastKeyTime.current = now;
    };
    
    // Use capture phase to intercept scanner input before focused inputs receive it
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [cart, handleBarcodeSubmit]);

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index];
      const product = productsCache.find(p => p.id === item.product_id);
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== index);
      if (product && newQty > product.stock) {
        toast({ variant: 'destructive', title: 'Estoque insuficiente' });
        return prev;
      }
      return prev.map((it, i) => (i === index ? { ...it, quantity: newQty } : it));
    });
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const applyDiscount = (index: number) => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val < 0 || val > 100) return;
    setCart(prev => prev.map((it, i) => (i === index ? { ...it, discount: val } : it)));
    setDiscountItem(null);
    setDiscountValue('');
  };

  const getItemSubtotal = (item: CartItem) => {
    const base = item.unit_price * item.quantity;
    return base - base * (item.discount / 100);
  };

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalDiscount = cart.reduce((s, i) => s + i.unit_price * i.quantity * (i.discount / 100), 0);
  const total = subtotal - totalDiscount;
  const profit = cart.reduce((s, i) => {
    const sub = getItemSubtotal(i);
    return s + (sub - i.cost_price * i.quantity);
  }, 0);
  const change = amountPaid ? Math.max(0, parseFloat(amountPaid) - total) : 0;

  const totalMixedPayments = mixedPayments.reduce((acc, curr) => acc + curr.amount, 0);

  const addMixedPayment = () => {
    const amount = parseFloat(currentMixedAmount);
    if (!currentMixedMethod || isNaN(amount) || amount <= 0) return;
    setMixedPayments(prev => [...prev, { method: currentMixedMethod, amount }]);
    setCurrentMixedMethod('');
    setCurrentMixedAmount('');
  };

  const removeMixedPayment = (index: number) => {
    setMixedPayments(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setPaymentMethod('');
    setAmountPaid('');
    setMixedPayments([]);
    setCurrentMixedMethod('');
    setCurrentMixedAmount('');
    setActiveSiteOrderId(null);
    setSaleType('pdv');
  };

  const finalizeSale = async () => {
    if (!paymentMethod) {
      toast({ variant: 'destructive', title: 'Selecione a forma de pagamento' });
      return;
    }
    if (paymentMethod === 'misto' && totalMixedPayments < total) {
      toast({ variant: 'destructive', title: 'O valor pago no pagamento misto é menor que o total' });
      return;
    }
    setIsSubmitting(true);
    try {
      let saleId: string;
      const finalPaymentMethod = paymentMethod === 'misto' 
        ? `Misto: ${mixedPayments.map(p => `${p.method} (${formatCurrency(p.amount)})`).join(' + ')}`
        : paymentMethod;

      if (activeSiteOrderId) {
        // Update existing site order to completed
        const { error: updateError } = await supabase
          .from('sales')
          .update({
            payment_method: finalPaymentMethod,
            total,
            profit,
            status: 'completed',
            tracking_status: 'completed',
            source: 'site',
            sale_type: saleType,
          })
          .eq('id', activeSiteOrderId);

        if (updateError) throw new Error(`Erro ao atualizar pedido: ${updateError.message}`);
        saleId = activeSiteOrderId;
      } else {
        // Insert new PDV sale
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            customer_name: customerName || null,
            payment_method: finalPaymentMethod,
            total,
            profit,
            status: 'completed',
            delivery_type: 'local',
            tracking_status: 'completed',
            source: 'pdv',
          })
          .select()
          .single();

        if (saleError) throw new Error(`Erro ao criar venda: ${saleError.message}`);
        saleId = saleData.id;

        // Insert sale items only for new PDV sales
        const saleItemsData = cart.map(item => ({
          sale_id: saleId,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          subtotal: getItemSubtotal(item),
        }));
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
        if (itemsError) throw new Error(`Erro ao salvar itens: ${itemsError.message}`);
      }

      // Update stock for each product
      for (const item of cart) {
        const product = productsCache.find(p => p.id === item.product_id);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
        }
      }

      // Generate receipt PDF
      try {
        const receiptBlob = await generateReceiptPDF({
          saleId,
          items: cart.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            subtotal: getItemSubtotal(item),
          })),
          subtotal,
          totalDiscount,
          total,
          paymentMethod: finalPaymentMethod,
          customerName: customerName || undefined,
          amountPaid: paymentMethod === 'misto' ? totalMixedPayments : (amountPaid ? parseFloat(amountPaid) : undefined),
          change: paymentMethod === 'misto' ? Math.max(0, totalMixedPayments - total) : (amountPaid ? change : undefined),
          createdAt: new Date(),
        });
        downloadReceiptPDF(receiptBlob, saleId);
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
      }

      toast({ title: '✅ Venda finalizada com sucesso!', description: `Total: ${formatCurrency(total)} — Cupom gerado!` });
      setIsFinishOpen(false);
      clearCart();
      loadProducts();
    } catch (error: any) {
      console.error('Finalize error:', error);
      toast({ variant: 'destructive', title: 'Erro ao finalizar venda', description: error.message || 'Tente novamente' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PDVLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-7rem)]">
        {/* Left: Product search + results */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Search bar */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Buscar produto por nome, código ou marca... (F2)"
                  className="pl-11 pr-20 h-12 text-lg"
                  value={searchTerm}
                  onChange={e => handleSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleBarcodeSubmit(e.currentTarget.value);
                    }
                  }}
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isSearching && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setSearchTerm(''); setSearchResults([]); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-2 border border-border rounded-lg overflow-hidden bg-card shadow-lg max-h-80 overflow-y-auto">
                  {searchResults.map(product => (
                    <button
                      key={product.id}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0"
                      onClick={() => addToCart(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.brand && `${product.brand} · `}
                          {product.category && `${product.category} · `}
                          Estoque: {product.stock}
                        </p>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(product.price)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results message */}
              {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                <div className="mt-2 p-4 text-center text-muted-foreground text-sm border border-border rounded-lg">
                  Nenhum produto encontrado para "{searchTerm}"
                </div>
              )}

              {/* Products count indicator */}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {productsCache.length > 0 
                    ? `${productsCache.length} produtos disponíveis` 
                    : 'Carregando produtos...'}
                </p>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={loadProducts}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cart items table */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="py-3 px-4 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Itens da Venda
                {cart.length > 0 && (
                  <Badge variant="secondary">{cart.length}</Badge>
                )}
              </CardTitle>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
                  <Trash2 className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <Barcode className="h-16 w-16 mb-4 opacity-30" />
                  <p className="text-lg">Busque e adicione produtos</p>
                  <p className="text-sm">Use o leitor de código de barras ou pesquise acima</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center w-32">Qtd</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Desc.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item, index) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(index, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(index, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">
                          {discountItem === index ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                className="w-16 h-7 text-xs"
                                value={discountValue}
                                onChange={e => setDiscountValue(e.target.value)}
                                placeholder="%"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && applyDiscount(index)}
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyDiscount(index)}>
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => { setDiscountItem(index); setDiscountValue(String(item.discount || '')); }}
                            >
                              {item.discount > 0 ? `${item.discount}%` : <Percent className="h-3 w-3" />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(getItemSubtotal(item))}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(index)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Sale summary */}
        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Resumo da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span>-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div>
                  <Label className="text-xs">Cliente (opcional)</Label>
                  <Input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Site orders + Action buttons */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setIsSiteOrdersOpen(true); loadSiteOrders(); }}
          >
            <Globe className="h-4 w-4 mr-2" />
            Pedidos do Site
            {siteOrders.length > 0 && (
              <Badge variant="destructive" className="ml-2">{siteOrders.length}</Badge>
            )}
          </Button>

          {activeSiteOrderId && (
            <div className="bg-accent/50 border border-accent rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Pedido do site</p>
              <p className="font-mono font-bold text-sm">#{activeSiteOrderId.substring(0, 8).toUpperCase()}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="destructive"
              className="h-14"
              disabled={cart.length === 0}
              onClick={clearCart}
            >
              <X className="h-5 w-5 mr-2" />
              Cancelar
            </Button>
            <Button
              className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={cart.length === 0}
              onClick={() => setIsFinishOpen(true)}
            >
              <Check className="h-5 w-5 mr-2" />
              Finalizar (F9)
            </Button>
          </div>

          {/* Keyboard shortcuts */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">Atalhos</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">F2</kbd> Buscar</span>
                <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">F9</kbd> Finalizar</span>
                <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">ESC</kbd> Limpar busca</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Finish sale dialog */}
      <Dialog open={isFinishOpen} onOpenChange={setIsFinishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Venda</DialogTitle>
            <DialogDescription>Confirme o pagamento para concluir a venda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total a pagar</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
            </div>

            <div>
              <Label>Forma de Pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="pix">📱 PIX</SelectItem>
                  <SelectItem value="cartao_debito">💳 Cartão de Débito</SelectItem>
                  <SelectItem value="cartao_credito">💳 Cartão de Crédito</SelectItem>
                  <SelectItem value="transferencia">🏦 Transferência</SelectItem>
                  <SelectItem value="misto">🔀 Pagamento Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'dinheiro' && (
              <div>
                <Label>Valor Recebido</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="R$ 0,00"
                />
                {parseFloat(amountPaid) >= total && (
                  <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Troco</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(change)}</p>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'misto' && (
              <div className="space-y-4 border border-border p-3 rounded-lg bg-card">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Método</Label>
                    <Select value={currentMixedMethod} onValueChange={setCurrentMixedMethod}>
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Cartão de Débito">Débito</SelectItem>
                        <SelectItem value="Cartão de Crédito">Crédito</SelectItem>
                        <SelectItem value="Transferência">Transf.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9 mt-1"
                      value={currentMixedAmount}
                      onChange={e => setCurrentMixedAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="flex items-end pb-[2px]">
                    <Button 
                      variant="secondary" 
                      className="h-9 w-9 px-0" 
                      onClick={addMixedPayment}
                      disabled={!currentMixedMethod || !currentMixedAmount}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {mixedPayments.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {mixedPayments.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                        <span>{p.method}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(p.amount)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={() => removeMixedPayment(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-sm font-medium">Total Pago:</span>
                      <span className={`font-bold ${totalMixedPayments >= total ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {formatCurrency(totalMixedPayments)}
                      </span>
                    </div>
                    {totalMixedPayments >= total && totalMixedPayments - total > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Troco:</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(totalMixedPayments - total)}</span>
                      </div>
                    )}
                    {totalMixedPayments < total && (
                      <div className="flex justify-between items-center text-sm text-destructive">
                        <span>Falta:</span>
                        <span className="font-bold">{formatCurrency(total - totalMixedPayments)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Itens</span>
                <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto total</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              {customerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span>{customerName}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFinishOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={finalizeSale}
              disabled={isSubmitting || !paymentMethod}
            >
              {isSubmitting ? 'Processando...' : 'Confirmar Venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site orders dialog */}
      <Dialog open={isSiteOrdersOpen} onOpenChange={setIsSiteOrdersOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Pedidos do Site
            </DialogTitle>
            <DialogDescription>Pedidos pendentes feitos pelo site. Importe para o caixa e finalize a venda.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-3 py-2">
            {loadingSiteOrders ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Carregando...
              </div>
            ) : siteOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum pedido pendente do site</p>
              </div>
            ) : (
              siteOrders.map(order => (
                <div key={order.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-bold">#{order.id.substring(0, 8).toUpperCase()}</p>
                      <p className="text-sm font-medium">{order.customer_name || 'Cliente sem nome'}</p>
                      {order.customer_phone && (
                        <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(order.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {order.items.map((item, idx) => (
                      <p key={idx}>{item.quantity}x {item.product_name} — {formatCurrency(item.subtotal)}</p>
                    ))}
                  </div>
                  <Button size="sm" className="w-full" onClick={() => importSiteOrder(order)}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Importar para o Caixa
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => loadSiteOrders()} disabled={loadingSiteOrders}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingSiteOrders ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PDVLayout>
  );
};

export default PDVCashier;
