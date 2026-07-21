import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import AgentChat from "@/components/agents/AgentChat";
import AlfredClientPanel from "@/components/alfred/AlfredClientPanel";

// LEGACY — suggestions désactivées 21/07/2026 (réactivation prévue par corps de métier)
// const simoneSuggestions = [
//   "Quelles garanties l'artisan doit-il me fournir après les travaux ?",
//   "L'artisan a pris du retard, quels sont mes recours ?",
//   "Qu'est-ce que la garantie décennale en tant que client ?",
// ];

// LEGACY — suggestions désactivées 21/07/2026 (réactivation prévue par corps de métier)
// const gustaveSuggestions = [
//   "Comment vérifier la qualité d'une pose de carrelage ?",
//   "Quels matériaux privilégier pour une rénovation de salle de bain ?",
//   "Qu'est-ce qu'une douche à l'italienne et quels travaux implique-t-elle ?",
// ];

export default function Assistants() {
  const [activeTab, setActiveTab] = usePersistedTab("tab_client_assistant", "alfred");
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
          <AlfredClientPanel />
        </TabsContent>

        <TabsContent value="simone" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            audience="client"
            persona="simone"
            title="Simone — Experte Juridique"
            subtitle="Vos droits en tant que client : garanties, contrats et litiges avec artisans."
            avatarSrc="/avatar-simone.png"
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
            placeholder="Posez votre question juridique…"
          />
        </TabsContent>

        <TabsContent value="gustave" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            audience="client"
            persona="gustave"
            title="Gustave — Expert Technique BTP"
            subtitle="Matériaux, travaux et techniques de construction expliqués pour les clients."
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
