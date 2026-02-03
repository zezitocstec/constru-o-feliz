import { ShoppingCart, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";

const products = [
  {
    id: 1,
    name: "Cimento CP II 50kg",
    brand: "Votoran",
    price: 39.90,
    oldPrice: 45.90,
    rating: 4.8,
    reviews: 234,
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=400&h=400&fit=crop",
    tag: "Mais Vendido",
  },
  {
    id: 2,
    name: "Tinta Acrílica 18L",
    brand: "Suvinil",
    price: 289.90,
    oldPrice: 329.90,
    rating: 4.9,
    reviews: 189,
    image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=400&fit=crop",
    tag: "Oferta",
  },
  {
    id: 3,
    name: "Furadeira de Impacto",
    brand: "Bosch",
    price: 459.90,
    oldPrice: null,
    rating: 4.7,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop",
    tag: null,
  },
  {
    id: 4,
    name: "Argamassa AC III 20kg",
    brand: "Quartzolit",
    price: 54.90,
    oldPrice: 62.90,
    rating: 4.6,
    reviews: 98,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
    tag: "Promoção",
  },
  {
    id: 5,
    name: "Tijolo Cerâmico 6 Furos",
    brand: "Premium",
    price: 0.89,
    oldPrice: 1.10,
    rating: 4.5,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=400&fit=crop",
    tag: "Atacado",
  },
  {
    id: 6,
    name: "Kit Ferramentas 129 Peças",
    brand: "Tramontina",
    price: 299.90,
    oldPrice: 399.90,
    rating: 4.8,
    reviews: 87,
    image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&h=400&fit=crop",
    tag: "25% OFF",
  },
];

const FeaturedProducts = () => {
  const { addItem } = useCart();

  const handleAddToCart = (product: typeof products[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: product.image,
    });
    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  return (
    <section id="produtos" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-12">
          <div>
            <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-3">
              Produtos em destaque
            </span>
            <h2 className="font-display text-4xl md:text-5xl text-foreground">
              CONFIRA NOSSAS OFERTAS
            </h2>
          </div>
          <Button variant="outline" size="lg" className="group">
            Ver todos os produtos
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="group bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Image */}
              <div className="relative aspect-square bg-muted overflow-hidden">
                <img
                  src={product.image}
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

              {/* Content */}
              <div className="p-5">
                <p className="text-sm text-muted-foreground mb-1">{product.brand}</p>
                <h3 className="font-semibold text-lg text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-accent text-accent" />
                    <span className="text-sm font-medium text-foreground">{product.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">({product.reviews} avaliações)</span>
                </div>

                {/* Price */}
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-primary">
                    R$ {product.price.toFixed(2).replace(".", ",")}
                  </span>
                  {product.oldPrice && (
                    <span className="text-sm text-muted-foreground line-through mb-1">
                      R$ {product.oldPrice.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
