import { Bot } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";

const suggestions = [
  "Rédige un devis pour une rénovation de salle de bain",
  "Quelles sont les normes DTU pour l'isolation ?",
  "Comment calculer la TVA à 10% pour la rénovation ?",
];

export default function Assistant() {
  return (
    <AgentChat
      persona="jarvis"
      title="Assistant BTP"
      subtitle="Posez vos questions techniques, demandez un devis ou une analyse."
      icon={Bot}
      iconColor="text-accent"
      iconBg="bg-accent/10"
      suggestions={suggestions}
      placeholder="Posez votre question…"
    />
  );
}
