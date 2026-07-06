import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const INTENTION_ROUTER_PROMPT = `Tu routes le message d'un client TrustBuild-IA vers l'un de ces quatre agents :

- "expert_chantier" : le client demande un conseil sur le déroulement d'un chantier, ses étapes, des points de vigilance, ou un ordre de grandeur de matériaux/quantités ("comment ça se passe", "qu'est-ce qu'il me faut", "combien de").
- "cadrage" : le client exprime une intention EXPLICITE d'obtenir un devis ou d'être mis en relation avec un artisan ("je veux des devis", "trouvez-moi un artisan").
- "reglementaire" : le client demande une obligation légale, une démarche administrative, une norme, une certification, ou une aide financière liée à ses travaux (permis, déclaration préalable, mairie, PLU, mitoyenneté, norme, RGE, IRVE, Qualibat, aide, subvention, MaPrimeRénov, CEE, TVA réduite, crédit d'impôt, éco-PTZ, ANAH).
- "comparer" : le client veut comparer les devis qu'il a reçus pour ce projet, ou se faire aider à choisir ("comparer", "quel devis choisir", "aidez-moi à décider", "lequel est le mieux").

En cas de doute ou de message ambigu, choisis "expert_chantier" (on conseille, on ne pousse jamais vers le devis).

RÉPONSE OBLIGATOIRE — JSON pur, aucun texte autour, aucun bloc Markdown :
{ "intention": "expert_chantier" | "cadrage" | "reglementaire" | "comparer" }`;

const COMPARER_PROMPT = `Tu es Alfred, conseiller TrustBuild-IA. Tu aides un particulier à comparer objectivement les devis qu'il a reçus pour son projet.

Tu compares sur : les postes/prestations, les totaux TTC, les délais mentionnés dans les descriptions, les garanties mentionnées, les exclusions.

INVARIANT ABSOLU : ne mentionne JAMAIS de prix d'achat, de marge, ou de coût interne artisan — ces données ne te sont de toute façon jamais fournies, ne les invente pas.

Reste NEUTRE : éclaire les différences, ne tranche pas à la place du client. Pointe les écarts notables ("le devis A mentionne la garantie décennale, pas le B").

TON : clair, concis, vouvoiement. Pas de recommandation péremptoire — tu informes, le client décide.

Réponds en texte libre, directement au client, sans JSON.`;

const REGLEMENTAIRE_PROMPT = `Tu es Alfred, conseiller TrustBuild-IA. Tu informes un particulier sur les obligations légales et les aides financières liées à son projet de travaux.

MÉTHODE OBLIGATOIRE : tu DOIS utiliser le web search pour toute affirmation sur un barème, une éligibilité, une démarche ou une obligation en vigueur. Ne réponds JAMAIS de mémoire sur ces points — les règles changent.

LES 3 RÈGLES D'OR (impératives) :
1. Quand tu doutes, tu cherches (web search).
2. Quand tu conseilles sur du sensible, tu conditionnes : "selon les informations actuelles…", "sous réserve d'éligibilité…", "à confirmer auprès de votre mairie / d'un conseiller France Rénov'."
3. Tu n'es jamais l'autorité : tu informes et orientes, tu ne te substitues jamais à la mairie, au fisc ou à un professionnel qualifié.

CITATION : mentionne toujours la source officielle utilisée (nom + année).

TON : clair, chaleureux, concis, vouvoiement. Va à l'essentiel.

INVARIANTS : jamais de marges/coûts artisan ; n'impose jamais la mise en relation ; ne promets jamais un montant comme certain (toujours conditionnel).

Réponds en texte libre, directement au client, sans JSON.`;

const REGLEMENTAIRE_ALLOWED_DOMAINS = [
  "service-public.fr",
  "legifrance.gouv.fr",
  "anah.gouv.fr",
  "france-renov.gouv.fr",
  "economie.gouv.fr",
  "impots.gouv.fr",
  "qualibat.com",
  "qualifelec.fr",
];

const EXPERT_CHANTIER_PROMPT = `Tu es Alfred, conseiller de projet TrustBuild-IA pour un particulier.

PERSONNALITÉ : clair, chaleureux, concis, vouvoiement, tu vas à l'essentiel, tu ne quémandes pas l'approbation, tu ne récapitules pas à outrance.

COMPÉTENCE CONSEIL : tu expliques le déroulement d'un chantier, ses étapes, les points de vigilance, les erreurs courantes. Conseils généraux, utiles, concrets.

COMPÉTENCE MATÉRIAUX : tu donnes des ORDRES DE GRANDEUR de matériaux/quantités. Toujours en fourchette ("comptez environ…"). JAMAIS un devis ni un métré définitif. Rappelle que l'exact dépend du terrain et sera confirmé par l'artisan.

INVARIANTS :
- Ne divulgue jamais de marges, coûts artisan ou données internes de la plateforme.
- Ne te substitue jamais à un professionnel.
- N'impose jamais la mise en relation ; tu peux la proposer en fin de réponse SI ça sert le fil, sans insister.
- Réponds à la question posée. Ne renvoie pas "demandez à l'artisan" à une question à laquelle tu peux répondre utilement.

Réponds en texte libre, directement au client, sans JSON.`;

