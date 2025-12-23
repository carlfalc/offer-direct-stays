import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TripProvider } from "@/contexts/TripContext";
import { BusinessProvider } from "@/contexts/BusinessContext";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import AdminLayout from "@/components/layout/AdminLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Explore from "./pages/Explore";
import AdminBilling from "./pages/AdminBilling";
import OfferPayment from "./pages/OfferPayment";
import OfferConfirmed from "./pages/OfferConfirmed";
import BusinessClaim from "./pages/BusinessClaim";
import BusinessOnboarding from "./pages/BusinessOnboarding";
import BusinessOfferResponse from "./pages/BusinessOfferResponse";
import BusinessSettings from "./pages/BusinessSettings";
import GuestOffers from "./pages/GuestOffers";
import BusinessDashboard from "./pages/BusinessDashboard";
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import Watchlist from "./pages/Watchlist";
import Trips from "./pages/Trips";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BusinessProvider>
        <TripProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Authenticated routes with shared layout */}
              <Route path="/explore" element={
                <AuthenticatedLayout fullHeight>
                  <Explore />
                </AuthenticatedLayout>
              } />
              <Route path="/offers" element={
                <AuthenticatedLayout>
                  <GuestOffers />
                </AuthenticatedLayout>
              } />
              <Route path="/watchlist" element={
                <AuthenticatedLayout>
                  <Watchlist />
                </AuthenticatedLayout>
              } />
              <Route path="/trips" element={
                <AuthenticatedLayout>
                  <Trips />
                </AuthenticatedLayout>
              } />
              <Route path="/messages" element={
                <AuthenticatedLayout>
                  <Messages />
                </AuthenticatedLayout>
              } />
              <Route path="/messages/:conversationId" element={
                <AuthenticatedLayout fullHeight>
                  <Conversation />
                </AuthenticatedLayout>
              } />
              <Route path="/offer-payment" element={
                <AuthenticatedLayout>
                  <OfferPayment />
                </AuthenticatedLayout>
              } />
              <Route path="/offer-confirmed" element={
                <AuthenticatedLayout>
                  <OfferConfirmed />
                </AuthenticatedLayout>
              } />
              
              {/* Business routes */}
              <Route path="/business/onboarding" element={
                <AuthenticatedLayout>
                  <BusinessOnboarding />
                </AuthenticatedLayout>
              } />
              <Route path="/business/claim" element={
                <AuthenticatedLayout>
                  <BusinessClaim />
                </AuthenticatedLayout>
              } />
              <Route path="/business/offers/:offerId" element={
                <AuthenticatedLayout>
                  <BusinessOfferResponse />
                </AuthenticatedLayout>
              } />
              <Route path="/business/dashboard" element={
                <AuthenticatedLayout>
                  <BusinessDashboard />
                </AuthenticatedLayout>
              } />
              <Route path="/business/settings" element={
                <AuthenticatedLayout>
                  <BusinessSettings />
                </AuthenticatedLayout>
              } />
              
              {/* Admin routes */}
              <Route path="/admin/billing" element={
                <AdminLayout>
                  <AdminBilling />
                </AdminLayout>
              } />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TripProvider>
      </BusinessProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
