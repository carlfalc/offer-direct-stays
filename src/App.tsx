import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Explore from "./pages/Explore";
import OfferPayment from "./pages/OfferPayment";
import OfferConfirmed from "./pages/OfferConfirmed";
import BusinessClaim from "./pages/BusinessClaim";
import BusinessOfferResponse from "./pages/BusinessOfferResponse";
import GuestOffers from "./pages/GuestOffers";
import BusinessDashboard from "./pages/BusinessDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/offer-payment" element={<OfferPayment />} />
            <Route path="/offer-confirmed" element={<OfferConfirmed />} />
            <Route path="/business/claim" element={<BusinessClaim />} />
            <Route path="/business/offers/:offerId" element={<BusinessOfferResponse />} />
            <Route path="/business/dashboard" element={<BusinessDashboard />} />
            <Route path="/offers" element={<GuestOffers />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
