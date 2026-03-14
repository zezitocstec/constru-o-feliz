import { LayoutDashboard, Package, ShoppingCart, BarChart3, Users, Settings, LogOut, Store, Warehouse, ClipboardList, UserCog, Truck, Monitor, FileUp, Factory, MessageCircle } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, group: 'principal' },
  { title: 'Produtos', url: '/admin/products', icon: Package, group: 'principal' },
  { title: 'Estoque', url: '/admin/stock', icon: Warehouse, group: 'principal' },
  { title: 'Vendas', url: '/admin/sales', icon: ShoppingCart, group: 'principal' },
  { title: 'Pedidos & Entregas', url: '/admin/orders', icon: Truck, group: 'principal' },
  { title: 'Relatórios', url: '/admin/reports', icon: BarChart3, group: 'principal' },
  { title: 'Clientes', url: '/admin/customers', icon: Users, group: 'principal' },
  { title: 'Importar XML', url: '/admin/xml-import', icon: FileUp, group: 'principal' },
  { title: 'Fornecedores', url: '/admin/suppliers', icon: Factory, group: 'principal' },
  { title: 'Chatbot / Leads', url: '/admin/chat-history', icon: MessageCircle, group: 'principal' },
  { title: 'Log de Atividades', url: '/admin/audit', icon: ClipboardList, group: 'sistema' },
  { title: 'Usuários/Permissões', url: '/admin/settings', icon: UserCog, group: 'sistema' },
  { title: 'Configurações', url: '/admin/settings', icon: Settings, group: 'sistema' },
];

export function AdminSidebar() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 hero-gradient rounded-lg flex items-center justify-center">
            <span className="font-display text-lg text-primary-foreground">MD</span>
          </div>
          <div>
            <h2 className="font-display text-lg">MD Depósito</h2>
            <p className="text-xs text-muted-foreground">Painel Admin</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.filter(i => i.group === 'principal').map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/admin'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.filter(i => i.group === 'sistema').map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/admin'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => navigate('/pdv')}
        >
          <Monitor className="h-4 w-4" />
          Abrir PDV
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => navigate('/')}
        >
          <Store className="h-4 w-4" />
          Ver Loja
        </Button>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
