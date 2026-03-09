import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';

const settingsSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  company_cnpj: z.string().min(1, 'CNPJ/CPF é obrigatório'),
  company_address: z.string().min(1, 'Endereço é obrigatório'),
  company_phone: z.string().min(1, 'Telefone é obrigatório'),
  company_logo: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const PDVSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

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
      });
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      if (settings?.id) {
        const { error } = await supabase
          .from('pdv_settings')
          .update(values)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pdv_settings')
          .insert([values]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdv-settings'] });
      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações.',
        variant: 'destructive',
      });
      console.error(error);
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    mutation.mutate(values);
  };

  return (
    <PDVLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Configurações do PDV</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
            <CardDescription>
              Essas informações serão impressas no cabeçalho do cupom não fiscal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="company_name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome da Empresa (Razão Social ou Fantasia)</FormLabel>
                          <FormControl>
                            <Input placeholder="Sua Empresa Ltda" {...field} />
                          </FormControl>
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
                          <FormControl>
                            <Input placeholder="00.000.000/0001-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="company_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone / WhatsApp</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
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
                          <FormControl>
                            <Input placeholder="Rua Exemplo, 123 - Bairro, Cidade/UF" {...field} />
                          </FormControl>
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
                          <FormControl>
                            <Input placeholder="https://exemplo.com/logo.png" {...field} value={field.value || ''} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            A logo será exibida no topo do cupom se o link for válido (preferência por PNG/JPG em fundo branco).
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={mutation.isPending || uploading}>
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Configurações
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
};

export default PDVSettings;
