import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Chantiers from "@/pages/Chantiers";
import MesDocuments from "@/pages/MesDocuments";
import Assistant from "@/pages/Assistant";
import Parametres from "@/pages/Parametres";
import Admin from "@/pages/Admin";
import Finances from "@/pages/Finances";
import ResetPassword from "@/pages/ResetPassword";
import Knowledge from "@/pages/Knowledge";
import Testing from "@/pages/Testing";
import NotFound from "@/pages/NotFound";
import Clients from "@/pages/Clients";
import Fournisseurs from "@/pages/Fournisseurs";
import Contacts from "@/pages/Contacts";
import Messagerie from "@/pages/Messagerie";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-[100dvh] bg-background">
      <div className="space-y-3 w-48">
        <div className="skeleton-shimmer h-6 rounded-lg" />
        <div className="skeleton-shimmer h-4 rounded-lg w-3/4" />
      </div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Redirige les purs testeurs vers /testing — les autres voient la page normalement. */
function ProductionRoute({ children }: { children: React.ReactNode }) {
  const { isTester, isAdmin, isArtisan, loading } = useRole();
  if (loading) return null;
  // Pur testeur = tester sans artisan ni admin
  if (isTester && !isArtisan && !isAdmin) return <Navigate to="/testing" replace />;
  return <>{children}</>;
}

/** Réserve une route aux admins — redirige vers /dashboard sinon. */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useRole();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Réserve une route aux testeurs et admins. */
function TesterRoute({ children }: { children: React.ReactNode }) {
  const { isTester, isAdmin, loading } = useRole();
  if (loading) return null;
  if (!isTester && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<ProductionRoute><Dashboard /></ProductionRoute>} />
              <Route path="/chantiers" element={<ProductionRoute><Chantiers /></ProductionRoute>} />
              <Route path="/mes-documents" element={<ProductionRoute><MesDocuments /></ProductionRoute>} />
              <Route path="/assistant" element={<ProductionRoute><Assistant /></ProductionRoute>} />
              <Route path="/parametres" element={<ProductionRoute><Parametres /></ProductionRoute>} />
              <Route path="/finances" element={<ProductionRoute><Finances /></ProductionRoute>} />
              <Route path="/clients" element={<ProductionRoute><Clients /></ProductionRoute>} />
              <Route path="/fournisseurs" element={<ProductionRoute><Fournisseurs /></ProductionRoute>} />
              <Route path="/contacts" element={<ProductionRoute><Contacts /></ProductionRoute>} />
              <Route path="/messagerie" element={<ProductionRoute><Messagerie /></ProductionRoute>} />
              <Route path="/knowledge" element={<ProductionRoute><Knowledge /></ProductionRoute>} />
              <Route path="/testing" element={<TesterRoute><Testing /></TesterRoute>} />
              {/* Administration — admins uniquement */}
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
