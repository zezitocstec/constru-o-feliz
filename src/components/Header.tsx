import { Phone, MapPin, Menu, X, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import CartDrawer from "@/components/CartDrawer";
import { useAuth } from "@/hooks/useAuth";

const HiddenAdminAccess = () => {
  const navigate = useNavigate();
  const clickCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    clickCountRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      navigate('/auth');
    } else {
      timerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 600);
    }
  }, [navigate]);

  return (
    <div
      onClick={handleClick}
      className="w-10 h-10 cursor-default select-none"
      aria-hidden="true"
    />
  );
};

const Header = () => {
  const { user, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = [{
    label: "Início",
    href: "#"
  }, {
    label: "Produtos",
    href: "#produtos"
  }, {
    label: "Categorias",
    href: "#categorias"
  }, {
    label: "Sobre",
    href: "#sobre"
  }, {
    label: "Contato",
    href: "#contato"
  }];
  return <header className="sticky top-0 z-50 w-full">
      {/* Top bar */}
      <div className="dark-gradient text-secondary-foreground">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center text-sm">
          <div className="flex items-center gap-6">
            <a href="tel:+5511999999999" className="flex items-center gap-2 hover:text-accent transition-colors">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">(11) 99999-9999</span>
            </a>
            <a href="#contato" className="flex items-center gap-2 hover:text-accent transition-colors">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Fortaleza, Ce </span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-accent font-semibold">Entrega para toda região!</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href="#" className="flex items-center gap-3">
              <div className="w-12 h-12 hero-gradient rounded-xl flex items-center justify-center">
                <span className="font-display text-2xl text-primary-foreground">DC</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-display text-2xl text-foreground tracking-wide">MD DEPÓSITO </h1>
                <p className="text-xs text-muted-foreground -mt-1">Materiais de Construção</p>
              </div>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map(link => <a key={link.label} href={link.href} className="text-foreground font-medium hover:text-primary transition-colors relative group">
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
                </a>)}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {isAdmin ? (
                <Link to="/admin">
                  <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    <LayoutDashboard className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              ) : (
                <HiddenAdminAccess />
              )}
              <CartDrawer />
              <Button className="hidden sm:inline-flex" size="lg" onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}>
                Fazer Orçamento
              </Button>

              {/* Mobile menu toggle */}
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && <nav className="lg:hidden mt-4 pb-4 border-t border-border pt-4 animate-fade-in">
              <div className="flex flex-col gap-4">
                {navLinks.map(link => <a key={link.label} href={link.href} className="text-foreground font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
                    {link.label}
                  </a>)}
                <Button className="w-full mt-2" size="lg" onClick={() => { setMobileMenuOpen(false); document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  Fazer Orçamento
                </Button>
              </div>
            </nav>}
        </div>
      </div>
    </header>;
};
export default Header;
