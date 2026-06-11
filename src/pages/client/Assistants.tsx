import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const agents = [
  {
    name: "Alfred",
    avatar: "/avatar-alfred.png",
    role: "Assistant principal",
    description: "Répond à vos questions sur vos devis, factures et chantiers.",
    available: true,
  },
  {
    name: "Simone",
    avatar: "/avatar-simone.png",
    role: "Experte Juridique",
    description: "Éclaire vos droits et obligations en tant que client d'artisan BTP.",
    available: true,
  },
  {
    name: "Gustave",
    avatar: "/avatar-gustave.png",
    role: "Expert Terrain BTP",
    description: "Vous explique les travaux, matériaux et techniques de vos chantiers.",
    available: true,
  },
];

export default function Assistants() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-h1 font-display font-bold">Assistants IA</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Posez vos questions à nos experts via la bulle Alfred en bas à droite.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.name} className="forge-card text-center space-y-3">
            <img
              src={agent.avatar}
              alt={agent.name}
              className="w-16 h-16 rounded-full mx-auto object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <div className="font-display font-semibold">{agent.name}</div>
              <div className="text-xs text-muted-foreground">{agent.role}</div>
            </div>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
            <Badge variant="outline" className="text-xs text-primary border-primary/30">
              Disponible
            </Badge>
          </div>
        ))}
      </div>

      <div className="forge-card bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            Cliquez sur la bulle <strong className="text-foreground">Alfred</strong> en bas à droite pour démarrer une conversation avec nos assistants IA.
          </p>
        </div>
      </div>
    </div>
  );
}
