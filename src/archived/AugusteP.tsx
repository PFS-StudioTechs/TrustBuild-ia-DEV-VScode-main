import { Wrench } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";

const suggestions = [
  "Quel DTU s'applique pour l'isolation thermique par l'extérieur ?",
  "Calcul de la section d'un linteau béton armé pour une ouverture de 2m",
  "Quelles sont les règles de ventilation en RE2020 ?",
  "Comment traiter une fissure structurelle sur un mur porteur ?",
];

export default function AugusteP() {
  return (
    <AgentChat
      persona="auguste_p"
      title="Auguste P — Expert Technique"
      subtitle="Normes DTU, règles de l'art, calculs de structure et réglementations techniques. Réponses structurées avec références normatives."
      icon={Wrench}
      iconColor="text-emerald-600"
      iconBg="bg-emerald-100"
      suggestions={suggestions}
      placeholder="Posez votre question technique…"
    />
  );
}
