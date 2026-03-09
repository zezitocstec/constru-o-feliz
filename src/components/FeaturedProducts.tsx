import { ShoppingCart, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  old_price: number | null;
  image_url: string | null;
  tag: string | null;
  category: string | null;
}

const fetchFeaturedProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, price, old_price, image_url, tag, category")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  return data || [];
};

const fetchAverageRatings = async (productIds: string[]) => {
  if (productIds.length === 0) return {};
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id, rating")
    .in("product_id", productIds)
    .eq("is_approved", true);
  if (error) return {};
  
  const ratings: Record<string, { avg: number; count: number }> = {};
  (data || []).forEach((r) => {
    if (!ratings[r.product_id]) ratings[r.product_id] = { avg: 0, count: 0 };
    ratings[r.product_id].count++;
    ratings[r.product_id].avg += r.rating;
  });
  Object.keys(ratings).forEach((k) => {
    ratings[k].avg = parseFloat((ratings[k].avg / ratings[k].count).toFixed(1));
  });
  return ratings;
};

const FeaturedProducts = () => {
  const { addItem } = useCart();

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["featured-products"],
    queryFn: fetchFeaturedProducts,
  });

  const { data: ratings = {} } = useQuery({
    queryKey: ["product-ratings", products.map((p) => p.id)],
    queryFn: () => fetchAverageRatings(products.map((p) => p.id)),
    enabled: products.length > 0,
  });

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      brand: product.brand || "",
      price: product.price,
      image: product.image_url || "/placeholder.svg",
    });
    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  return (
    <section id="produtos" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-12">
          <div>
            <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-3">
              Produtos em destaque
            </span>
            <h2 className="font-display text-4xl md:text-5xl text-foreground">
              CONFIRA NOSSAS OFERTAS
            </h2>
          </div>
          <Button variant="outline" size="lg" className="group" onClick={() => document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' })}>
            Ver todos os produtos
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingProducts
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-card rounded-2xl overflow-hidden card-shadow">
                  <Skeleton className="w-full aspect-square" />
                  <div className="p-5">
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-6 w-full mb-3" />
                    <Skeleton className="h-4 w-1/4 mb-4" />
                    <Skeleton className="h-8 w-1/2" />
                  </div>
                </div>
              ))
            : products.map((product, index) => {
                const r = ratings[product.id];
                return (
                  <div
                    key={product.id}
                    className="group bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      <img
                        src={product.image_url || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      {product.tag && (
                        <span className="absolute top-4 left-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full">
                          {product.tag}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Button
                        size="icon"
                        className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
                        onClick={() => handleAddToCart(product)}
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="p-5">
                      <p className="text-sm text-muted-foreground mb-1">{product.brand || "Marca não informada"}</p>
                      <h3 className="font-semibold text-lg text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>

                      {r && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-accent text-accent" />
                            <span className="text-sm font-medium text-foreground">{r.avg}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">({r.count} avaliações)</span>
                        </div>
                      )}

                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-primary">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </span>
                        {product.old_price && (
                          <span className="text-sm text-muted-foreground line-through mb-1">
                            R$ {product.old_price.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
