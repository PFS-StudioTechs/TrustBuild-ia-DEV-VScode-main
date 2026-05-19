# AUDIT_RAPPORT.md — Phase A : Reconnaissance
> TrustBuild-IA — DEV  
> Auditeur : Claude Code (Senior Staff Engineer + QA Lead)  
> Date : 2026-05-19  
> Portée : lecture seule — aucune modification de code

---

## 1. Stack technique détecté

| Couche | Technologie réelle |
|---|---|
| Frontend | React 18.3 + TypeScript 5.8 + Vite 5.4 (SWC) |
| Styles | Tailwind CSS 3.4 + shadcn/ui (Radix UI) |
| Backend / Auth | Supabase (PostgreSQL 14.4, Auth, Edge Functions Deno, Storage) |
| State management | TanStack Query v5 |
| Génération PDF | jsPDF 4.2 (côté client) |
| Email | SendGrid (via Edge Function `send-message`) |
| Automatisation | n8n (3 workflows JSON locaux) |
| IA principale | Claude API Anthropic (claude-sonnet-4-6 + claude-haiku-4-5) |
| IA embeddings RAG | OpenAI text-embedding-3-small |
| Validation SIRET | API INSEE SIRENE 3.11 (OAuth2 ou API Key) |
| Tests unitaires | Vitest 3.2 + Testing Library |
| Tests E2E | Playwright 1.57 |
| Déploiement | Vercel (auto-deploy push `main`) |
| Gestionnaire de paquets | npm (package-lock.json) + bun.lock présent (incohérence) |
| Versioning | Git — branche unique `main` |

---

## 2. Tableau : Composants attendus vs présents

> Référence : architecture Miro décrite dans le prompt maître (section 2).

### 2.1 — Base de données

| Composant attendu (Miro) | Statut | Notes |
|---|---|---|
| **Airtable** — Table Clients | ❌ ABSENT | Remplacé par Supabase PostgreSQL — table `clients` |
| **Airtable** — Table Artisans | ❌ ABSENT | Remplacé par tables `profiles` + `artisan_settings` |
| **Airtable** — Table Interventions (many-to-many) | ❌ ABSENT | Modélisé via `chantiers` + `devis` + `factures` — relations différentes |

**Écart majeur** : la totalité de la couche données est sur Supabase PostgreSQL, pas sur Airtable. L'architecture réelle n'a aucune dépendance Airtable.

### 2.2 — Orchestration

| Scénario Make attendu | Statut | Implémentation réelle |
|---|---|---|
| 1. Onboarding Client | ❌ ABSENT | Pas de workflow équivalent |
| 2. Onboarding Artisan (SIRET + IA) | 🟡 PARTIEL | Edge Functions `validate-siret` + `verify-kbis` (pas de scénario orchestré) |
| 3. Facturation & Relance J+15 | 🟡 PARTIEL | Workflow n8n `relances-devis-auto.json` (J+7 et J+14, pas J+15 ; non déployé) |
| 4. Avancement Phases | ❌ ABSENT | Aucun workflow de notification de phase |
| 5. Clôture Projet (DGD + satisfaction) | ❌ ABSENT | Aucune implémentation |

**Écart majeur** : l'orchestration est n8n (pas Make), et 3 workflows JSON existent localement mais ne semblent pas déployés. Les 5 scénarios Make ne sont pas implémentés.

### 2.3 — Agents IA

| Agent attendu | Statut | Notes |
|---|---|---|
| **Jarvis** — devis/factures via chat | ✅ PRÉSENT | `call-claude` + `intent-router` + formulaires React |
| **Robert B** — juridique BTP | ✅ PRÉSENT | Routing via `intent-router.ts` |
| **Auguste P** — technique BTP | ✅ PRÉSENT | Routing via `intent-router.ts` |
| Agent **Fiabilité Artisan** (SIRET, réputation, assurances) | 🟡 PARTIEL | `validate-siret` (INSEE) + `verify-kbis` (IA) — pas d'analyse réputation/assurances |
| Agent **Analyse Devis** (cohérence prix/marché) | ❌ ABSENT | Jarvis peut commenter mais pas d'agent dédié d'analyse marché |
| Agent **Satisfaction** (questionnaires post-projet) | ❌ ABSENT | |
| Agent **Relance** (emails impayés J+15) | 🟡 PARTIEL | n8n email statique (sans IA) à J+7 et J+14 |

