import { useState } from 'react';
import { Settings as SettingsIcon, Store, User, Bell, Shield } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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

        <Tabs defaultValue="store" className="space-y-6">
          <TabsList>
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
    </AdminLayout>
  );
};

export default Settings;
