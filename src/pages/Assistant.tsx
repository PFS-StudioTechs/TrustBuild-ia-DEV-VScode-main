import { Bot, Scale, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import AgentChat from "@/components/agents/AgentChat";

const alfredSuggestions = [
  "Rédige un devis pour une rénovation de salle de bain",
  "Quelles sont les normes DTU pour l'isolation ?",
  "Comment calculer la TVA à 10% pour la rénovation ?",
];

const simoneSuggestions = [
  "Quelles sont les obligations de l'artisan en matière de garantie décennale ?",
  "Rédige une mise en demeure pour retard de paiement d'un client",
  "Un client conteste des malfaçons, quels sont mes recours ?",
];

const gustaveSuggestions = [
  "Quel DTU s'applique pour l'isolation thermique par l'extérieur ?",
  "Calcul de la section d'un linteau béton armé pour une ouverture de 2m",
  "Quelles sont les règles de ventilation en RE2020 ?",
];

export default function Assistant() {
  const [activeTab, setActiveTab] = usePersistedTab("tab_assistant", "alfred");
  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="px-4 pt-4 shrink-0 border-b bg-card">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="alfred" className="gap-1.5 text-xs">
              <Bot className="w-3.5 h-3.5" /> Alfred
            </TabsTrigger>
            <TabsTrigger value="simone" className="gap-1.5 text-xs">
              <Scale className="w-3.5 h-3.5" /> Simone
            </TabsTrigger>
            <TabsTrigger value="gustave" className="gap-1.5 text-xs">
              <Wrench className="w-3.5 h-3.5" /> Gustave
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="alfred" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="alfred"
            title="Alfred — Assistant BTP"
            subtitle="Posez vos questions techniques, demandez un devis ou une analyse."
            icon={Bot}
            iconColor="text-accent"
            iconBg="bg-accent/10"
            suggestions={alfredSuggestions}
            placeholder="Posez votre question à Alfred…"
          />
        </TabsContent>

        <TabsContent value="simone" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="simone"
            title="Simone — Expert Juridique"
            subtitle="Droit de la construction, contrats, assurances, garanties et litiges."
            icon={Scale}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
            suggestions={simoneSuggestions}
            placeholder="Posez votre question juridique…"
          />
        </TabsContent>

        <TabsContent value="gustave" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="gustave"
            title="Gustave — Expert Technique"
            subtitle="Normes DTU, règles de l'art, calculs de structure et réglementations techniques."
            icon={Wrench}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
            suggestions={gustaveSuggestions}
            placeholder="Posez votre question technique…"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
