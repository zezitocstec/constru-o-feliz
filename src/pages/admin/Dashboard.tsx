import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Package, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  totalSales: number;
  totalProducts: number;
  recentSales: Array<{
    id: string;
    customer_name: string;
    total: number;
    created_at: string;
  }>;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalProfit: 0,
    totalSales: 0,
    totalProducts: 0,
    recentSales: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch sales data
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, customer_name, total, profit, created_at')
        .order('created_at', { ascending: false });

      const totalRevenue = salesData?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
      const totalProfit = salesData?.reduce((sum, sale) => sum + Number(sale.profit), 0) || 0;

      setStats({
        totalRevenue,
        totalProfit,
        totalSales: salesData?.length || 0,
        totalProducts: productsCount || 0,
        recentSales: salesData?.slice(0, 5) || [],
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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

  const statCards = [
    {
      title: 'Receita Total',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      trend: '+12.5%',
      trendUp: true,
      description: 'vs. mês anterior',
    },
    {
      title: 'Lucro Total',
      value: formatCurrency(stats.totalProfit),
      icon: TrendingUp,
      trend: '+8.2%',
      trendUp: true,
      description: 'vs. mês anterior',
    },
    {
      title: 'Total de Vendas',
      value: stats.totalSales.toString(),
      icon: ShoppingCart,
      trend: '+5.4%',
      trendUp: true,
      description: 'vs. mês anterior',
    },
    {
      title: 'Produtos Ativos',
      value: stats.totalProducts.toString(),
      icon: Package,
      trend: '-2.1%',
      trendUp: false,
      description: 'vs. mês anterior',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-32"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    {stat.trendUp ? (
                      <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span className={stat.trendUp ? 'text-green-500' : 'text-red-500'}>
                      {stat.trend}
                    </span>
                    <span className="ml-1">{stat.description}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Vendas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma venda registrada ainda
                </p>
              ) : (
                <div className="space-y-4">
                  {stats.recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{sale.customer_name || 'Cliente não informado'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="font-semibold text-primary">
                        {formatCurrency(Number(sale.total))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <a href="/admin/products" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Adicionar Produto</p>
                  <p className="text-sm text-muted-foreground">Cadastrar novo item no catálogo</p>
                </div>
              </a>
              <a href="/admin/sales" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Nova Venda</p>
                  <p className="text-sm text-muted-foreground">Registrar uma nova venda</p>
                </div>
              </a>
              <a href="/admin/reports" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Ver Relatórios</p>
                  <p className="text-sm text-muted-foreground">Análise detalhada de vendas</p>
                </div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