async function appelClaude(
  apiKey: string,
  system: string,
  userMessage: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

async function appelClaudeReglementaire(
  apiKey: string,
  userMessage: string
): Promise<{ reponse_alfred: string; sources: string[] }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.2,
      system: REGLEMENTAIRE_PROMPT,
      tools: [{
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 3,
        allowed_domains: REGLEMENTAIRE_ALLOWED_DOMAINS,
      }],
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }
  const data = await res.json();

  let searchDeclenchee = false;
  const sources: string[] = [];
  const textParts: string[] = [];

  for (const block of data.content ?? []) {
    if (block.type === "server_tool_use") searchDeclenchee = true;
    if (block.type === "web_search_tool_result") {
      const results = Array.isArray(block.content) ? block.content : [];
      for (const r of results) if (r.url) sources.push(r.url);
    }
    if (block.type === "text" && typeof block.text === "string") textParts.push(block.text);
  }

  if (!searchDeclenchee) {
    console.warn("[alfred-client] reglementaire: aucune recherche web déclenchée pour ce message:", userMessage);
  }

  return { reponse_alfred: textParts.join("\n\n").trim(), sources: [...new Set(sources)] };
}

interface DevisComparaison {
  id: string;
  numero: string;
  statut: string;
  montant_ttc: number;
  date_validite: string | null;
  artisanNom: string;
  lignes: { designation: string; quantite: number; unite: string; prix_unitaire: number; tva: number; section_nom: string | null }[];
}

async function chargerDevisProjetPourComparaison(
  userClient: ReturnType<typeof createClient>,
  projet_id: string
): Promise<DevisComparaison[]> {
  const { data: liaisons } = await (userClient as any)
    .from("client_projet_devis")
    .select("devis_id")
    .eq("projet_id", projet_id)
    .is("devis_supprime_at", null);

  const devisIds = [...new Set((liaisons ?? []).map((l: { devis_id: string }) => l.devis_id))];
  if (devisIds.length === 0) return [];

  const { data: devisRows } = await userClient
    .from("devis")
    .select("id, numero, statut, artisan_id, date_validite")
    .in("id", devisIds);

  const rows = (devisRows ?? []) as { id: string; numero: string; statut: string; artisan_id: string; date_validite: string | null }[];
  if (rows.length === 0) return [];

  const artisanIds = [...new Set(rows.map((r) => r.artisan_id))];
  const { data: profiles } = await userClient
    .from("profiles")
    .select("user_id, nom, prenom")
    .in("user_id", artisanIds);
  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p: { user_id: string; nom: string; prenom: string }) => [p.user_id, `${p.prenom} ${p.nom}`.trim()])
  );

  const { data: lignes } = await (userClient as any)
    .from("lignes_devis_client")
    .select("devis_id, designation, quantite, unite, prix_unitaire, tva, ordre, section_nom")
    .in("devis_id", devisIds)
    .order("ordre", { ascending: true });

  const lignesByDevis: Record<string, DevisComparaison["lignes"]> = {};
  const montantByDevis: Record<string, number> = {};
  for (const l of (lignes ?? []) as any[]) {
    (lignesByDevis[l.devis_id] ??= []).push({
      designation: l.designation, quantite: l.quantite, unite: l.unite,
      prix_unitaire: l.prix_unitaire, tva: l.tva, section_nom: l.section_nom,
    });
    montantByDevis[l.devis_id] = (montantByDevis[l.devis_id] ?? 0)
      + l.prix_unitaire * l.quantite * (1 + (l.tva ?? 0) / 100);
  }

  return rows.map((d) => ({
    id: d.id,
    numero: d.numero,
    statut: d.statut,
    montant_ttc: montantByDevis[d.id] ?? 0,
    date_validite: d.date_validite,
    artisanNom: profileMap[d.artisan_id] ?? "Artisan",
    lignes: lignesByDevis[d.id] ?? [],
  }));
}

async function appelClaudeComparer(
  apiKey: string,
  userMessage: string,
  devisList: DevisComparaison[]
): Promise<string> {
  const contexte = `DEVIS DU PROJET (données déjà filtrées, aucune marge ni coût interne) :\n${JSON.stringify(devisList, null, 2)}\n\nMESSAGE CLIENT :\n${userMessage}`;
  return appelClaude(apiKey, COMPARER_PROMPT, contexte, 0.3, 1024);
}

const LIBELLE_PROJET_PROMPT = `Génère un libellé de projet court (2 à 4 mots) à partir du message d'un client décrivant des travaux. Exemple : "je veux changer ma chaudière" → "Ma chaudière".

RÉPONSE OBLIGATOIRE : uniquement le libellé, sans guillemets, sans préambule, sans ponctuation finale.`;

