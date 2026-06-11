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
          Nos experts IA sont disponibles pour répondre à vos questions.
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

    </div>
  );
}
