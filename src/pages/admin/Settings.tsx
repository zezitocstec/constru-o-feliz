import { useState, useEffect } from 'react';
import { Store, User, Bell, Shield, UserCog, Trash2, AlertTriangle, RotateCcw, Database, XCircle, Download } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null };
}

const DANGER_ACTIONS = {
  reset_stock: {
    title: 'Zerar Estoque',
    description: 'Todos os produtos terão seu estoque zerado. Os produtos continuarão cadastrados, mas com quantidade 0.',
    icon: RotateCcw,
    confirmWord: 'ZERAR ESTOQUE',
    color: 'text-orange-500',
  },
  reset_sales: {
    title: 'Zerar Vendas',
    description: 'Todas as vendas, itens de venda e movimentações de estoque serão apagados permanentemente. Os produtos e clientes serão mantidos.',
    icon: XCircle,
    confirmWord: 'ZERAR VENDAS',
    color: 'text-orange-500',
  },
  cancel_orders: {
    title: 'Cancelar Todos os Pedidos',
    description: 'Todos os pedidos pendentes serão cancelados. Vendas já concluídas não serão afetadas.',
    icon: XCircle,
    confirmWord: 'CANCELAR PEDIDOS',
    color: 'text-orange-500',
  },
  delete_all: {
    title: 'Apagar Todas as Informações',
    description: 'ATENÇÃO: Esta ação apagará TODOS os dados do sistema — produtos, vendas, clientes, fornecedores, categorias, avaliações, movimentações de estoque, importações XML e logs de auditoria. Somente contas de usuário serão preservadas. Use para começar uma nova empresa do zero.',
    icon: AlertTriangle,
    confirmWord: 'APAGAR TUDO',
    color: 'text-destructive',
  },
};

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'product_manager'>('product_manager');
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);
  const [dangerAction, setDangerAction] = useState<string | null>(null);
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'MD Depósito',
    phone: '(85) 99999-9999',
    email: 'contato@mddeposito.com',
    address: 'Fortaleza, CE',
    whatsapp: '5585999999999',
  });
  const [notifications, setNotifications] = useState({
    emailSales: true,
    emailStock: true,
    pushSales: false,
  });

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = (roles || []).map(r => r.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
        setUserRoles((roles || []).map(r => ({
          ...r,
          profiles: profileMap[r.user_id] || null,
        })));
      } else {
        setUserRoles([]);
      }
    } catch (err) {
      console.error('Error fetching user roles:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast({ title: 'Acesso removido', description: 'O usuário foi removido do sistema.' });
      setDeleteTarget(null);
      fetchUserRoles();
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o usuário.' });
    }
  };

  const executeDangerAction = async () => {
    if (!dangerAction) return;
    const action = DANGER_ACTIONS[dangerAction as keyof typeof DANGER_ACTIONS];
    if (dangerConfirmText !== action.confirmWord) return;

    setDangerLoading(true);
    try {
      switch (dangerAction) {
        case 'reset_stock': {
          const { error } = await supabase
            .from('products')
            .update({ stock: 0 })
            .gte('stock', 0);
          if (error) throw error;
          // Clear stock movements
          const { error: smError } = await supabase
            .from('stock_movements')
            .delete()
            .gte('created_at', '1970-01-01');
          if (smError) throw smError;
          toast({ title: 'Estoque zerado', description: 'Todos os produtos tiveram o estoque zerado.' });
          break;
        }
        case 'reset_sales': {
          // Delete sale items first, then sales, then stock movements
          const { error: siError } = await supabase
            .from('sale_items')
            .delete()
            .gte('created_at', '1970-01-01');
          if (siError) throw siError;
          const { error: sError } = await supabase
            .from('sales')
            .delete()
            .gte('created_at', '1970-01-01');
          if (sError) throw sError;
          const { error: smError } = await supabase
            .from('stock_movements')
            .delete()
            .gte('created_at', '1970-01-01');
          if (smError) throw smError;
          toast({ title: 'Vendas zeradas', description: 'Todas as vendas e movimentações foram apagadas.' });
          break;
        }
        case 'cancel_orders': {
          const { error } = await supabase
            .from('sales')
            .update({ status: 'cancelled', tracking_status: 'cancelled' })
            .in('status', ['pending', 'processing']);
          if (error) throw error;
          toast({ title: 'Pedidos cancelados', description: 'Todos os pedidos pendentes foram cancelados.' });
          break;
        }
        case 'delete_all': {
          // Order matters due to foreign keys
          const tables = [
            { table: 'sale_items' as const, col: 'created_at' },
            { table: 'sales' as const, col: 'created_at' },
            { table: 'stock_movements' as const, col: 'created_at' },
            { table: 'supplier_products' as const, col: 'created_at' },
            { table: 'product_reviews' as const, col: 'created_at' },
            { table: 'cart_items' as const, col: 'created_at' },
            { table: 'xml_imports' as const, col: 'imported_at' },
            { table: 'products' as const, col: 'created_at' },
            { table: 'categories' as const, col: 'created_at' },
            { table: 'suppliers' as const, col: 'created_at' },
            { table: 'customers' as const, col: 'created_at' },
            { table: 'audit_log' as const, col: 'changed_at' },
          ];
          for (const { table, col } of tables) {
            const { error } = await supabase
              .from(table)
              .delete()
              .gte(col, '1970-01-01');
            if (error) {
              console.error(`Error deleting ${table}:`, error);
              throw error;
            }
          }
          toast({ title: 'Sistema limpo', description: 'Todas as informações foram apagadas. O sistema está pronto para uma nova empresa.' });
          break;
        }
      }

      // Log the action
      await supabase.from('audit_log').insert({
        action: `DANGER_ZONE: ${dangerAction}`,
        table_name: 'system',
        record_id: crypto.randomUUID(),
        changed_by: user?.id,
        new_values: { action: dangerAction, executed_at: new Date().toISOString() },
      });

    } catch (err: any) {
      console.error('Danger action error:', err);
      toast({ variant: 'destructive', title: 'Erro', description: `Falha ao executar: ${err.message}` });
    } finally {
      setDangerLoading(false);
      setDangerAction(null);
      setDangerConfirmText('');
    }
  };

  const handleSaveStore = () => {
    toast({
      title: 'Configurações salvas',
      description: 'As configurações da loja foram atualizadas.',
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: 'Notificações atualizadas',
      description: 'Suas preferências de notificação foram salvas.',
    });
  };

  const currentDangerAction = dangerAction ? DANGER_ACTIONS[dangerAction as keyof typeof DANGER_ACTIONS] : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users" className="gap-2">
              <UserCog className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-2">
              <Store className="h-4 w-4" />
              Loja
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="danger" className="gap-2 text-destructive data-[state=active]:text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Zona de Perigo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Gerenciar Usuários e Permissões
                </CardTitle>
                <CardDescription>
                  Controle quem tem acesso ao painel administrativo e quais permissões cada usuário possui.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Níveis de acesso:</p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge>admin</Badge>
                    <span className="text-muted-foreground">— Acesso total ao sistema</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">product_manager</Badge>
                    <span className="text-muted-foreground">— Somente cadastro, edição e exclusão de produtos (registrado no log)</span>
                  </div>
                </div>

                {loadingUsers ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRoles.map((ur) => (
                        <TableRow key={ur.id}>
                          <TableCell className="font-medium">{ur.profiles?.email || 'N/A'}</TableCell>
                          <TableCell>{ur.profiles?.full_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={ur.role === 'admin' ? 'default' : 'secondary'}>
                              {ur.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(ur.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            {ur.user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(ur)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="store">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Loja</CardTitle>
                <CardDescription>Configure as informações básicas da sua loja</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="storeName">Nome da Loja</Label>
                  <Input id="storeName" value={storeSettings.storeName} onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={storeSettings.phone} onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" value={storeSettings.whatsapp} onChange={(e) => setStoreSettings({ ...storeSettings, whatsapp: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={storeSettings.email} onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" value={storeSettings.address} onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })} />
                </div>
                <Button onClick={handleSaveStore}>Salvar Alterações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Administrador</CardTitle>
                <CardDescription>Informações da sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-medium text-primary">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{user?.email}</p>
                    <p className="text-sm text-muted-foreground">Administrador</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="userEmail">Email</Label>
                  <Input id="userEmail" type="email" value={user?.email || ''} disabled />
                  <p className="text-sm text-muted-foreground">O email não pode ser alterado</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Configure como você deseja receber notificações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificações de vendas por email</p>
                    <p className="text-sm text-muted-foreground">Receba um email quando uma nova venda for registrada</p>
                  </div>
                  <Switch checked={notifications.emailSales} onCheckedChange={(checked) => setNotifications({ ...notifications, emailSales: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertas de estoque baixo</p>
                    <p className="text-sm text-muted-foreground">Receba um email quando o estoque de um produto estiver baixo</p>
                  </div>
                  <Switch checked={notifications.emailStock} onCheckedChange={(checked) => setNotifications({ ...notifications, emailStock: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificações push</p>
                    <p className="text-sm text-muted-foreground">Receba notificações push no navegador</p>
                  </div>
                  <Switch checked={notifications.pushSales} onCheckedChange={(checked) => setNotifications({ ...notifications, pushSales: checked })} />
                </div>
                <Button onClick={handleSaveNotifications}>Salvar Preferências</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>Gerencie a segurança da sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Alterar Senha</h4>
                  <p className="text-sm text-muted-foreground mb-4">Para alterar sua senha, clique no botão abaixo e siga as instruções enviadas para seu email.</p>
                  <Button variant="outline">Solicitar Alteração de Senha</Button>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Sessões Ativas</h4>
                  <p className="text-sm text-muted-foreground mb-4">Você está logado em 1 dispositivo.</p>
                  <Button variant="outline">Encerrar Outras Sessões</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger">
            <div className="space-y-4">
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Zona de Perigo
                  </CardTitle>
                  <CardDescription>
                    Ações irreversíveis. Use com extremo cuidado. Ideal para quando deseja começar uma nova empresa ou limpar dados de teste.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(DANGER_ACTIONS).map(([key, action]) => {
                    const Icon = action.icon;
                    return (
                      <div key={key} className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className={`h-5 w-5 mt-0.5 ${action.color}`} />
                          <div>
                            <h4 className="font-medium">{action.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-4 shrink-0"
                          onClick={() => {
                            setDangerAction(key);
                            setDangerConfirmText('');
                          }}
                        >
                          Executar
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Remove user dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso de "{deleteTarget?.profiles?.email}"?
              Esta ação revogará todas as permissões do usuário no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveRole} className="bg-destructive text-destructive-foreground">
              Remover Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Danger zone confirmation dialog */}
      <AlertDialog open={!!dangerAction} onOpenChange={(open) => { if (!open) { setDangerAction(null); setDangerConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {currentDangerAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{currentDangerAction?.description}</p>
              <p className="font-medium text-destructive">
                Esta ação é irreversível! Para confirmar, digite <strong>"{currentDangerAction?.confirmWord}"</strong> abaixo:
              </p>
              <Input
                value={dangerConfirmText}
                onChange={(e) => setDangerConfirmText(e.target.value)}
                placeholder={`Digite ${currentDangerAction?.confirmWord}`}
                className="border-destructive/50 focus:border-destructive"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dangerLoading}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={dangerConfirmText !== currentDangerAction?.confirmWord || dangerLoading}
              onClick={executeDangerAction}
            >
              {dangerLoading ? 'Executando...' : 'Confirmar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Settings;
