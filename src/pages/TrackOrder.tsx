import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Package, CheckCircle, Truck, Clock, XCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TrackOrder = () => {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) {
      toast({ variant: "destructive", title: "Informe o código do pedido" });
      return;
    }

    setIsLoading(true);
    setOrder(null);
    try {
      // Query recent site orders
      const { data, error } = await supabase
        .from("sales")
        .select("id, status, tracking_status, created_at, total")
        .eq("source", "site")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Find the specific order by ID prefix
      const foundOrder = data?.find(o => 
        o.id.toUpperCase().startsWith(orderId.trim().toUpperCase())
      );

      if (foundOrder) {
        setOrder(foundOrder);
      } else {
        toast({
          variant: "destructive",
          title: "Pedido não encontrado",
          description: "Verifique o código e tente novamente.",
        });
      }
    } catch (error: any) {
      console.error("Error fetching order:", error);
      toast({
        variant: "destructive",
        title: "Erro ao buscar pedido",
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = (status: string, tracking_status: string) => {
    if (status === "cancelled" || tracking_status === "cancelled") {
      return { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", text: "Cancelado", description: "Seu pedido foi cancelado." };
    }

    switch (tracking_status) {
      case "pending":
        return { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", text: "Pendente", description: "Aguardando confirmação no caixa." };
      case "confirmed":
        return { icon: CheckCircle, color: "text-blue-500", bg: "bg-blue-500/10", text: "Confirmado", description: "Pagamento confirmado. Em breve seu pedido será preparado." };
      case "leaving_warehouse":
        return { icon: Package, color: "text-orange-500", bg: "bg-orange-500/10", text: "Saindo do Depósito", description: "Seu pedido está sendo preparado para envio." };
      case "on_the_way":
        return { icon: Truck, color: "text-purple-500", bg: "bg-purple-500/10", text: "A Caminho", description: "O entregador já está a caminho do seu endereço." };
      case "delivered":
        return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", text: "Recebido", description: "O pedido foi entregue com sucesso!" };
      default:
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", text: "Pendente", description: "Aguardando atualização." };
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para a Loja
        </Button>

        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-4xl text-foreground mb-4">
              Rastrear Pedido
            </h1>
            <p className="text-muted-foreground">
              Acompanhe o status da sua entrega informando o código do pedido recebido no momento da compra.
            </p>
          </div>

          <div className="bg-card rounded-xl border p-6 mb-8 shadow-sm">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="orderId" className="sr-only">Código do Pedido</Label>
                <Input
                  id="orderId"
                  placeholder="Ex: A1B2C3D4"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full text-lg uppercase font-mono"
                  maxLength={8}
                />
              </div>
              <Button type="submit" size="lg" disabled={isLoading} className="px-8">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </form>
          </div>

          {order && (
            <div className="bg-card rounded-xl border p-6 shadow-sm animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pedido</p>
                  <p className="text-2xl font-bold font-mono text-primary">
                    #{order.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm text-muted-foreground mb-1">Data da compra</p>
                  <p className="font-medium">
                    {format(new Date(order.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-4">Status atual</p>
                
                {(() => {
                  const status = getStatusDisplay(order.status, order.tracking_status);
                  const StatusIcon = status.icon;
                  
                  return (
                    <div className={`flex items-center gap-4 p-4 rounded-lg ${status.bg}`}>
                      <StatusIcon className={`w-8 h-8 ${status.color}`} />
                      <div>
                        <p className={`font-bold text-lg ${status.color}`}>{status.text}</p>
                        {order.tracking_status === "out_for_delivery" && (
                          <p className="text-sm mt-1 text-foreground/80">O entregador já está a caminho do seu endereço.</p>
                        )}
                        {order.tracking_status === "delivered" && (
                          <p className="text-sm mt-1 text-foreground/80">O pedido foi entregue com sucesso!</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-muted-foreground">Valor Total:</span>
                <span className="text-xl font-bold">
                  R$ {Number(order.total).toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default TrackOrder;
