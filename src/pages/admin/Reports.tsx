import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Calendar, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface SaleData {
  date: string;
  total: number;
  profit: number;
  count: number;
}

interface CategoryData {
  category: string;
  total: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10B981', '#6366F1', '#F59E0B'];

const Reports = () => {
  const [period, setPeriod] = useState('30');
  const [salesData, setSalesData] = useState<SaleData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [totals, setTotals] = useState({
    revenue: 0,
    profit: 0,
    sales: 0,
    avgTicket: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch sales
      const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (sales) {
        // Group by date
        const groupedSales = sales.reduce((acc: Record<string, SaleData>, sale) => {
          const date = new Date(sale.created_at).toLocaleDateString('pt-BR');
          if (!acc[date]) {
            acc[date] = { date, total: 0, profit: 0, count: 0 };
          }
          acc[date].total += Number(sale.total);
          acc[date].profit += Number(sale.profit);
          acc[date].count += 1;
          return acc;
        }, {});

        setSalesData(Object.values(groupedSales));

        // Calculate totals
        const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
        const totalProfit = sales.reduce((sum, s) => sum + Number(s.profit), 0);
        setTotals({
          revenue: totalRevenue,
          profit: totalProfit,
          sales: sales.length,
          avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
        });
      }

      // Fetch sale items for category breakdown
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('product_name, subtotal');

      if (saleItems) {
        // Fetch products to get categories
        const { data: products } = await supabase
          .from('products')
          .select('name, category');

        const productCategories: Record<string, string> = {};
        products?.forEach((p) => {
          productCategories[p.name] = p.category || 'Outros';
        });

        const categoryTotals: Record<string, number> = {};
        saleItems.forEach((item) => {
          const category = productCategories[item.product_name] || 'Outros';
          categoryTotals[category] = (categoryTotals[category] || 0) + Number(item.subtotal);
        });

        setCategoryData(
          Object.entries(categoryTotals).map(([category, total]) => ({
            category,
            total,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const chartConfig = {
    total: {
      label: 'Receita',
      color: 'hsl(var(--primary))',
    },
    profit: {
      label: 'Lucro',
      color: 'hsl(var(--accent))',
    },
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Análise detalhada de vendas e lucros</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.profit)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.sales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.avgTicket)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Receita por Período</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : salesData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Profit Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Lucro por Período</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : salesData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="var(--color-profit)"
                        strokeWidth={2}
                        dot={{ fill: 'var(--color-profit)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : categoryData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total"
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Margem de Lucro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {totals.revenue > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Margem de lucro geral</span>
                      <span className="text-2xl font-bold text-green-600">
                        {((totals.profit / totals.revenue) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(totals.profit / totals.revenue) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Custo Total</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(totals.revenue - totals.profit)}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(totals.profit)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma venda registrada no período
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Reports;
