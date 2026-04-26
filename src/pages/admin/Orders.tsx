import { useEffect, useState } from 'react';
import { Search, Package, Eye, Truck, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Order {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number;
  profit: number;
  status: string;
  payment_method: string | null;
  notes: string | null;
  delivery_type: string;
  tracking_status: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_notes: string | null;
  created_at: string;
  whatsapp_opt_in: boolean;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const TRACKING_STATUSES = [
  { value: 'pending', label: 'Pendente', color: 'secondary' as const },
  { value: 'confirmed', label: 'Confirmado', color: 'default' as const },
  { value: 'leaving_warehouse', label: 'Saindo do Depósito', color: 'default' as const },
  { value: 'on_the_way', label: 'A Caminho', color: 'default' as const },
  { value: 'delivered', label: 'Recebido', color: 'default' as const },
  { value: 'cancelled', label: 'Cancelado', color: 'destructive' as const },
];

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data as Order[]) || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
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
      console.error('Error fetching items:', error);
    }
  };

  const handleView = async (order: Order) => {
    setSelectedOrder(order);
    await fetchSaleItems(order.id);
    setIsViewOpen(true);
  };

  const handleOpenStatus = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.tracking_status);
    setIsStatusOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    try {
      const updateData: Record<string, any> = { tracking_status: newStatus };
      if (newStatus === 'cancelled') updateData.status = 'cancelled';
      if (newStatus === 'delivered') updateData.status = 'completed';

      const { error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', selectedOrder.id);
      if (error) throw error;

      // Notifica o cliente via WhatsApp em qualquer mudança de status
      if (selectedOrder.customer_phone) {
        supabase.functions.invoke('notify-order-status', {
          body: { orderId: selectedOrder.id, newStatus }
        }).catch(err => console.error("Error invoking notify function:", err));
      }

      toast({ title: 'Sucesso', description: 'Status atualizado com sucesso.' });
      setIsStatusOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o status.' });
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getTrackingBadge = (status: string) => {
    const s = TRACKING_STATUSES.find((t) => t.value === status);
    return <Badge variant={s?.color || 'secondary'}>{s?.label || status}</Badge>;
  };

  const getDeliveryBadge = (type: string) => {
    if (type === 'delivery') return <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3" />Tele-entrega</Badge>;
    return <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />Local</Badge>;
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search);
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'delivery') return matchesSearch && o.delivery_type === 'delivery';
    if (activeTab === 'local') return matchesSearch && o.delivery_type === 'local';
    if (activeTab === 'active') return matchesSearch && !['delivered', 'cancelled'].includes(o.tracking_status);
    return matchesSearch;
  });

  const activeCount = orders.filter((o) => !['delivered', 'cancelled'].includes(o.tracking_status)).length;
  const deliveryCount = orders.filter((o) => o.delivery_type === 'delivery').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Pedidos & Entregas</h1>
          <p className="text-muted-foreground">Acompanhe pedidos, status e tele-entregas</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{orders.length}</div>
              <p className="text-sm text-muted-foreground">Total de Pedidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-sm text-muted-foreground">Pedidos Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{deliveryCount}</div>
              <p className="text-sm text-muted-foreground">Tele-entregas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {orders.filter((o) => o.tracking_status === 'on_the_way').length}
              </div>
              <p className="text-sm text-muted-foreground">A Caminho</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Lista de Pedidos
              </CardTitle>
              <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar pedidos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="delivery">Tele-entrega</TabsTrigger>
                <TabsTrigger value="local">Local</TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{new Date(order.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{order.customer_name || 'Não informado'}</TableCell>
                        <TableCell>{getDeliveryBadge(order.delivery_type)}</TableCell>
                        <TableCell>{getTrackingBadge(order.tracking_status)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(order.total))}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleView(order)} title="Ver detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenStatus(order)} title="Atualizar status">
                            <Truck className="h-4 w-4" />
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

      {/* View Order Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedOrder.customer_name || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">{new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  {getDeliveryBadge(selectedOrder.delivery_type)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getTrackingBadge(selectedOrder.tracking_status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pagamento</p>
                  <p className="font-medium">{selectedOrder.payment_method || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedOrder.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{selectedOrder.whatsapp_opt_in ? 'Ativado' : 'Não'}</p>
                </div>
              </div>

              {selectedOrder.delivery_type === 'delivery' && (
                <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" />Dados da Entrega</h4>
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="font-medium">{selectedOrder.delivery_address || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone entrega</p>
                    <p className="font-medium">{selectedOrder.delivery_phone || '-'}</p>
                  </div>
                  {selectedOrder.delivery_notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Observações</p>
                      <p className="font-medium">{selectedOrder.delivery_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Rastreamento</h4>
                <div className="space-y-2">
                  {TRACKING_STATUSES.filter(s => s.value !== 'cancelled').map((s, i) => {
                    const statusOrder = ['pending', 'confirmed', 'leaving_warehouse', 'on_the_way', 'delivered'];
                    const currentIdx = statusOrder.indexOf(selectedOrder.tracking_status);
                    const thisIdx = statusOrder.indexOf(s.value);
                    const isCompleted = selectedOrder.tracking_status === 'cancelled' ? false : thisIdx <= currentIdx;
                    const isCurrent = s.value === selectedOrder.tracking_status;
                    return (
                      <div key={s.value} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'} ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`} />
                        <span className={`text-sm ${isCompleted ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
                      </div>
                    );
                  })}
                  {selectedOrder.tracking_status === 'cancelled' && (
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-destructive ring-2 ring-destructive ring-offset-2" />
                      <span className="text-sm font-medium text-destructive">Cancelado</span>
                    </div>
                  )}
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

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(Number(selectedOrder.total))}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status do Pedido</DialogTitle>
            <DialogDescription>
              Cliente: {selectedOrder?.customer_name || 'Não informado'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Novo Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACKING_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateStatus}>Atualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Orders;
