import { useEffect, useState } from 'react';
import { Search, Eye, XCircle, Globe, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface SaleRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  total: number;
  source: string;
  status: string;
}

const PDVCancelled = () => {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'pdv' | 'site'>('all');
  const [selected, setSelected] = useState<SaleRow | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchCancelled();
  }, []);

  const fetchCancelled = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(200);
    setSales((data as any) || []);
    setLoading(false);
  };

  const view = async (sale: SaleRow) => {
    setSelected(sale);
    const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setItems(data || []);
  };

  const filtered = sales.filter(s => {
    if (tab !== 'all' && s.source !== tab) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      s.customer_name?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.customer_phone?.toLowerCase().includes(q)
    );
  });

  const totalCancelled = filtered.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const countSite = sales.filter(s => s.source === 'site').length;
  const countPdv = sales.filter(s => s.source !== 'site').length;

  return (
    <PDVLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <XCircle className="h-7 w-7 text-destructive" />
          <div>
            <h1 className="text-2xl font-display font-bold">Vendas Canceladas</h1>
            <p className="text-sm text-muted-foreground">
              Pedidos cancelados no caixa ou recebidos do site sem confirmação.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total cancelado (filtro)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(totalCancelled)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados — Caixa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Monitor className="h-5 w-5 text-emerald-600" /> {countPdv}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados — Site</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" /> {countSite}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="pdv">Caixa</TabsTrigger>
                  <TabsTrigger value="site">Site</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative flex-1 sm:max-w-sm sm:ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, telefone ou ID..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhuma venda cancelada encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell>{new Date(sale.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        {sale.source === 'site' ? (
                          <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-600">
                            <Globe className="h-3 w-3" /> Site
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600">
                            <Monitor className="h-3 w-3" /> Caixa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{sale.customer_name || 'Consumidor'}</TableCell>
                      <TableCell>{sale.customer_phone || '-'}</TableCell>
                      <TableCell>{sale.payment_method || '-'}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatCurrency(Number(sale.total))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => view(sale)}>
                          <Eye className="h-4 w-4" />
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Cancelamento</DialogTitle>
            <DialogDescription>
              {selected && new Date(selected.created_at).toLocaleString('pt-BR')}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> {selected.customer_name || 'Consumidor'}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {selected.customer_phone || '-'}</div>
                <div><span className="text-muted-foreground">Origem:</span> {selected.source === 'site' ? 'Site' : 'Caixa'}</div>
                <div><span className="text-muted-foreground">Pagamento:</span> {selected.payment_method || '-'}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Sem itens registrados
                      </TableCell>
                    </TableRow>
                  ) : items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right text-lg font-bold text-destructive">
                Total cancelado: {formatCurrency(Number(selected.total))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PDVLayout>
  );
};

export default PDVCancelled;
