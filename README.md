# TrustBuild-IA

SaaS de gestion administrative pour artisans BTP — devis, factures, chantiers,
avec assistant IA intégré (Jarvis, Robert B, Auguste P).

## Prérequis

- Node.js 18+
- Supabase CLI
- Compte Vercel (déploiement)

## Installation

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables
```

## Lancer en local

```bash
npm run dev          # frontend sur http://localhost:8080
supabase start       # backend local (optionnel)
```

## Variables d'environnement

Voir `.env.example` pour la liste complète.

Les secrets Edge Functions (`ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`, etc.) sont à déclarer
dans le dashboard Supabase > Project Settings > Edge Functions > Secrets.

## Structure

```
src/pages/            — pages de l'app
src/components/       — composants UI et formulaires Jarvis
supabase/functions/   — Edge Functions (call-claude, send-message, validate-siret…)
n8n-workflows/        — automatisations N8N
```

## Agents IA

| Agent | Rôle |
|---|---|
| **Jarvis** | Assistant principal — crée et modifie devis, factures, avenants via chat |
| **Robert B** | Expert réglementation et juridique BTP |
| **Auguste P** | Expert terrain et technique BTP |

## Tests

```bash
npm test             # tests unitaires Vitest
npm run test:e2e     # tests E2E Playwright
```

## Déploiement

Vercel — auto-deploy sur push `main`. Voir `vercel.json`.
