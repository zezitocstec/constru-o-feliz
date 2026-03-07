import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Stock from "./pages/admin/Stock";
import Sales from "./pages/admin/Sales";
import Orders from "./pages/admin/Orders";
import Reports from "./pages/admin/Reports";
import Customers from "./pages/admin/Customers";
import Settings from "./pages/admin/Settings";
import AuditLog from "./pages/admin/AuditLog";
import PDVCashier from "./pages/pdv/PDVCashier";
import PDVHistory from "./pages/pdv/PDVHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/stock" element={<Stock />} />
              <Route path="/admin/sales" element={<Sales />} />
              <Route path="/admin/orders" element={<Orders />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/customers" element={<Customers />} />
              <Route path="/admin/settings" element={<Settings />} />
              <Route path="/admin/audit" element={<AuditLog />} />
              <Route path="/pdv" element={<PDVCashier />} />
              <Route path="/pdv/history" element={<PDVHistory />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
