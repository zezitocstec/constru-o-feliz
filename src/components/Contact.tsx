import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Contact = () => {
  return (
    <section id="contato" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Contact Info */}
          <div>
            <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-3">
              Entre em contato
            </span>
            <h2 className="font-display text-4xl md:text-5xl text-foreground mb-6">
              ESTAMOS AQUI PARA AJUDAR
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg">
              Precisa de ajuda para escolher os materiais certos? Nossa equipe especializada 
              está pronta para atender você e fazer seu orçamento sem compromisso.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: MapPin,
                  title: "Endereço",
                  content: "Rua das Construções, 1234\nJardim Paulista - São Paulo, SP",
                },
                {
                  icon: Phone,
                  title: "Telefone",
                  content: "(11) 99999-9999\n(11) 3333-4444",
                },
                {
                  icon: Mail,
                  title: "E-mail",
                  content: "contato@depositoconstruir.com.br\norcamento@depositoconstruir.com.br",
                },
                {
                  icon: Clock,
                  title: "Horário de Funcionamento",
                  content: "Segunda a Sexta: 7h às 18h\nSábado: 7h às 14h",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl hero-gradient flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-muted-foreground whitespace-pre-line text-sm">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-card rounded-2xl p-8 card-shadow">
            <h3 className="font-display text-2xl text-foreground mb-2">SOLICITE SEU ORÇAMENTO</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Preencha o formulário abaixo e entraremos em contato rapidamente.
            </p>

            <form className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
                  <Input placeholder="Seu nome completo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Telefone</label>
                  <Input placeholder="(11) 99999-9999" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">E-mail</label>
                <Input type="email" placeholder="seu@email.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Assunto</label>
                <Input placeholder="Ex: Orçamento para reforma" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mensagem</label>
                <textarea
                  rows={4}
                  placeholder="Descreva o que você precisa..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <Button type="submit" size="lg" className="w-full">
                Enviar Mensagem
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="mt-12 rounded-2xl overflow-hidden h-[300px] bg-muted flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Mapa da localização</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
