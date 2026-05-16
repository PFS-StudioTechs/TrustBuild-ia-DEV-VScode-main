import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, FolderOpen, Settings, Shield, LogOut, Wallet, Menu, FlaskConical, Users, Truck, BookUser } from "lucide-react";
import TrustBuildLogo from "@/components/TrustBuildLogo";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import JarvisBubble from "@/components/jarvis/JarvisBubble";
import KbisWarningBanner from "@/components/kbis/KbisWarningBanner";

const baseTabs = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord" },
  { path: "/devis", icon: FileText, label: "Devis & Factures" },
  { path: "/chantiers", icon: Building2, label: "Suivi des chantiers" },
  { path: "/finances", icon: Wallet, label: "Comptabilité" },
  { path: "/clients", icon: Users, label: "Clients" },
  { path: "/fournisseurs", icon: Truck, label: "Fournisseurs" },
  { path: "/contacts", icon: BookUser, label: "Contacts" },
  { path: "/mes-documents", icon: FolderOpen, label: "Mes Docs" },
  { path: "/parametres", icon: Settings, label: "Paramètres" },
];

const adminTab = { path: "/admin", icon: Shield, label: "Admin" };
const testerTab = { path: "/testing", icon: FlaskConical, label: "Tests" };

// Mobile: show primary 5 tabs, rest in "more" expandable
const primaryMobilePaths = ["/dashboard", "/devis", "/chantiers", "/finances", "/clients"];


export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isTester, isArtisan } = useRole();
  const { signOut } = useAuth();
  const isPureTester = isTester && !isArtisan && !isAdmin;

  // Pur testeur : uniquement l'onglet Tests
  let tabs = isPureTester ? [testerTab] : [...baseTabs];
  if (!isPureTester && isAdmin) tabs = [...tabs, adminTab];
  if (!isPureTester && (isTester || isAdmin)) tabs = [...tabs, testerTab];
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryMobileTabs = tabs.filter(t => primaryMobilePaths.includes(t.path));
  const secondaryMobileTabs = tabs.filter(t => !primaryMobilePaths.includes(t.path));

  // Check if a secondary tab is active
  const isSecondaryActive = secondaryMobileTabs.some(t => location.pathname.startsWith(t.path));

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="flex flex-col items-center px-4 pt-5 pb-3 border-b border-white/10">
          <TrustBuildLogo size={64} dark className="mb-2 block" />
          <span className="font-display font-bold text-base tracking-tight text-white">TrustBuild<span className="text-sidebar-primary font-normal italic">-ia</span></span>
          <span className="text-[10px] text-white/50 text-center leading-tight mt-0.5">Parce que la confiance se construit</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {tabs.map((tab) => {
            const active = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-white/10 border-l-2 border-sidebar-primary text-sidebar-primary font-semibold"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10 space-y-2">
          {isAdmin && (
            <div className="px-2">
              <Badge variant="outline" className="text-[10px] gap-1 border-white/20 text-white/70">
                <Shield className="w-3 h-3" /> Super Admin
              </Badge>
            </div>
          )}
          {isTester && !isAdmin && (
            <div className="px-2">
              <Badge variant="outline" className="text-[10px] gap-1 border-violet-400/30 text-violet-300 bg-violet-500/5">
                <FlaskConical className="w-3 h-3" /> Mode Test
              </Badge>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <div className="flex items-center gap-2">
            <TrustBuildLogo size={32} className="block" />
            <span className="font-display font-bold text-lg tracking-tight">TrustBuild<span className="text-primary font-normal italic">-ia</span></span>
            {isAdmin && (
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                <Shield className="w-3 h-3" /> Admin
              </Badge>
            )}
          </div>
          <button onClick={signOut} className="p-2 text-destructive">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* KBIS warning banner — visible si KBIS non déposé et dans la période des 6 mois */}
        <KbisWarningBanner />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile Bottom Tab Bar — Redesigned for readability */}
        <nav className="md:hidden bg-card shrink-0 border-t" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* Secondary menu expanded */}
          {moreOpen && (
            <div className="grid grid-cols-4 gap-1 px-2 py-2 border-b bg-secondary/50 animate-fade-up">
              {secondaryMobileTabs.map((tab) => {
                const active = location.pathname.startsWith(tab.path);
                return (
                  <button
                    key={tab.path}
                    onClick={() => { navigate(tab.path); setMoreOpen(false); }}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 rounded-lg transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="text-[11px] font-medium leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Primary tabs */}
          <div className="flex items-stretch justify-around" style={{ minHeight: "60px" }}>
            {primaryMobileTabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              return (
                <button
                  key={tab.path}
                  onClick={() => { navigate(tab.path); setMoreOpen(false); }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors relative",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary" />
                  )}
                  <tab.icon className="w-6 h-6" />
                  <span className="text-[11px] font-semibold leading-tight">{tab.label}</span>
                </button>
              );
            })}
            {/* More button */}
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors relative",
                (moreOpen || isSecondaryActive) ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isSecondaryActive && !moreOpen && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary" />
              )}
              <Menu className="w-6 h-6" />
              <span className="text-[11px] font-semibold leading-tight">Plus</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Jarvis floating bubble */}
      <JarvisBubble />
    </div>
  );
}