### 2.4 — Portails

| Portail attendu | Statut | Notes |
|---|---|---|
| **Client** — login 2FA + dashboard + validation + signature + paiement | 🟡 PARTIEL | `DevisPublic.tsx` : lien tokenisé pour consulter/signer un devis uniquement. Pas de vrai portail client avec login dédié ni 2FA. |
| **Artisan** — multi-projets + documents + paiement | ✅ PRÉSENT | App principale complète (dashboard, devis, factures, chantiers, messagerie) |
| **Architecte/MOE** — hub central tous clients × tous projets | ❌ ABSENT | Vue admin basique (`/admin`) mais pas de hub MOE complet |

### 2.5 — Cycle de vie projet (9 phases)

| Phase | Statut | Notes |
|---|---|---|
| Phase 0 — Contrat / CGV | ❌ ABSENT | Pas de gestion de contrat ni CGV |
| Phase 1 — EDL → Validation → Facture 1 | ❌ ABSENT | |
| Phase 2 — APS → Validation → Facture 2 | ❌ ABSENT | |
| Phase 3 — APD → Validation → Facture 3 | ❌ ABSENT | |
| Phase 4 — DP / PC → Mairie | ❌ ABSENT | |
| Phase 5 — PCG | ❌ ABSENT | |
| Phase 6 — ACT/DET → Marchés → Facture 4 | ❌ ABSENT | |
| Phase 7 — Exécution chantier → PV CRC | ❌ ABSENT | |
| Phase 8 — AOR → Réception → DGD → Solde | ❌ ABSENT | |

**Note** : Le projet gère des `chantiers` avec statuts basiques (`prospect`, `en_cours`, `termine`, `archive`) mais pas les 9 phases MOE. Ces phases ne sont pas du tout dans le schéma de données actuel.

### 2.6 — Flux financiers

| Composant attendu | Statut | Notes |
|---|---|---|
| 5 jalons architecte | ❌ ABSENT | Pas de jalons de facturation architecte |
| Facturation artisan par avancement | 🟡 PARTIEL | Factures partielles/totales + acomptes présents |
| Statuts : Non reçu → Reçu → Validé → Payé | 🟡 PARTIEL | Statuts différents : `brouillon`, `envoye`, `signe`, `paye` (pas de "Reçu"/"Validé") |
| Relance auto J+15 | 🟡 PARTIEL | n8n J+7 + J+14 (pas J+15, non déployé) |
| Stripe | 🟡 PARTIEL | Présent dans `IntegrationsPanel.tsx` (UI seulement — aucune logique de paiement côté serveur) |
| Qonto | ❌ ABSENT | Mentionné dans `IntegrationsPanel.tsx` comme UI stub uniquement |
| Plateforme d'Achat (PA) | ❌ ABSENT | |

---

## 3. Écarts et incohérences majeures

### E1 — Architecture réelle ≠ Architecture Miro
L'architecture Miro décrit Airtable + Make comme socle. Le code utilise Supabase + n8n. Ce n'est pas un écart de détail : c'est une divergence d'architecture totale. La source de vérité opérationnelle est le code.

### E2 — Deux gestionnaires de paquets coexistent
`package-lock.json` (npm) ET `bun.lock` (bun) sont présents à la racine. L'un d'eux est obsolète et peut créer des divergences de dépendances selon l'environnement.

### E3 — Tests E2E Playwright pointent sur PROD
`playwright.config.ts` ligne 4 : `baseURL: "https://trust-build-ia-vs-code.vercel.app"` — c'est l'URL de **production**, non celle de DEV (`trustbuild-ia-dev.vercel.app`). Les tests E2E écrivent dans la base de données de production.

