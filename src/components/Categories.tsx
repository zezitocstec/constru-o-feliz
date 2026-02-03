import { Hammer, Paintbrush, Wrench, Zap, Droplets, TreeDeciduous, Lock, Lightbulb } from "lucide-react";

const categories = [
  { icon: Hammer, name: "Alvenaria", count: 150, color: "from-orange-500 to-amber-500" },
  { icon: Paintbrush, name: "Tintas", count: 89, color: "from-blue-500 to-cyan-500" },
  { icon: Wrench, name: "Ferramentas", count: 234, color: "from-slate-600 to-slate-700" },
  { icon: Zap, name: "Elétrica", count: 178, color: "from-yellow-500 to-orange-500" },
  { icon: Droplets, name: "Hidráulica", count: 123, color: "from-sky-500 to-blue-500" },
  { icon: TreeDeciduous, name: "Madeiras", count: 67, color: "from-amber-600 to-amber-700" },
  { icon: Lock, name: "Segurança", count: 45, color: "from-red-500 to-rose-500" },
  { icon: Lightbulb, name: "Iluminação", count: 98, color: "from-amber-400 to-yellow-500" },
];

const Categories = () => {
  return (
    <section id="categorias" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-3">
            Navegue por categoria
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-foreground mb-4">
            ENCONTRE O QUE VOCÊ PRECISA
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Organizamos nossos produtos em categorias para facilitar sua busca. 
            Clique em uma categoria para ver todos os produtos disponíveis.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category, index) => (
            <a
              key={category.name}
              href="#"
              className="group relative bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Gradient Background on Hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              
              {/* Content */}
              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:bg-primary-foreground/20 transition-colors`}>
                  <category.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-bold text-lg text-foreground group-hover:text-primary-foreground transition-colors mb-1">
                  {category.name}
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-primary-foreground/80 transition-colors">
                  {category.count} produtos
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
