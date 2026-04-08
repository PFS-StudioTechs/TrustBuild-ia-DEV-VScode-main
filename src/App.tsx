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
import Documents from "@/pages/Documents";
import MesDocuments from "@/pages/MesDocuments";
import Assistant from "@/pages/Assistant";
import Parametres from "@/pages/Parametres";
import Admin from "@/pages/Admin";
import RobertB from "@/pages/RobertB";
import AugusteP from "@/pages/AugusteP";
import Finances from "@/pages/Finances";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

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

/** Réserve une route aux admins — redirige vers /dashboard sinon. */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useRole();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Réserve une route aux artisans avec un plan actif (non "gratuit").
 *  À adapter quand la notion de plan sera finalisée. */
function PremiumRoute({ children }: { children: React.ReactNode }) {
  const { roles, loading } = useRole();
  if (loading) return null;
  if (!roles.includes("artisan") && !roles.includes("admin")) {
    return <Navigate to="/dashboard" replace />;
  }
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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chantiers" element={<Chantiers />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/mes-documents" element={<MesDocuments />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/parametres" element={<Parametres />} />
              <Route path="/finances" element={<Finances />} />
              {/* Agents IA — réservés aux artisans et admins */}
              <Route path="/robert-b" element={<PremiumRoute><RobertB /></PremiumRoute>} />
              <Route path="/auguste-p" element={<PremiumRoute><AugusteP /></PremiumRoute>} />
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
