import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, Eye, XCircle, Globe, Monitor, FileDown, FileText, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { toast } = useToast();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState<'all' | 'pdv' | 'site'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
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
      .limit(500);
    setSales((data as any) || []);
    setLoading(false);
  };

  const view = async (sale: SaleRow) => {
    setSelected(sale);
    const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setItems(data || []);
  };

  const filtered = useMemo(() => {
    return sales.filter(s => {
      if (origin !== 'all' && (origin === 'site' ? s.source !== 'site' : s.source === 'site')) return false;
      if (startDate && new Date(s.created_at) < new Date(startDate.setHours(0, 0, 0, 0))) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(s.created_at) > end) return false;
      }
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        s.customer_name?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.customer_phone?.toLowerCase().includes(q)
      );
    });
  }, [sales, origin, search, startDate, endDate]);

  const totalCancelled = filtered.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const countSite = filtered.filter(s => s.source === 'site').length;
  const countPdv = filtered.filter(s => s.source !== 'site').length;

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setOrigin('all');
    setSearch('');
  };

  const periodLabel = () => {
    if (startDate && endDate) return `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
    if (startDate) return `desde ${format(startDate, 'dd/MM/yyyy')}`;
    if (endDate) return `até ${format(endDate, 'dd/MM/yyyy')}`;
    return 'todos os períodos';
  };

  const originLabel = origin === 'all' ? 'Todas as origens' : origin === 'site' ? 'Site' : 'Caixa';

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast({ variant: 'destructive', title: 'Nada para exportar' });
      return;
    }
    const headers = ['Data', 'Origem', 'Cliente', 'Telefone', 'Pagamento', 'Total', 'ID'];
    const rows = filtered.map(s => [
      new Date(s.created_at).toLocaleString('pt-BR'),
      s.source === 'site' ? 'Site' : 'Caixa',
      s.customer_name || 'Consumidor',
      s.customer_phone || '',
      s.payment_method || '',
      Number(s.total).toFixed(2).replace('.', ','),
      s.id,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-canceladas-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: `${filtered.length} registros.` });
  };

  const exportPDF = () => {
    if (filtered.length === 0) {
      toast({ variant: 'destructive', title: 'Nada para exportar' });
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório de Vendas Canceladas', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${periodLabel()}  •  Origem: ${originLabel}`, 14, 26);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [['Data', 'Origem', 'Cliente', 'Telefone', 'Pagamento', 'Total']],
      body: filtered.map(s => [
        new Date(s.created_at).toLocaleString('pt-BR'),
        s.source === 'site' ? 'Site' : 'Caixa',
        s.customer_name || 'Consumidor',
        s.customer_phone || '-',
        s.payment_method || '-',
        formatCurrency(Number(s.total)),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38] },
      foot: [['', '', '', '', 'Total cancelado:', formatCurrency(totalCancelled)]],
      footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold' },
    });

    doc.save(`vendas-canceladas-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
    toast({ title: 'PDF exportado', description: `${filtered.length} registros.` });
  };

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
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem</Label>
                <Tabs value={origin} onValueChange={(v) => setOrigin(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="pdv">Caixa</TabsTrigger>
                    <TabsTrigger value="site">Site</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-[160px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-[160px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
              </div>

              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>

              <div className="ml-auto flex items-end gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-9 w-56"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
                  <FileDown className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
                  <FileText className="h-4 w-4" /> PDF
                </Button>
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