async function genererLibelleProjet(apiKey: string, messageClient: string): Promise<string> {
  try {
    const brut = await appelClaude(apiKey, LIBELLE_PROJET_PROMPT, messageClient, 0.3, 20);
    const nettoye = brut.replace(/^["'«]+|["'»]+$/g, "").replace(/[.!?]+$/g, "").trim();
    if (!nettoye) return "Nouveau projet";
    return nettoye.length > 40 ? nettoye.slice(0, 40).trim() : nettoye;
  } catch (e) {
    console.error("[alfred-client] génération libellé projet échouée:", e);
    return "Nouveau projet";
  }
}

async function creerProjetRacine(
  userClient: ReturnType<typeof createClient>,
  apiKey: string,
  messageClient: string
): Promise<string> {
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Utilisateur non authentifié");

  const libelle = await genererLibelleProjet(apiKey, messageClient);

  const { data, error } = await userClient
    .from("client_projets")
    .insert({ auth_user_id: userData.user.id, libelle, statut: "cadrage" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Création projet racine échouée: ${error?.message}`);
  return (data as { id: string }).id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non autorisé" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY non configuré" }, 500);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON invalide" }, 400);
  }

  const { action, message_client, historique } = body as {
    action?: string;
    message_client?: string;
    historique?: Array<{ role: string; content: string }>;
  };
  let { projet_id } = body as { projet_id?: string };

  if (action !== "dialoguer") {
    return json({ error: `Action inconnue : ${action}` }, 400);
  }
  if (!message_client?.trim()) {
    return json({ error: "Champ requis : message_client" }, 400);
  }

  let projet_cree = false;
  if (!projet_id) {
    try {
      projet_id = await creerProjetRacine(userClient, ANTHROPIC_API_KEY, message_client);
      projet_cree = true;
    } catch (e) {
      console.error("[alfred-client] création projet racine échouée:", e);
      return json({ error: "Impossible de créer le projet pour ce dialogue." }, 500);
    }
  }

  // ── ÉTAPE 1 : détection d'intention ─────────────────────────────────────
  let intention: "expert_chantier" | "cadrage" | "reglementaire" | "comparer" = "expert_chantier";
  try {
    const routerText = await appelClaude(ANTHROPIC_API_KEY, INTENTION_ROUTER_PROMPT, message_client, 0, 100);
    const cleaned = routerText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.intention === "cadrage" || parsed.intention === "reglementaire" || parsed.intention === "comparer") intention = parsed.intention;
  } catch (e) {
    console.error("[alfred-client] détection intention échouée, fallback expert_chantier:", e);
  }

  // ── ÉTAPE 2a : intention cadrage → délégation ───────────────────────────
  if (intention === "cadrage") {
    try {
      const delegateRes = await fetch(`${supabaseUrl}/functions/v1/alfred-client-cadrage`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ action: "dialoguer", projet_id, message_client, historique }),
      });

      if (!delegateRes.ok) {
        const errText = await delegateRes.text();
        console.error("[alfred-client] délégation cadrage échouée:", delegateRes.status, errText);
        return json({ error: "Le service de cadrage est momentanément indisponible. Réessayez." }, 502);
      }

      const cadrageData = await delegateRes.json();
      return json({ projet_id, projet_cree, agent: "cadrage", ...cadrageData });
    } catch (e) {
      console.error("[alfred-client] erreur délégation cadrage:", e);
      return json({ error: "Le service de cadrage est momentanément indisponible. Réessayez." }, 502);
    }
  }

  // ── ÉTAPE 2b : intention reglementaire ──────────────────────────────────
  if (intention === "reglementaire") {
    try {
      const { reponse_alfred, sources } = await appelClaudeReglementaire(ANTHROPIC_API_KEY, message_client);
      return json({ projet_id, projet_cree, agent: "reglementaire", reponse_alfred, sources });
    } catch (e) {
      console.error("[alfred-client] erreur reglementaire:", e);
      return json({ error: "Je n'ai pas pu vérifier cette information pour le moment. Adressez-vous à votre mairie ou à un conseiller France Rénov'." }, 500);
    }
  }

  // ── ÉTAPE 2c : intention comparer ───────────────────────────────────────
  if (intention === "comparer") {
    try {
      const devisList = await chargerDevisProjetPourComparaison(userClient, projet_id);
      if (devisList.length === 0) {
        return json({
          projet_id, projet_cree,
          agent: "comparer",
          reponse_alfred: "Vous n'avez aucun devis reçu pour ce projet pour l'instant.",
          devis_compares: [],
        });
      }
      const reponse_alfred = await appelClaudeComparer(ANTHROPIC_API_KEY, message_client, devisList);
      return json({ projet_id, projet_cree, agent: "comparer", reponse_alfred, devis_compares: devisList.map((d) => d.id) });
    } catch (e) {
      console.error("[alfred-client] erreur comparer:", e);
      return json({ error: "Erreur du service IA" }, 500);
    }
  }

  // ── ÉTAPE 2d : intention expert_chantier ────────────────────────────────
  try {
    const reponse_alfred = await appelClaude(ANTHROPIC_API_KEY, EXPERT_CHANTIER_PROMPT, message_client, 0.3, 1024);
    return json({ projet_id, projet_cree, agent: "expert_chantier", reponse_alfred });
  } catch (e) {
    console.error("[alfred-client] erreur expert_chantier:", e);
    return json({ error: "Erreur du service IA" }, 500);
  }
});
