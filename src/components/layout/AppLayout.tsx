import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, FolderOpen, Bot, Settings, Shield, LogOut, Scale, Wrench, Wallet, Menu, Brain, FlaskConical } from "lucide-react";
import logoImg from "@/assets/Logo_TrustBuild.png";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import JarvisBubble from "@/components/jarvis/JarvisBubble";

const baseTabs = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Tableau" },
  { path: "/chantiers", icon: Building2, label: "Chantiers" },
  { path: "/finances", icon: Wallet, label: "Finances" },
  { path: "/assistant", icon: Bot, label: "IA" },
  { path: "/robert-b", icon: Scale, label: "Juridique" },
  { path: "/auguste-p", icon: Wrench, label: "Technique" },
  { path: "/documents", icon: FileText, label: "Devis" },
  { path: "/mes-documents", icon: FolderOpen, label: "Docs" },
  { path: "/knowledge", icon: Brain, label: "Savoir" },
  { path: "/parametres", icon: Settings, label: "Réglages" },
];

const adminTab = { path: "/admin", icon: Shield, label: "Admin" };
const testerTab = { path: "/testing", icon: FlaskConical, label: "Tests" };

// Mobile: show primary 5 tabs, rest in "more" expandable
const primaryMobilePaths = ["/dashboard", "/chantiers", "/finances", "/documents", "/assistant"];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isTester } = useRole();
  const { signOut } = useAuth();
  let tabs = [...baseTabs];
  if (isAdmin) tabs = [...tabs, adminTab];
  if (isTester || isAdmin) tabs = [...tabs, testerTab];
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryMobileTabs = tabs.filter(t => primaryMobilePaths.includes(t.path));
  const secondaryMobileTabs = tabs.filter(t => !primaryMobilePaths.includes(t.path));

  // Check if a secondary tab is active
  const isSecondaryActive = secondaryMobileTabs.some(t => location.pathname.startsWith(t.path));

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] bg-secondary border-r shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src={logoImg} alt="Trust Build-IA" className="w-9 h-9 rounded-xl object-contain" />
          <span className="font-display font-bold text-lg tracking-tight text-foreground">Trust Build-IA</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {tabs.map((tab) => {
            const active = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-primary-glow border-l-2 border-primary text-primary font-semibold"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.path === "/assistant" && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t space-y-2">
          {isAdmin && (
            <div className="px-2">
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                <Shield className="w-3 h-3" /> Super Admin
              </Badge>
            </div>
          )}
          {isTester && !isAdmin && (
            <div className="px-2">
              <Badge variant="outline" className="text-[10px] gap-1 border-violet-500/30 text-violet-600 bg-violet-500/5">
                <FlaskConical className="w-3 h-3" /> Mode Test
              </Badge>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
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
            <img src={logoImg} alt="Trust Build-IA" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-display font-bold text-lg tracking-tight">TB-IA</span>
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
