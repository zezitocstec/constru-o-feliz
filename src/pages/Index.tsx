import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import FeaturedProducts from "@/components/FeaturedProducts";
import Benefits from "@/components/Benefits";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Categories />
        <FeaturedProducts />
        <Benefits />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
