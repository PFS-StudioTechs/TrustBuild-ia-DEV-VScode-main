import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import AgentChat from "@/components/agents/AgentChat";

// LEGACY — suggestions désactivées 21/07/2026 (réactivation prévue par corps de métier)
// const alfredSuggestions = [
//   "Rédige un devis pour une rénovation de salle de bain",
//   "Quelles sont les normes DTU pour l'isolation ?",
//   "Comment calculer la TVA à 10% pour la rénovation ?",
// ];

// LEGACY — suggestions désactivées 21/07/2026 (réactivation prévue par corps de métier)
// const simoneSuggestions = [
//   "Quelles sont les obligations de l'artisan en matière de garantie décennale ?",
//   "Rédige une mise en demeure pour retard de paiement d'un client",
//   "Un client conteste des malfaçons, quels sont mes recours ?",
// ];

// LEGACY — suggestions désactivées 21/07/2026 (réactivation prévue par corps de métier)
// const gustaveSuggestions = [
//   "Quel DTU s'applique pour l'isolation thermique par l'extérieur ?",
//   "Calcul de la section d'un linteau béton armé pour une ouverture de 2m",
//   "Quelles sont les règles de ventilation en RE2020 ?",
// ];

export default function Assistant() {
  const [activeTab, setActiveTab] = usePersistedTab("tab_assistant", "alfred");
  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="px-4 pt-4 shrink-0 border-b bg-card">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="alfred" className="gap-1.5 text-xs">
              <img src="/avatar-alfred.png" alt="Alfred" className="w-5 h-5 rounded-full object-cover" /> Alfred
            </TabsTrigger>
            <TabsTrigger value="simone" className="gap-1.5 text-xs">
              <img src="/avatar-simone.png" alt="Simone" className="w-5 h-5 rounded-full object-cover" /> Simone
            </TabsTrigger>
            <TabsTrigger value="gustave" className="gap-1.5 text-xs">
              <img src="/avatar-gustave.png" alt="Gustave" className="w-5 h-5 rounded-full object-cover" /> Gustave
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="alfred" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="alfred"
            title="Alfred — Assistant BTP"
            subtitle="Posez vos questions techniques, demandez un devis ou une analyse."
            avatarSrc="/avatar-alfred.png"
            iconColor="text-accent"
            iconBg="bg-accent/10"
            placeholder="Posez votre question à Alfred…"
          />
        </TabsContent>

        <TabsContent value="simone" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="simone"
            title="Simone — Experte Juridique"
            subtitle="Droit de la construction, contrats, assurances, garanties et litiges."
            avatarSrc="/avatar-simone.png"
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
            placeholder="Posez votre question juridique…"
          />
        </TabsContent>

        <TabsContent value="gustave" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="gustave"
            title="Gustave — Expert Technique"
            subtitle="Normes DTU, règles de l'art, calculs de structure et réglementations techniques."
            avatarSrc="/avatar-gustave.png"
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
            placeholder="Posez votre question technique…"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
