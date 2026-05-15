import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import SplashScreen from "@/components/SplashScreen";
import Auth from "@/pages/Auth";
import CompleteProfile from "@/pages/CompleteProfile";
import UploadKbis from "@/pages/UploadKbis";
import Devis from "@/pages/Devis";
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
import Documents from "@/pages/Documents";
import Clients from "@/pages/Clients";
import Fournisseurs from "@/pages/Fournisseurs";
import Contacts from "@/pages/Contacts";
import Messagerie from "@/pages/Messagerie";
import DevisPublic from "@/pages/DevisPublic";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

const loadingSkeleton = (
  <div className="flex items-center justify-center h-[100dvh] bg-background">
    <div className="space-y-3 w-48">
      <div className="skeleton-shimmer h-6 rounded-lg" />
      <div className="skeleton-shimmer h-4 rounded-lg w-3/4" />
    </div>
  </div>
);

/** Email non confirmé — écran d'attente de confirmation */
function EmailUnverifiedScreen({ email }: { email: string }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md forge-card animate-fade-up text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h2 className="text-h2 font-display">Confirmez votre email</h2>
        <p className="text-muted-foreground text-sm">
          Un lien de confirmation a été envoyé à{" "}
          <strong className="text-foreground">{email}</strong>.<br />
          Cliquez sur ce lien pour activer votre compte et compléter votre profil.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/auth";
          }}
        >
          Retour à la connexion
        </Button>
      </div>
    </div>
  );
}

/**
 * Route protégée complète :
 * 1. Requiert une session active
 * 2. Requiert que l'email soit confirmé
 * 3. Requiert que le profil soit complété (sinon → /complete-profile)
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading } = useAuth();

  if ((loading || profileLoading) && !user) return loadingSkeleton;
  if (!user) return <Navigate to="/auth" replace />;

  if (!user.email_confirmed_at) {
    return <EmailUnverifiedScreen email={user.email ?? ""} />;
  }

  if (profile !== null && !profile.profile_completed) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Compte bloqué : KBIS manquant après la deadline → accès restreint à /upload-kbis
  if (
    profile !== null &&
    profile.profile_completed &&
    !profile.kbis_url &&
    profile.kbis_deadline &&
    new Date() > new Date(profile.kbis_deadline)
  ) {
    return <Navigate to="/upload-kbis" replace />;
  }

  return <>{children}</>;
}

/** Route accessible dès qu'une session existe (utilisée pour /complete-profile) */
function AuthRequiredRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return loadingSkeleton;
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

const App = () => {
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem("splash_shown") === "1"
  );

  return (
    <>
      {!splashDone && (
        <SplashScreen
          onDone={() => {
            sessionStorage.setItem("splash_shown", "1");
            setSplashDone(true);
          }}
        />
      )}
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/devis/view/:token" element={<DevisPublic />} />
                <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/complete-profile" element={<AuthRequiredRoute><CompleteProfile /></AuthRequiredRoute>} />
                <Route path="/upload-kbis" element={<AuthRequiredRoute><UploadKbis /></AuthRequiredRoute>} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<ProductionRoute><Dashboard /></ProductionRoute>} />
                  <Route path="/chantiers" element={<ProductionRoute><Chantiers /></ProductionRoute>} />
                  <Route path="/devis" element={<ProductionRoute><Devis /></ProductionRoute>} />
                  <Route path="/documents" element={<Navigate to="/devis" replace />} />
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
                  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
};

export default App;
