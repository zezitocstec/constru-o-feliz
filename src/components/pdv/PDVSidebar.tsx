import { Monitor, History, BarChart3, Settings, LogOut, Store, Users, XCircle } from 'lucide-react';
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
  { title: 'Frente de Caixa', url: '/pdv', icon: Monitor, group: 'principal' },
  { title: 'Histórico de Vendas', url: '/pdv/history', icon: History, group: 'principal' },
  { title: 'Vendas Canceladas', url: '/pdv/cancelled', icon: XCircle, group: 'principal' },
  { title: 'Clientes', url: '/pdv/customers', icon: Users, group: 'principal' },
  { title: 'Relatório do Caixa', url: '/pdv/report', icon: BarChart3, group: 'principal' },
  { title: 'Configurações', url: '/pdv/settings', icon: Settings, group: 'sistema' },
];

export function PDVSidebar() {
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
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Monitor className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-lg">itsega4PDV</h2>
            <p className="text-xs text-muted-foreground">Ponto de Venda</p>
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
                      end={item.url === '/pdv'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                          isActive
                            ? 'bg-emerald-600 text-white'
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
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                          isActive
                            ? 'bg-emerald-600 text-white'
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
          onClick={() => navigate('/admin')}
        >
          <Store className="h-4 w-4" />
          Painel Admin
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
          <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <span className="text-sm font-medium text-emerald-600">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Operador</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
