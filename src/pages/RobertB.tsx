import { Scale } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";

const suggestions = [
  "Quelles sont les obligations de l'artisan en matière de garantie décennale ?",
  "Rédige une mise en demeure pour retard de paiement d'un client",
  "Un client conteste des malfaçons, quels sont mes recours ?",
  "Quelles assurances sont obligatoires pour un plombier ?",
];

export default function RobertB() {
  return (
    <AgentChat
      persona="robert_b"
      title="Robert B — Expert Juridique"
      subtitle="Droit de la construction, contrats, assurances, garanties et litiges. Chaque réponse cite les articles de loi exacts."
      icon={Scale}
      iconColor="text-amber-600"
      iconBg="bg-amber-100"
      suggestions={suggestions}
      placeholder="Posez votre question juridique…"
    />
  );
}
