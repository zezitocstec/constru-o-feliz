import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import FeaturedProducts from "@/components/FeaturedProducts";
import Benefits from "@/components/Benefits";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ChatbotWidget from "@/components/ChatbotWidget";

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
      <WhatsAppButton />
      <ChatbotWidget />
    </div>
  );
};

export default Index;
