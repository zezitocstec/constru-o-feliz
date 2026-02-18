import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Store, User, Bell, Shield, UserCog, Plus, Trash2 } from 'lucide-react';
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

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'product_manager'>('product_manager');
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);
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

      // Fetch profiles separately
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
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
                <CardDescription>
                  Configure as informações básicas da sua loja
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="storeName">Nome da Loja</Label>
                  <Input
                    id="storeName"
                    value={storeSettings.storeName}
                    onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={storeSettings.phone}
                      onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={storeSettings.whatsapp}
                      onChange={(e) => setStoreSettings({ ...storeSettings, whatsapp: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={storeSettings.email}
                    onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={storeSettings.address}
                    onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveStore}>Salvar Alterações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Administrador</CardTitle>
                <CardDescription>
                  Informações da sua conta
                </CardDescription>
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
                  <Input
                    id="userEmail"
                    type="email"
                    value={user?.email || ''}
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Configure como você deseja receber notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificações de vendas por email</p>
                    <p className="text-sm text-muted-foreground">
                      Receba um email quando uma nova venda for registrada
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailSales}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailSales: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertas de estoque baixo</p>
                    <p className="text-sm text-muted-foreground">
                      Receba um email quando o estoque de um produto estiver baixo
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailStock}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailStock: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificações push</p>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações push no navegador
                    </p>
                  </div>
                  <Switch
                    checked={notifications.pushSales}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, pushSales: checked })
                    }
                  />
                </div>
                <Button onClick={handleSaveNotifications}>Salvar Preferências</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>
                  Gerencie a segurança da sua conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Alterar Senha</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Para alterar sua senha, clique no botão abaixo e siga as instruções
                    enviadas para seu email.
                  </p>
                  <Button variant="outline">Solicitar Alteração de Senha</Button>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Sessões Ativas</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Você está logado em 1 dispositivo.
                  </p>
                  <Button variant="outline">Encerrar Outras Sessões</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
    </AdminLayout>
  );
};

export default Settings;
