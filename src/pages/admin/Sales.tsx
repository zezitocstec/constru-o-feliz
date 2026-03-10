import { useEffect, useState } from 'react';
import { Plus, Search, ShoppingCart, Eye, Loader2, MapPin, Package, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface Sale {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number;
  profit: number;
  status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  sale_type: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
}

interface SaleItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  subtotal?: number;
}
interface Customer {
  id: string;
  name: string;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  cep: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  company_name: string | null;
}

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [saleType, setSaleType] = useState<'pdv' | 'nfce'>('pdv');
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    payment_method: '',
    notes: '',
    delivery_type: 'local',
    delivery_cep: '',
    delivery_address: '',
    delivery_phone: '',
    delivery_notes: '',
  });
  const [items, setItems] = useState<SaleItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock')
        .eq('is_active', true)
        .gt('stock', 0);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId === '__none__') {
      return;
    }
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    setFormData(prev => ({
      ...prev,
      customer_name: customer.company_name || customer.name,
      customer_phone: customer.phone || '',
      customer_email: customer.email || '',
      delivery_cep: customer.cep || '',
      delivery_address: customer.address
        ? `${customer.address}${customer.neighborhood ? ', ' + customer.neighborhood : ''}${customer.city ? ', ' + customer.city : ''}${customer.state ? ' - ' + customer.state : ''}`
        : '',
    }));
    toast({ title: 'Cliente selecionado', description: `Dados de ${customer.name} preenchidos.` });
  };

  const fetchSaleItems = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (error) throw error;
      setSaleItems(data || []);
    } catch (error) {
      console.error('Error fetching sale items:', error);
    }
  };

  const handleViewSale = async (sale: Sale) => {
    setSelectedSale(sale);
    await fetchSaleItems(sale.id);
    setIsViewDialogOpen(true);
  };

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setIsCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) {
        toast({ variant: 'destructive', title: 'CEP não encontrado' });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        delivery_address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`,
      }));
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao buscar CEP' });
    } finally {
      setIsCepLoading(false);
    }
  };

  const fetchCartItems = async () => {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*, products(id, name, price, cost_price, stock)');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'Carrinho vazio', description: 'Não há itens no carrinho do site.' });
        return;
      }
      const cartSaleItems: SaleItem[] = data
        .filter((ci: any) => ci.products)
        .map((ci: any) => ({
          product_id: ci.products.id,
          product_name: ci.products.name,
          quantity: ci.quantity,
          unit_price: ci.products.price,
          cost_price: ci.products.cost_price,
        }));
      setItems((prev) => [...prev, ...cartSaleItems]);
      toast({ title: 'Itens do carrinho importados', description: `${cartSaleItems.length} item(ns) adicionado(s).` });
    } catch (error) {
      console.error('Error fetching cart items:', error);
      toast({ variant: 'destructive', title: 'Erro ao buscar carrinho' });
    }
  };

  const handleAddItem = () => {
    setItems([...items, {
      product_id: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      cost_price: 0,
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index] = {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: product.price,
      cost_price: product.cost_price,
    };
    setItems(newItems);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  const calculateTotal = () => items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const calculateProfit = () => items.reduce((sum, item) => sum + (item.unit_price - item.cost_price) * item.quantity, 0);

  const resetForm = () => {
    setFormData({
      customer_name: '', customer_phone: '', customer_email: '', payment_method: '', notes: '',
      delivery_type: 'local', delivery_cep: '', delivery_address: '', delivery_phone: '', delivery_notes: '',
    });
    setItems([]);
    setSelectedCustomerId('');
    setCustomerSearch('');
    setSaleType('pdv');
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Adicione pelo menos um item à venda.' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create sale
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_name: formData.customer_name || null,
          customer_phone: formData.customer_phone || null,
          customer_email: formData.customer_email || null,
          payment_method: formData.payment_method || null,
          notes: formData.notes || null,
          delivery_type: formData.delivery_type,
          delivery_address: formData.delivery_type === 'delivery' ? formData.delivery_address || null : null,
          delivery_phone: formData.delivery_type === 'delivery' ? formData.delivery_phone || null : null,
          delivery_notes: formData.delivery_type === 'delivery' ? formData.delivery_notes || null : null,
          tracking_status: 'pending',
          total: calculateTotal(),
          profit: calculateProfit(),
          status: 'completed',
          sale_type: saleType,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItemsData = items.map((item) => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        subtotal: item.unit_price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsData);

      if (itemsError) throw itemsError;

      // Update stock for each item
      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock - item.quantity })
            .eq('id', item.product_id);
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Venda registrada com sucesso.',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchSales();
      fetchProducts();
    } catch (error) {
      console.error('Error creating sale:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível registrar a venda.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      completed: 'default',
      pending: 'secondary',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      completed: 'Concluída',
      pending: 'Pendente',
      cancelled: 'Cancelada',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const filteredSales = sales.filter((sale) =>
    sale.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    sale.id.includes(search)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Vendas</h1>
            <p className="text-muted-foreground">Gerencie as vendas da loja</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Histórico de Vendas
              </CardTitle>
              <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar vendas..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma venda encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{sale.customer_name || 'Não informado'}</TableCell>
                        <TableCell>{sale.payment_method || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(sale.total))}
                        </TableCell>
                        <TableCell className="text-right text-primary">
                          {formatCurrency(Number(sale.profit))}
                        </TableCell>
                        <TableCell>{getStatusBadge(sale.status)}</TableCell>
                        <TableCell>
                          <Badge variant={sale.sale_type === 'nfce' ? 'default' : 'secondary'}>
                            {sale.sale_type === 'nfce' ? '📄 NFC-e' : '🧾 PDV'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewSale(sale)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Sale Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Venda</DialogTitle>
            <DialogDescription>
              Registre uma nova venda
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Customer selector */}
            {customers.length > 0 && (
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Vincular Cliente Cadastrado
                </Label>
                <Select value={selectedCustomerId} onValueChange={handleSelectCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente cadastrado (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum — preencher manualmente</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.company_name ? ` (${c.company_name})` : ''}{c.cnpj ? ` — CNPJ: ${c.cnpj}` : c.cpf ? ` — CPF: ${c.cpf}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customer_name">Nome do Cliente</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_method">Forma de Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Venda</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={saleType === 'pdv' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleType('pdv')}
                  >
                    🧾 PDV
                  </Button>
                  <Button
                    type="button"
                    variant={saleType === 'nfce' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSaleType('nfce')}
                  >
                    📄 NFC-e
                  </Button>
                </div>
                {saleType === 'nfce' && (
                  <p className="text-xs text-amber-600">⚠️ Integração ACBr pendente</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Tipo de Entrega</Label>
                <Select
                  value={formData.delivery_type}
                  onValueChange={(value) => setFormData({ ...formData, delivery_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Retirada Local</SelectItem>
                    <SelectItem value="delivery">Tele-entrega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações sobre a venda"
                  rows={2}
                />
              </div>
            </div>

            {formData.delivery_type === 'delivery' && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                <h4 className="font-semibold">Dados da Entrega</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="delivery_cep">CEP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="delivery_cep"
                        value={formData.delivery_cep}
                        onChange={(e) => setFormData({ ...formData, delivery_cep: e.target.value })}
                        onBlur={() => fetchCep(formData.delivery_cep)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => fetchCep(formData.delivery_cep)} disabled={isCepLoading}>
                        {isCepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="delivery_address">Endereço de Entrega</Label>
                  <Input
                    id="delivery_address"
                    value={formData.delivery_address}
                    onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="delivery_phone">Telefone para Entrega</Label>
                    <Input
                      id="delivery_phone"
                      value={formData.delivery_phone}
                      onChange={(e) => setFormData({ ...formData, delivery_phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="delivery_notes">Observações da Entrega</Label>
                    <Input
                      id="delivery_notes"
                      value={formData.delivery_notes}
                      onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                      placeholder="Ponto de referência, etc."
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h4 className="font-semibold">Itens da Venda</h4>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={fetchCartItems}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Importar Carrinho
                  </Button>


                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum item adicionado. Use os botões acima para importar do carrinho ou adicionar manualmente.
                </p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => handleItemChange(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - {formatCurrency(product.price)} (Estoque: {product.stock})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                          placeholder="Qtd"
                        />
                      </div>
                      <div className="w-28 text-right font-medium">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>Lucro estimado:</span>
                    <span>{formatCurrency(calculateProfit())}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Registrar Venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Sale Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedSale.customer_name || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedSale.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pagamento</p>
                  <p className="font-medium">{selectedSale.payment_method || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSale.status)}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Itens</h4>
                <div className="space-y-2">
                  {saleItems.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span>{formatCurrency(Number(item.subtotal))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(Number(selectedSale.total))}</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span>Lucro:</span>
                  <span>{formatCurrency(Number(selectedSale.profit))}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Sales;
