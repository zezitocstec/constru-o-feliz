import { useEffect, useState } from 'react';
import { Search, ClipboardList, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

const actionConfig = {
  INSERT: { label: 'Criação', icon: Plus, variant: 'default' as const, color: 'text-green-600' },
  UPDATE: { label: 'Edição', icon: Pencil, variant: 'secondary' as const, color: 'text-blue-600' },
  DELETE: { label: 'Exclusão', icon: Trash2, variant: 'destructive' as const, color: 'text-red-600' },
};

const AuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditLog();
  }, []);

  const fetchAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setEntries((data || []) as AuditEntry[]);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar o log.' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = entries.filter(e =>
    e.table_name.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Registro de Atividades</h1>
          <p className="text-muted-foreground">Histórico completo de todas as alterações no sistema</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Log de Auditoria
              </CardTitle>
              <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tabela ou ação..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma atividade registrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Alterações</TableHead>
                      <TableHead>Data/Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((entry) => {
                      const cfg = actionConfig[entry.action];
                      const changes = entry.new_values
                        ? Object.keys(entry.new_values).filter(k => k !== 'updated_at').slice(0, 3)
                        : [];
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge variant={cfg.variant} className="gap-1">
                              <cfg.icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{entry.table_name}</code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {changes.length > 0
                              ? changes.map(k => (
                                  <span key={k} className="mr-2">
                                    <strong>{k}:</strong> {String((entry.new_values as Record<string, unknown>)[k]).slice(0, 30)}
                                  </span>
                                ))
                              : entry.action === 'DELETE' ? 'Registro excluído' : '-'
                            }
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(entry.changed_at).toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AuditLog;
