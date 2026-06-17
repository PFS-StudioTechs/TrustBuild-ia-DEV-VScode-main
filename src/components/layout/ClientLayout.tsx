import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderOpen, FileText, Wallet, Truck,
  BookUser, Pencil, MessageSquare, Bot, LogOut, ChevronDown, ChevronRight, Menu, X, Scale
} from "lucide-react";
import TrustBuildLogo from "@/components/TrustBuildLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import AlfredBubble from "@/components/alfred/AlfredBubble";

const mainNav = [
  { path: "/espace-client", icon: LayoutDashboard, label: "Tableau de bord", exact: true },
  { path: "/espace-client/devis", icon: FileText, label: "Mes documents" },
  { path: "/espace-client/comparateur", icon: Scale, label: "Comparer mes devis" },
  { path: "/espace-client/comptabilite", icon: Wallet, label: "Comptabilité" },
  { path: "/espace-client/fournisseurs", icon: Truck, label: "Fournisseurs" },
  { path: "/espace-client/contacts", icon: BookUser, label: "Contacts" },
  { path: "/espace-client/conception", icon: Pencil, label: "Conception" },
  { path: "/espace-client/messagerie", icon: MessageSquare, label: "Messagerie" },
  { path: "/espace-client/assistants", icon: Bot, label: "Assistants IA" },
];

const projetsSubNav = [
  { path: "/espace-client/projets/nouveau", label: "À venir" },
  { path: "/espace-client/projets/en-cours", label: "En cours" },
  { path: "/espace-client/projets/termine", label: "Terminé" },
];

export default function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [projetsOpen, setProjetsOpen] = useState(
    location.pathname.startsWith("/espace-client/projets")
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const prenom = profile?.prenom ?? "";

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const NavItem = ({ path, icon: Icon, label, exact = false }: { path: string; icon: React.ElementType; label: string; exact?: boolean }) => {
    const active = isActive(path, exact);
    return (
      <button
        onClick={() => { navigate(path); setMobileOpen(false); }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
          active
            ? "bg-white/10 border-l-2 border-sidebar-primary text-sidebar-primary font-semibold"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        )}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span>{label}</span>
      </button>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="flex flex-col items-center px-4 pt-5 pb-3 border-b border-white/10">
        <button
          onClick={() => { navigate("/espace-client"); setMobileOpen(false); }}
          className="flex flex-col items-center cursor-pointer"
        >
          <TrustBuildLogo size={64} dark className="mb-2 block" />
          <span className="font-display font-bold text-base tracking-tight text-white">
            TrustBuild<span className="text-sidebar-primary font-normal italic">-ia</span>
          </span>
          <span className="text-[10px] text-white/50 text-center leading-tight mt-0.5">
            Espace client
          </span>
        </button>
        {prenom && (
          <span className="mt-2 text-xs text-white/70 font-medium">Bonjour, {prenom}</span>
        )}
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <NavItem path="/espace-client" icon={LayoutDashboard} label="Tableau de bord" exact />

        {/* Mes projets avec sous-nav */}
        <div>
          <button
            onClick={() => setProjetsOpen(!projetsOpen)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive("/espace-client/projets")
                ? "bg-white/10 border-l-2 border-sidebar-primary text-sidebar-primary font-semibold"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <FolderOpen className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">Mes projets</span>
            {projetsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {projetsOpen && (
            <div className="ml-8 mt-0.5 space-y-0.5">
              {projetsSubNav.map((sub) => {
                const active = location.pathname === sub.path;
                return (
                  <button
                    key={sub.path}
                    onClick={() => { navigate(sub.path); setMobileOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      active ? "text-sidebar-primary bg-white/5" : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {mainNav.slice(1).map((tab) => (
          <NavItem key={tab.path} path={tab.path} icon={tab.icon} label={tab.label} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] bg-sidebar border-r border-sidebar-border shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 flex flex-col w-[280px] h-full bg-sidebar">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <button
            onClick={() => navigate("/espace-client")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <TrustBuildLogo size={32} className="block" />
            <span className="font-display font-bold text-lg tracking-tight">
              TrustBuild<span className="text-primary font-normal italic">-ia</span>
            </span>
          </button>
          <button onClick={() => setMobileOpen(true)} className="p-2">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AlfredBubble />
    </div>
  );
}
