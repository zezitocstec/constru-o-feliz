import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, ShoppingBag, Trash2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const Checkout = () => {
  const { items, totalPrice, clearCart, removeItem } = useCart();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState("");

  const handleFinalize = () => {
    if (items.length === 0) return;
    setIsDialogOpen(true);
  };

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      toast({ variant: "destructive", title: "Informe seu nome" });
      return;
    }
    if (whatsappOptIn && !customerPhone.trim()) {
      toast({ variant: "destructive", title: "Informe o telefone para receber as notificações via WhatsApp" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create sale with source 'site' and status 'pending'
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          total: totalPrice,
          profit: 0,
          status: "pending",
          source: "site",
          delivery_type: "delivery",
          tracking_status: "pending",
          whatsapp_opt_in: whatsappOptIn,
        })
        .select("id")
        .single();

      if (saleError) throw new Error(saleError.message);

      // Create sale items
      const saleItems = items.map((item) => ({
        sale_id: saleData.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        cost_price: 0,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw new Error(itemsError.message);

      setOrderId(saleData.id.substring(0, 8).toUpperCase());
      setOrderComplete(true);
      setIsDialogOpen(false);
      clearCart();

      toast({
        title: "Pedido enviado com sucesso!",
        description: `Código: #${saleData.id.substring(0, 8).toUpperCase()}`,
      });
    } catch (error: any) {
      console.error("Order error:", error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar pedido",
        description: error.message || "Tente novamente",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-display text-3xl text-foreground mb-2">
              Pedido Enviado!
            </h1>
            <div className="bg-muted rounded-xl p-4 mb-6">
              <p className="text-sm text-muted-foreground">Código do pedido</p>
              <p className="text-2xl font-bold text-primary font-mono">#{orderId}</p>
            </div>
            <p className="text-muted-foreground mb-4">
              Seu pedido foi recebido e será processado pela nossa equipe.
              Entraremos em contato para confirmar os detalhes e forma de pagamento.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Você pode acompanhar o status do pedido na página de{" "}
              <a href="/rastreio" className="text-primary underline font-medium">Rastreio</a>.
            </p>
            <Button size="lg" onClick={() => navigate("/")}>
              Voltar para a Loja
            </Button>
          </div>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="font-display text-3xl text-foreground mb-4">
              Carrinho Vazio
            </h1>
            <p className="text-muted-foreground mb-8">
              Adicione produtos ao carrinho para continuar com o pedido.
            </p>
            <Button size="lg" onClick={() => navigate("/")}>
              Ver Produtos
            </Button>
          </div>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para a Loja
        </Button>

        <h1 className="font-display text-4xl text-foreground mb-8">
          Seu Carrinho
        </h1>

        <div className="max-w-2xl mx-auto">
          <div className="space-y-4 mb-6">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 bg-card rounded-xl border">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{item.brand}</p>
                  <h4 className="font-medium text-foreground">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Qtd: {item.quantity}
                  </p>
                  <p className="text-primary font-bold">
                    R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border p-6 mb-6">
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Total:</span>
              <span className="text-2xl font-bold text-primary">
                R$ {totalPrice.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={handleFinalize}>
            Finalizar Pedido
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Entraremos em contato para confirmar o pedido e informar as formas de pagamento disponíveis.
          </p>
        </div>
      </main>
      <Footer />
      <WhatsAppButton />

      {/* Name popup dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar Pedido</DialogTitle>
            <DialogDescription>
              Informe seus dados para registrar o pedido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="checkout-name">Nome *</Label>
              <Input
                id="checkout-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome completo"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSubmitOrder()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">Telefone (opcional)</Label>
              <Input
                id="checkout-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                onKeyDown={(e) => e.key === "Enter" && handleSubmitOrder()}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1 pb-2">
              <Checkbox
                id="whatsapp-opt-in"
                checked={whatsappOptIn}
                onCheckedChange={(checked) => setWhatsappOptIn(checked as boolean)}
              />
              <Label htmlFor="whatsapp-opt-in" className="text-sm font-normal cursor-pointer leading-none">
                Desejo receber atualizações do pedido via WhatsApp
              </Label>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Itens:</span>
                <span>{items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span className="text-primary">
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitOrder} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Confirmar Pedido"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checkout;
