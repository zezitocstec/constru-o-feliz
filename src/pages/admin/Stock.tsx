import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, RefreshCw, Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface StockMovement {
  id: string;
  product_id: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  created_at: string;
  products?: { name: string; category: string | null };
}

interface Product {
  id: string;
  name: string;
  stock: number;
  category: string | null;
}

const Stock = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    type: 'entrada' as 'entrada' | 'saida' | 'ajuste',
    quantity: 1,
    reason: '',
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [movRes, prodRes] = await Promise.all([
        supabase
          .from('stock_movements')
          .select('*, products(name, category)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('products')
          .select('id, name, stock, category')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (movRes.error) throw movRes.error;
      if (prodRes.error) throw prodRes.error;

      setMovements((movRes.data || []) as StockMovement[]);
      setProducts(prodRes.data || []);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.product_id || formData.quantity <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um produto e quantidade válida.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const product = products.find(p => p.id === formData.product_id);
      if (!product) throw new Error('Produto não encontrado');

      const previousStock = product.stock;
      let newStock: number;

      if (formData.type === 'entrada') {
        newStock = previousStock + formData.quantity;
      } else if (formData.type === 'saida') {
        newStock = Math.max(0, previousStock - formData.quantity);
      } else {
        newStock = formData.quantity; // ajuste direto
      }

      // Insert movement
      const { error: movError } = await supabase.from('stock_movements').insert({
        product_id: formData.product_id,
        type: formData.type,
        quantity: formData.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: formData.reason || null,
        created_by: user?.id,
      });

      if (movError) throw movError;

      // Update product stock
      const { error: prodError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', formData.product_id);

      if (prodError) throw prodError;

      toast({ title: 'Sucesso', description: 'Movimentação registrada com sucesso.' });
      setIsDialogOpen(false);
      setFormData({ product_id: '', type: 'entrada', quantity: 1, reason: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving stock movement:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível registrar a movimentação.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMovements = movements.filter(m =>
    m.products?.name.toLowerCase().includes(search.toLowerCase()) ||
    m.type.includes(search.toLowerCase())
  );

  const totalEntradas = movements.filter(m => m.type === 'entrada').reduce((s, m) => s + m.quantity, 0);
  const totalSaidas = movements.filter(m => m.type === 'saida').reduce((s, m) => s + m.quantity, 0);
  const lowStockProducts = products.filter(p => p.stock <= 5);

  const typeConfig = {
    entrada: { label: 'Entrada', icon: TrendingUp, color: 'text-green-600', badge: 'default' as const },
    saida: { label: 'Saída', icon: TrendingDown, color: 'text-red-500', badge: 'destructive' as const },
    ajuste: { label: 'Ajuste', icon: RefreshCw, color: 'text-blue-500', badge: 'secondary' as const },
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Controle de Estoque</h1>
            <p className="text-muted-foreground">Gerencie entradas e saídas de produtos</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Entradas</p>
                  <p className="text-2xl font-bold text-green-600">{totalEntradas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Saídas</p>
                  <p className="text-2xl font-bold text-red-500">{totalSaidas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-orange-500">{lowStockProducts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low stock alert */}
        {lowStockProducts.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="text-orange-600 text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos com Estoque Baixo (≤ 5 unidades)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map(p => (
                  <Badge key={p.id} variant="outline" className="border-orange-300 text-orange-700">
                    {p.name}: {p.stock} un.
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Movements Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <CardTitle>Histórico de Movimentações</CardTitle>
              <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
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
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma movimentação encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Antes</TableHead>
                      <TableHead className="text-right">Depois</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.map((mov) => {
                      const cfg = typeConfig[mov.type];
                      return (
                        <TableRow key={mov.id}>
                          <TableCell className="font-medium">{mov.products?.name}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.badge} className="gap-1">
                              <cfg.icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${cfg.color}`}>
                            {mov.type === 'entrada' ? '+' : mov.type === 'saida' ? '-' : '='}{mov.quantity}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{mov.previous_stock}</TableCell>
                          <TableCell className="text-right font-semibold">{mov.new_stock}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{mov.reason || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(mov.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
            <DialogDescription>Registre uma entrada, saída ou ajuste de estoque</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Produto *</Label>
              <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — Estoque: {p.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={formData.type} onValueChange={(v: 'entrada' | 'saida' | 'ajuste') => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (adiciona ao estoque)</SelectItem>
                  <SelectItem value="saida">Saída (remove do estoque)</SelectItem>
                  <SelectItem value="ajuste">Ajuste (define estoque exato)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Motivo / Observação</Label>
              <Textarea
                placeholder="Ex: Compra do fornecedor, Venda avulsa, Inventário..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Stock;
