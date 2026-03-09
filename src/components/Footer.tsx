import { Facebook, Instagram, Youtube, MapPin, ShieldCheck, LockKeyhole } from "lucide-react";

const Footer = () => {
  const links = {
    products: [
      { label: "Alvenaria", href: "#" },
      { label: "Tintas", href: "#" },
      { label: "Ferramentas", href: "#" },
      { label: "Elétrica", href: "#" },
      { label: "Hidráulica", href: "#" },
    ],
    institutional: [
      { label: "Sobre Nós", href: "#sobre" },
      { label: "Trabalhe Conosco", href: "#" },
      { label: "Política de Privacidade", href: "#" },
      { label: "Termos de Uso", href: "#" },
      { label: "Trocas e Devoluções", href: "#" },
    ],
    help: [
      { label: "Central de Ajuda", href: "#" },
      { label: "Como Comprar", href: "#" },
      { label: "Formas de Pagamento", href: "#" },
      { label: "Entregas", href: "#" },
      { label: "Fale Conosco", href: "#contato" },
    ],
  };

  return (
    <footer className="dark-gradient text-secondary-foreground">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#" className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 hero-gradient rounded-xl flex items-center justify-center">
                <span className="font-display text-2xl text-primary-foreground">DC</span>
              </div>
              <div>
                <h3 className="font-display text-xl text-primary-foreground tracking-wide">DEPÓSITO CONSTRUIR</h3>
                <p className="text-xs text-primary-foreground/60">Materiais de Construção</p>
              </div>
            </a>
            <p className="text-primary-foreground/70 mb-6 max-w-sm">
              Há mais de 20 anos oferecendo os melhores materiais de construção com qualidade, preço justo e atendimento
              especializado.
            </p>
            <div className="flex items-center gap-2 text-primary-foreground/70 mb-6">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Fortaleza, CE- Região Metropolitana</span>
            </div>
            <div className="flex gap-4">
              {[
                { icon: Facebook, href: "#" },
                { icon: Instagram, href: "#" },
                { icon: Youtube, href: "#" },
              ].map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center hover:bg-primary transition-colors"
                >
                  <social.icon className="w-5 h-5 text-primary-foreground" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">Produtos</h4>
            <ul className="space-y-3">
              {links.products.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-primary-foreground/70 hover:text-accent transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">Institucional</h4>
            <ul className="space-y-3">
              {links.institutional.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-primary-foreground/70 hover:text-accent transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">Ajuda & Segurança</h4>
            <ul className="space-y-3 mb-6">
              {links.help.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-primary-foreground/70 hover:text-accent transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <div className="bg-background/10 p-2 rounded flex flex-col items-center justify-center flex-1">
                <ShieldCheck className="w-6 h-6 text-accent mb-1" />
                <span className="text-[10px] uppercase text-center leading-tight">Compra<br/>Segura</span>
              </div>
              <div className="bg-background/10 p-2 rounded flex flex-col items-center justify-center flex-1">
                <LockKeyhole className="w-6 h-6 text-accent mb-1" />
                <span className="text-[10px] uppercase text-center leading-tight">Dados<br/>Protegidos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/60">
            <p>© 2026 IT.Sega4 — Automatize. Escale. Conquiste.</p>
            <p>Desenvolvido com © 2026 IT.Sega4</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
