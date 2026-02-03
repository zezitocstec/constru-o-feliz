import { Truck, Shield, Clock, CreditCard, Headphones, Award } from "lucide-react";

const benefits = [
  {
    icon: Truck,
    title: "Entrega Rápida",
    description: "Entregamos em toda a região metropolitana em até 24 horas úteis.",
  },
  {
    icon: Shield,
    title: "Garantia de Qualidade",
    description: "Todos os produtos com garantia de fábrica e troca garantida.",
  },
  {
    icon: Clock,
    title: "Atendimento Estendido",
    description: "Aberto de segunda a sábado, das 7h às 18h, para sua conveniência.",
  },
  {
    icon: CreditCard,
    title: "Pagamento Facilitado",
    description: "Parcelamos em até 12x no cartão ou desconto à vista.",
  },
  {
    icon: Headphones,
    title: "Suporte Especializado",
    description: "Equipe técnica pronta para ajudar na escolha dos materiais.",
  },
  {
    icon: Award,
    title: "Melhores Marcas",
    description: "Trabalhamos apenas com marcas reconhecidas no mercado.",
  },
];

const Benefits = () => {
  return (
    <section id="sobre" className="py-20 dark-gradient text-secondary-foreground overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-3">
            Por que escolher a gente?
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-primary-foreground mb-4">
            COMPROMISSO COM VOCÊ
          </h2>
          <p className="text-primary-foreground/70 max-w-2xl mx-auto">
            Há mais de 20 anos no mercado, oferecemos os melhores produtos e serviços 
            para sua construção ou reforma. Sua satisfação é nossa prioridade.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="group relative p-8 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl hero-gradient flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <benefit.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-primary-foreground mb-3">
                {benefit.title}
              </h3>
              <p className="text-primary-foreground/70 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "20+", label: "Anos de Experiência" },
            { value: "50k+", label: "Clientes Satisfeitos" },
            { value: "10k+", label: "Produtos Disponíveis" },
            { value: "99%", label: "Entregas no Prazo" },
          ].map((stat, index) => (
            <div key={stat.label} className="animate-fade-in" style={{ animationDelay: `${0.3 + index * 0.1}s` }}>
              <div className="font-display text-5xl md:text-6xl text-accent mb-2">
                {stat.value}
              </div>
              <p className="text-primary-foreground/70 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
