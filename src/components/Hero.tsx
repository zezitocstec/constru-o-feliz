import { Search, ArrowRight, Truck, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import heroImage from "@/assets/hero-construction.jpg";

const Hero = () => {
  const highlights = [
    { icon: Truck, text: "Entrega Rápida" },
    { icon: Shield, text: "Garantia de Qualidade" },
    { icon: Clock, text: "Atendimento 7h-18h" },
  ];

  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Depósito de materiais de construção"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/80 to-secondary/40" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm text-accent px-4 py-2 rounded-full mb-6 animate-fade-in">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-sm font-semibold">Ofertas especiais toda semana!</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-primary-foreground leading-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            TUDO PARA SUA{" "}
            <span className="text-accent">OBRA</span>{" "}
            EM UM SÓ LUGAR
          </h1>

          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Os melhores materiais de construção com os menores preços da região. 
            Entrega rápida e atendimento especializado para sua obra.
          </p>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar produtos... (cimento, tijolos, ferramentas)"
                className="pl-12 h-14 rounded-xl bg-card/95 backdrop-blur border-0 text-base"
              />
            </div>
            <Button variant="hero" className="h-14">
              Buscar
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Button variant="hero">
              Ver Produtos
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="heroOutline">
              Fazer Orçamento Grátis
            </Button>
          </div>

          {/* Highlights */}
          <div className="flex flex-wrap gap-6 animate-fade-in" style={{ animationDelay: "0.5s" }}>
            {highlights.map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-primary-foreground/90">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
