# TrustBuild-IA — Contexte projet pour Claude Code

## Projet

SaaS de gestion administrative pour artisans BTP (devis, factures, chantiers) avec assistant IA intégré.

- **Frontend** : React 18 + TypeScript + Vite (SWC)
- **Styles** : Tailwind CSS + shadcn/ui
- **Backend/Auth** : Supabase (BDD, auth, Edge Functions, storage)
- **State** : TanStack Query v5
- **Déploiement** : Vercel (auto-deploy sur push `main`)
- **Tests** : Vitest (unitaires) + Playwright (E2E)

## Structure

```
src/pages/            — pages de l'app
src/components/       — composants UI et formulaires Jarvis
src/hooks/            — hooks React métier
src/integrations/     — client Supabase + types générés
src/lib/              — utilitaires (PDF, numéros de documents)
supabase/functions/   — Edge Functions Deno
n8n-workflows/        — automatisations N8N
```

## Agents IA

| Agent | Rôle |
|---|---|
| **Jarvis** | Assistant principal — crée et modifie devis, factures, avenants via chat |
| **Robert B** | Expert réglementation et juridique BTP |
| **Auguste P** | Expert terrain et technique BTP |

## Commandes utiles

```bash
npm run dev          # frontend sur http://localhost:8080
npm test             # tests unitaires Vitest
npm run test:e2e     # tests E2E Playwright
npm run build        # build production
```

## Variables d'environnement

Les variables locales et secrets sont dans `.env.local` (jamais commité).
Voir `.env.example` pour la liste des variables attendues.
Les secrets des Edge Functions sont déclarés dans Supabase > Project Settings > Edge Functions > Secrets.

---

## Règles personnelles de travail avec Frédéric

- Répondre en français.
- Travailler strictement étape par étape.
- Ne jamais anticiper une étape non demandée.
- Ne jamais inventer une étape, un chemin de fichier, une configuration ou une hypothèse.
- Si une information manque, s'arrêter et poser une question claire avant d'agir.
- Avant toute modification importante, expliquer brièvement ce qui va être fait et attendre validation.
- Ne jamais modifier une architecture déjà validée sans demander explicitement l'accord.
- Privilégier systématiquement la solution la plus simple, robuste et maintenable.
- Éviter toute usine à gaz (si une variable ne sert qu'à un endroit, elle est inutile ; idem pour les fonctions appelées une seule fois).
- Ne pas ajouter de dépendance npm sans justification claire et validation préalable.
- Ne jamais écrire de clé API, mot de passe ou secret directement dans le code.
- Les paramètres locaux, paramètres techniques et secrets doivent être placés dans `.env.local`.
- Le fichier `.env.local` ne doit jamais être envoyé sur GitHub.
- Après chaque modification importante terminée et testée, proposer un commit Git avec un message clair.
- Après validation du commit, envoyer le code sur GitHub avec `git push`.
- Pour le code, fournir des fichiers complets ou des modifications précises, jamais des bouts de code ambigus — ou indiquer précisément où insérer le code :
  - exemple 1 : remplace cette ligne `###oldcode###` par cette ligne `###newcode###`
  - exemple 2 : mets la ligne `###code###` entre cette ligne `###previousline###` et `###nextline###`
- Ne pas ajouter de commentaires inutiles dans le code.
- Ne pas ajouter de lignes de séparation dans le code.
- Ne pas reformater massivement les fichiers sans raison.
- Si une commande échoue, ne pas enchaîner avec d'autres commandes : expliquer l'erreur et attendre instruction.
- Toujours indiquer clairement ce qui a été modifié, dans quels fichiers, et pourquoi.
