import { useEffect, useState } from 'react';
import { Search, MessageCircle, Bot, User, Eye, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  session_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: string;
  messages_count: number;
  last_message_at: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

const ChatHistory = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchConversations(); }, []);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setConversations((data || []) as Conversation[]);
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as conversas.' });
    } finally {
      setLoading(false);
    }
  };

  const viewConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as mensagens.' });
    } finally {
      setLoadingMessages(false);
    }
  };

  const filtered = conversations.filter(c =>
    (c.session_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (selectedConv) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Button variant="ghost" className="gap-2" onClick={() => setSelectedConv(null)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversa - {new Date(selectedConv.created_at).toLocaleString('pt-BR')}
              </CardTitle>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>Sessão: {selectedConv.session_id.slice(0, 8)}...</span>
                {selectedConv.customer_name && <span>• {selectedConv.customer_name}</span>}
                <span>• {selectedConv.messages_count} mensagens</span>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMessages ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}>
                          {msg.content}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Histórico do Chatbot</h1>
          <p className="text-muted-foreground">Conversas dos leads e clientes com o assistente virtual</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{conversations.length}</div>
              <p className="text-sm text-muted-foreground">Total de conversas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {conversations.filter(c => {
                  const d = new Date(c.created_at);
                  const now = new Date();
                  return d.toDateString() === now.toDateString();
                }).length}
              </div>
              <p className="text-sm text-muted-foreground">Conversas hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {conversations.reduce((a, c) => a + c.messages_count, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total de mensagens</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversas
              </CardTitle>
              <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por sessão, nome ou email..."
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
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma conversa registrada ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sessão</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mensagens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Última Atividade</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((conv) => (
                      <TableRow key={conv.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{conv.session_id.slice(0, 8)}...</code>
                        </TableCell>
                        <TableCell>
                          {conv.customer_name || conv.customer_email || <span className="text-muted-foreground">Anônimo</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{conv.messages_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                            {conv.status === 'active' ? 'Ativa' : conv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(conv.last_message_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => viewConversation(conv)}>
                            <Eye className="h-4 w-4" /> Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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

export default ChatHistory;
