import { Bot, Scale, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentChat from "@/components/agents/AgentChat";

const jarvisSuggestions = [
  "Rédige un devis pour une rénovation de salle de bain",
  "Quelles sont les normes DTU pour l'isolation ?",
  "Comment calculer la TVA à 10% pour la rénovation ?",
];

const robertSuggestions = [
  "Quelles sont les obligations de l'artisan en matière de garantie décennale ?",
  "Rédige une mise en demeure pour retard de paiement d'un client",
  "Un client conteste des malfaçons, quels sont mes recours ?",
  "Quelles assurances sont obligatoires pour un plombier ?",
];

const augusteSuggestions = [
  "Quel DTU s'applique pour l'isolation thermique par l'extérieur ?",
  "Calcul de la section d'un linteau béton armé pour une ouverture de 2m",
  "Quelles sont les règles de ventilation en RE2020 ?",
  "Comment traiter une fissure structurelle sur un mur porteur ?",
];

export default function Assistant() {
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="jarvis" className="flex flex-col h-full">
        <div className="px-4 pt-4 shrink-0 border-b bg-card">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="jarvis" className="gap-1.5 text-xs">
              <Bot className="w-3.5 h-3.5" /> Jarvis
            </TabsTrigger>
            <TabsTrigger value="robert_b" className="gap-1.5 text-xs">
              <Scale className="w-3.5 h-3.5" /> Robert B
            </TabsTrigger>
            <TabsTrigger value="auguste_p" className="gap-1.5 text-xs">
              <Wrench className="w-3.5 h-3.5" /> Auguste P
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jarvis" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="jarvis"
            title="Jarvis — Assistant BTP"
            subtitle="Posez vos questions techniques, demandez un devis ou une analyse."
            icon={Bot}
            iconColor="text-accent"
            iconBg="bg-accent/10"
            suggestions={jarvisSuggestions}
            placeholder="Posez votre question à Jarvis…"
          />
        </TabsContent>

        <TabsContent value="robert_b" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="robert_b"
            title="Robert B — Expert Juridique"
            subtitle="Droit de la construction, contrats, assurances, garanties et litiges."
            icon={Scale}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
            suggestions={robertSuggestions}
            placeholder="Posez votre question juridique…"
          />
        </TabsContent>

        <TabsContent value="auguste_p" className="flex-1 overflow-hidden mt-0">
          <AgentChat
            persona="auguste_p"
            title="Auguste P — Expert Technique"
            subtitle="Normes DTU, règles de l'art, calculs de structure et réglementations techniques."
            icon={Wrench}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
            suggestions={augusteSuggestions}
            placeholder="Posez votre question technique…"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
