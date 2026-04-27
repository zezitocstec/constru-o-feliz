import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, Save, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

const settingsSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  company_cnpj: z.string().min(1, 'CNPJ/CPF é obrigatório'),
  company_address: z.string().min(1, 'Endereço é obrigatório'),
  company_phone: z.string().min(1, 'Telefone é obrigatório'),
  company_logo: z.string().optional(),
  manager_whatsapp: z.string().optional().or(z.literal('')),
  manager_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  daily_summary_enabled: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const PDVSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['pdv-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pdv_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      company_name: '',
      company_cnpj: '',
      company_address: '',
      company_phone: '',
      company_logo: '',
      manager_whatsapp: '',
      manager_email: '',
      daily_summary_enabled: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        company_name: settings.company_name || '',
        company_cnpj: settings.company_cnpj || '',
        company_address: settings.company_address || '',
        company_phone: settings.company_phone || '',
        company_logo: settings.company_logo || '',
        manager_whatsapp: (settings as any).manager_whatsapp || '',
        manager_email: (settings as any).manager_email || '',
        daily_summary_enabled: !!(settings as any).daily_summary_enabled,
      });
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const payload = {
        ...values,
        manager_whatsapp: values.manager_whatsapp || null,
        manager_email: values.manager_email || null,
      };
      if (settings?.id) {
        const { error } = await supabase
          .from('pdv_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pdv_settings')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdv-settings'] });
      toast({ title: 'Sucesso', description: 'Configurações salvas com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: 'Erro ao salvar configurações.', variant: 'destructive' });
      console.error(error);
    },
  });

  const sendTestSummary = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-daily-sales-summary', {
        body: { force: true },
      });
      if (error) throw error;
      const r: any = data || {};
      const wOk = r?.results?.whatsapp?.ok || r?.results?.whatsapp?.simulated;
      const eOk = r?.results?.email?.ok;
      toast({
        title: 'Resumo enviado',
        description: `WhatsApp: ${wOk ? 'OK' : 'falhou/desativado'} · E-mail: ${eOk ? 'OK' : 'falhou/desativado'}`,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar resumo', description: e.message, variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  };

  const onSubmit = (values: SettingsFormValues) => mutation.mutate(values);

  return (
    <PDVLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Configurações do PDV</h1>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dados da Empresa</CardTitle>
                  <CardDescription>
                    Essas informações serão impressas no cabeçalho do cupom não fiscal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="company_name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome da Empresa (Razão Social ou Fantasia)</FormLabel>
                          <FormControl><Input placeholder="Sua Empresa Ltda" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company_cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ / CPF</FormLabel>
                          <FormControl><Input placeholder="00.000.000/0001-00" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone / WhatsApp da Loja</FormLabel>
                          <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company_address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Endereço Completo</FormLabel>
                          <FormControl><Input placeholder="Rua Exemplo, 123 - Bairro, Cidade/UF" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company_logo"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>URL da Logo (Opcional)</FormLabel>
                          <FormControl><Input placeholder="https://exemplo.com/logo.png" {...field} value={field.value || ''} /></FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            A logo será exibida no topo do cupom (preferência por PNG/JPG em fundo branco).
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notificações do Gestor — Resumo Diário</CardTitle>
                  <CardDescription>
                    Receba todo dia o fechamento do caixa (vendas PDV/NFC-e, cancelamentos, devoluções e cupons emitidos)
                    via WhatsApp e e-mail. O envio acontece automaticamente às 20:00 (Brasília).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="manager_whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp do Gestor</FormLabel>
                          <FormControl><Input placeholder="(00) 00000-0000" {...field} value={field.value || ''} /></FormControl>
                          <FormDescription>Número que receberá o resumo diário.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manager_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail do Gestor</FormLabel>
                          <FormControl><Input type="email" placeholder="gestor@empresa.com" {...field} value={field.value || ''} /></FormControl>
                          <FormDescription>E-mail que receberá o relatório diário.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="daily_summary_enabled"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2 flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Ativar envio automático do resumo diário</FormLabel>
                            <FormDescription>
                              Quando ativo, o sistema envia o fechamento todos os dias às 20:00 (Brasília).
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6">
                    <p className="text-xs text-muted-foreground">
                      {settings && (settings as any).daily_summary_last_sent_at
                        ? `Último envio: ${new Date((settings as any).daily_summary_last_sent_at).toLocaleString('pt-BR')}`
                        : 'Nenhum resumo enviado ainda.'}
                    </p>
                    <Button type="button" variant="outline" onClick={sendTestSummary} disabled={sendingTest}>
                      {sendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Enviar resumo de hoje agora
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" disabled={mutation.isPending || uploading}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </PDVLayout>
  );
};

export default PDVSettings;
