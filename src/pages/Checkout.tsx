import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, ShoppingBag, Trash2, Loader2, Printer } from "lucide-react";
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

type PrintData = {
  orderId: string;
  fullId: string;
  trackingCode: string;
  customerName: string;
  customerPhone: string;
  createdAt: Date;
  total: number;
  items: { name: string; quantity: number; price: number }[];
  seller: string;
  store: {
    name: string;
    cnpj: string;
    address: string;
    phone: string;
  };
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function buildReceiptHTML(d: PrintData): string {
  const date = d.createdAt.toLocaleDateString("pt-BR");
  const time = d.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const itemsRows = d.items
    .map(
      (i) => `
      <tr>
        <td>${i.quantity}x</td>
        <td>${i.name}</td>
        <td style="text-align:right">${formatBRL(i.price * i.quantity)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Via do Cliente - #${d.orderId}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; margin: 0; padding: 8px; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .muted { color: #444; }
  .center { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; font-size: 11px; }
  .total { font-size: 14px; font-weight: bold; }
  .track { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px; padding: 6px; border: 2px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  @media screen { body { max-width: 320px; margin: 16px auto; border: 1px solid #ddd; } }
</style>
</head>
<body>
  <h1>${d.store.name}</h1>
  <div class="center muted">${d.store.cnpj}</div>
  <div class="center muted">${d.store.address}</div>
  <div class="center muted">${d.store.phone}</div>

  <div class="sep"></div>
  <div class="center"><strong>VIA DO CLIENTE</strong></div>
  <div class="center muted">Comprovante de Pedido</div>

  <div class="sep"></div>
  <div class="row"><span>Data:</span><span>${date} ${time}</span></div>
  <div class="row"><span>Pedido:</span><span>#${d.orderId}</span></div>
  <div class="row"><span>Vendedor:</span><span>${d.seller}</span></div>
  <div class="row"><span>Loja:</span><span>${d.store.name}</span></div>

  <div class="sep"></div>
  <div><strong>Cliente:</strong> ${d.customerName}</div>
  ${d.customerPhone ? `<div><strong>Telefone:</strong> ${d.customerPhone}</div>` : ""}

  <div class="sep"></div>
  <table>
    <thead>
      <tr><td><strong>Qtd</strong></td><td><strong>Item</strong></td><td style="text-align:right"><strong>Total</strong></td></tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="sep"></div>
  <div class="row total"><span>TOTAL:</span><span>${formatBRL(d.total)}</span></div>

  <div class="sep"></div>
  <div class="center muted">Código de Rastreio</div>
  <div class="track">${d.trackingCode}</div>
  <div class="center muted">Acompanhe em /rastreio</div>

  <div class="sep"></div>
  <div class="center muted">Obrigado pela preferência!</div>

  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`;
}

function openReceiptWindow(html: string) {
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) {
    toast({
      variant: "destructive",
      title: "Pop-up bloqueado",
      description: "Permita pop-ups para imprimir a via do cliente.",
    });
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

const Checkout = () => {
  const { items, totalPrice, clearCart, removeItem } = useCart();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [printData, setPrintData] = useState<PrintData | null>(null);

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
      // Snapshot dos itens antes de limpar o carrinho
      const itemsSnapshot = items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      }));
      const totalSnapshot = totalPrice;

      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          total: totalSnapshot,
          profit: 0,
          status: "pending",
          source: "site",
          delivery_type: "delivery",
          tracking_status: "pending",
          whatsapp_opt_in: whatsappOptIn,
        })
        .select("id, created_at")
        .single();

      if (saleError) throw new Error(saleError.message);

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

      // Buscar dados da loja (best-effort)
      let storeInfo = {
        name: "Loja",
        cnpj: "",
        address: "",
        phone: "",
      };
      try {
        const { data: settings } = await supabase
          .from("pdv_settings")
          .select("company_name, company_cnpj, company_address, company_phone")
          .maybeSingle();
        if (settings) {
          storeInfo = {
            name: settings.company_name || storeInfo.name,
            cnpj: settings.company_cnpj || "",
            address: settings.company_address || "",
            phone: settings.company_phone || "",
          };
        }
      } catch (e) {
        console.warn("Não foi possível carregar dados da loja", e);
      }

      const shortId = saleData.id.substring(0, 8).toUpperCase();
      const data: PrintData = {
        orderId: shortId,
        fullId: saleData.id,
        trackingCode: shortId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        createdAt: saleData.created_at ? new Date(saleData.created_at) : new Date(),
        total: totalSnapshot,
        items: itemsSnapshot,
        seller: "Loja Online",
        store: storeInfo,
      };

      setOrderId(shortId);
      setPrintData(data);
      setOrderComplete(true);
      setIsDialogOpen(false);
      clearCart();

      // Abre janela de impressão automaticamente
      openReceiptWindow(buildReceiptHTML(data));

      toast({
        title: "Pedido enviado com sucesso!",
        description: `Código: #${shortId}`,
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

  const handleReprint = () => {
    if (printData) openReceiptWindow(buildReceiptHTML(printData));
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
            <p className="text-sm text-muted-foreground mb-6">
              Você pode acompanhar o status do pedido na página de{" "}
              <a href="/rastreio" className="text-primary underline font-medium">Rastreio</a>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" size="lg" onClick={handleReprint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Via do Cliente
              </Button>
              <Button size="lg" onClick={() => navigate("/")}>
                Voltar para a Loja
              </Button>
            </div>
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

            <p className="text-xs text-muted-foreground">
              Após confirmar, abriremos automaticamente a <strong>via do cliente</strong> para impressão.
            </p>
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