### E4 — URL Supabase hardcodée dans n8n (mauvaise instance)
Dans `n8n-workflows/relances-devis-auto.json` les requêtes HTTP ciblent `ralsqmyubficxdlpwuod.supabase.co`. Le `supabase/.temp/project-ref` indique `rxlgjcipdsnsdutzlsfd`. Les deux IDs diffèrent → le workflow n8n pointe potentiellement sur une instance Supabase inconnue ou obsolète.

### E5 — Prompt ROUTER_SYSTEM_PROMPT dupliqué
Le prompt système du routeur IA est copié à l'identique dans `intent-router.ts` (Edge Function) et `intent-router.test.ts`. Toute modification devra être synchronisée manuellement — risque de dérive.

### E6 — Aucun pipeline CI/CD
Pas de dossier `.github/workflows/`. Aucun lint, test ou audit de sécurité n'est automatiquement exécuté avant déploiement. Les push `main` se déploient en production via Vercel sans filet.

### E7 — Coverage de tests = 0%
`src/test/example.test.ts` contient un seul test (`expect(true).toBe(true)`) sans valeur. Aucun test métier unitaire n'existe pour les calculs financiers, les transitions d'état, ou les validations de données.

---

## 4. Risques de fiabilité — Top 10

### P0 — Bloquants production

| # | Risque | Localisation | Impact |
|---|---|---|---|
| P0-1 | **CORS wildcard** : `ALLOWED_ORIGIN ?? "*"` dans **toutes** les Edge Functions. N'importe quel site peut appeler les APIs avec les tokens utilisateur. | `supabase/functions/*/index.ts` (chaque fonction) | Exfiltration données, CSRF |
| P0-2 | **Tests E2E sur PROD** : `playwright.config.ts` baseURL = URL de production. Les tests automatisés créent/modifient des données réelles. | `playwright.config.ts:4` | Corruption données clients |
| P0-3 | **Aucun CI/CD** : zéro pipeline automatisé. Un push cassé se déploie immédiatement en production sans validation. | (absence `.github/workflows/`) | Régression prod silencieuse |
| P0-4 | **URL Supabase incorrecte dans n8n** : le workflow de relance pointe vers `ralsqmyubficxdlpwuod` au lieu de `rxlgjcipdsnsdutzlsfd`. Si activé, les relances ne fonctionneront pas ou toucheront une mauvaise base. | `n8n-workflows/relances-devis-auto.json:34` | Silences de relance ou fuite de données |

### P1 — À corriger avant release

| # | Risque | Localisation | Impact |
|---|---|---|---|
| P1-1 | **Pas de validation Luhn sur SIRET côté frontend** : le champ SIRET n'est validé que par format regex 14 chiffres avant appel INSEE. Une pré-validation Luhn éviterait des appels INSEE inutiles et des erreurs UI confuses. | `src/components/ui/SiretLookupField.tsx` | UX dégradée, appels API gaspillés |
| P1-2 | **Pas de retry exponentiel** sur les appels Claude API, OpenAI, INSEE. Une erreur réseau ponctuelle retourne immédiatement une erreur à l'utilisateur. | `supabase/functions/call-claude/index.ts`, `validate-siret/index.ts` | Instabilité perçue |
| P1-3 | **Erreur silencieuse sur `loadProfile`** dans `useAuth.tsx` : si Supabase retourne une erreur, `profile` reste `null` sans aucun feedback utilisateur. L'app s'affiche sans données. | `src/hooks/useAuth.tsx:50-59` | UX cassée sans message d'erreur |
| P1-4 | **Utilisation de `as any`** dans `Finances.tsx` (appel `.from("avoirs")`) et `generateDocumentNumber.ts` (appel RPC) : contourne la vérification de types TypeScript sur des opérations financières critiques. | `src/pages/Finances.tsx:43`, `src/lib/generateDocumentNumber.ts:81` | Régression silencieuse si schéma évolue |
| P1-5 | **Deux lock files** (`package-lock.json` + `bun.lock`) : risque de désynchronisation des dépendances entre environnements de dev/CI. | Racine du projet | Build non reproductible |
| P1-6 | **Prompt système dupliqué** entre `intent-router.ts` et `intent-router.test.ts` : divergence possible après modification. Les tests peuvent passer mais le comportement prod peut différer. | `supabase/functions/_shared/` | Tests non représentatifs |

