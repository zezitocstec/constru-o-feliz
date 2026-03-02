import { Hammer, Paintbrush, Wrench, Zap, Droplets, TreeDeciduous, Lock, Lightbulb, LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const iconMap: Record<string, LucideIcon> = {
  Alvenaria: Hammer,
  Tintas: Paintbrush,
  Ferramentas: Wrench,
  "Elétrica": Zap,
  "Hidráulica": Droplets,
  Madeiras: TreeDeciduous,
  "Segurança": Lock,
  "Iluminação": Lightbulb,
};

const colorMap: Record<string, string> = {
  Alvenaria: "from-orange-500 to-amber-500",
  Tintas: "from-blue-500 to-cyan-500",
  Ferramentas: "from-slate-600 to-slate-700",
  "Elétrica": "from-yellow-500 to-orange-500",
  "Hidráulica": "from-sky-500 to-blue-500",
  Madeiras: "from-amber-600 to-amber-700",
  "Segurança": "from-red-500 to-rose-500",
  "Iluminação": "from-amber-400 to-yellow-500",
};

const fetchCategoryCounts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("is_active", true);
  if (error) throw error;

  const counts: Record<string, number> = {};
  (data || []).forEach((p) => {
    if (p.category) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
  });
  return counts;
};

const Categories = () => {
  const { data: counts = {} } = useQuery({
    queryKey: ["category-counts"],
    queryFn: fetchCategoryCounts,
  });

  const categoryNames = ["Alvenaria", "Tintas", "Ferramentas", "Elétrica", "Hidráulica", "Madeiras", "Segurança", "Iluminação"];

  return (
    <section id="categorias" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categoryNames.map((name, index) => {
            const Icon = iconMap[name] || Hammer;
            const color = colorMap[name] || "from-gray-500 to-gray-600";
            const count = counts[name] || 0;

            return (
              <button
                key={name}
                onClick={() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' })}
                className="group relative bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden animate-fade-in text-left"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:bg-primary-foreground/20 transition-colors`}>
                    <Icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground group-hover:text-primary-foreground transition-colors mb-1">
                    {name}
                  </h3>
                  <p className="text-sm text-muted-foreground group-hover:text-primary-foreground/80 transition-colors">
                    {count} produto{count !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Categories;