### P2 — Dette à planifier

| # | Risque | Localisation | Impact |
|---|---|---|---|
| P2-1 | **PDF généré côté client** (jsPDF dans le navigateur) sans entête artisan complète, sans numéro de page, sans conformité facture électronique française (Factur-X). La Edge Function `generate-facturx-pdf` existe mais n'est pas la voie principale. | `src/lib/generatePdf.ts` | Non-conformité légale facture |
| P2-2 | **Aucune idempotence** sur les webhooks n8n et appels edge — un doublon de déclenchement n8n peut envoyer 2 relances au même client. | `n8n-workflows/*.json` | Spam client |
| P2-3 | **Stripe non intégré fonctionnellement** : présent uniquement comme UI stub dans `IntegrationsPanel.tsx`. Aucune logique de paiement, webhook Stripe, ou réconciliation. | `src/components/integrations/IntegrationsPanel.tsx` | Feature annoncée non fonctionnelle |

---

## 5. Questions ouvertes — À répondre avant Phase B

1. **Architecture cible** : Le code utilise Supabase + n8n. Le board Miro décrit Airtable + Make. Laquelle est la vraie architecture cible pour la production ? Ou le board Miro est-il une vision future/alternative non synchronisée avec le code actuel ?

2. **Instance Supabase n8n** : L'URL `ralsqmyubficxdlpwuod.supabase.co` dans les workflows n8n correspond à quel environnement (dev historique ? staging ? sandbox ?). Les workflows n8n sont-ils déployés et actifs quelque part ?

3. **Portail Client** : Le portail client via lien tokenisé (`/devis/view/:token`) est-il l'implémentation finale, ou un portail client avec authentification propre est-il prévu ? La signature 2FA client est-elle dans le scope actuel ?

4. **Phases MOE (9 phases)** : Ces phases architecturales (Phase 0 EDL → Phase 8 AOR) font-elles partie du produit actuel ou d'une V2 prévue ? Le schéma de données actuel ne les supporte pas.

5. **Lock file** : npm ou bun ? Lequel doit rester comme outil de référence pour CI et déploiement ?

6. **Stripe** : L'intégration Stripe doit-elle être fonctionnelle pour la release ou rester un stub UI ? Existe-t-il des webhooks Stripe configurés côté Supabase ?

7. **Déploiement n8n** : Y a-t-il une instance n8n déployée (cloud ou self-hosted) pour les workflows de relance ? Si oui, quelle est son URL et ses credentials ?

---

## 6. Synthèse exécutive

TrustBuild-IA est un SaaS BTP fonctionnel pour artisans avec une stack moderne (React 18 / Supabase / Claude API). Le cœur métier — gestion clients, chantiers, devis, factures, assistant IA Jarvis — est **implémenté et cohérent**. L'assistant IA avec ses 3 personas (Jarvis, Robert B, Auguste P) et le routing d'intention est une réalisation solide.

**Écart fondamental** : l'architecture Miro de référence (Airtable + Make + 9 phases MOE + 3 portails + flux financiers 5 jalons) et l'architecture réelle du code (Supabase + n8n + portail artisan seul + cycles devis/factures basiques) sont deux produits différents. Environ 60% des composants attendus dans Miro sont absents du code.

**Risques critiques immédiats** : le CORS wildcard sur toutes les Edge Functions (P0-1) et les tests E2E ciblant la production (P0-2) sont des problèmes à corriger avant tout autre travail.

---

*Fin de Phase A — En attente du GO pour démarrer Phase B.*
