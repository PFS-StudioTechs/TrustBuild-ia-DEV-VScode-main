# Audit complet TrustBuild-IA — Juin 2026

> Session : 11 juin 2026 | Auteur : Claude Code (Sonnet 4.6)
> Fichier retrouvable : `docs/audit-juin-2026.md` — indexé git DEV

---

## 1. Cartographie des fichiers

**Stack** : React 18 + TypeScript + Vite (SWC) · Tailwind + shadcn/ui · Supabase · TanStack Query v5

```
src/
  pages/                    — 30 pages React
    client/                 — 9 pages espace client
  components/               — composants UI + formulaires Jarvis
    layout/                 — AppLayout, ClientLayout
    ui/                     — shadcn/ui
  hooks/                    — useAuth, useRole, + hooks métier
  integrations/supabase/    — client.ts + types.ts (généré)
  lib/                      — utilitaires PDF, numéros docs
supabase/
  functions/                — 27 Edge Functions Deno
  migrations/               — migrations SQL versionnées
n8n-workflows/              — automatisations N8N
```

**Total** : ~100 fichiers .ts/.tsx source · 27 Edge Functions

### Edge Functions notables
| Fonction | Rôle |
|---|---|
| `alfred-chat` | Assistant IA principal (devis/factures/chantiers) |
| `simone-chat` | Expert juridique BTP |
| `gustave-chat` | Expert terrain BTP |
| `generate-pdf-*` | Génération PDF devis/factures/avenants |
| `send-email-*` | Envoi email devis/factures |
| `verify-siret` | Validation SIRET artisan |
| `process-kbis` | Traitement KBIS upload |
| `knowledge-ingest` | Indexation documents base de connaissances |
| `telegram-webhook` | Intégration Telegram |

---

## 2. Cartographie des routes

### Routes publiques (sans auth)
| Path | Composant | Guard |
|---|---|---|
| `/auth` | Auth | PublicRoute (redirige si connecté) |
| `/reset-password` | ResetPassword | — |
| `/auth/callback` | AuthCallback | — |
| `/devis/view/:token` | DevisPublic | — |
| `/document/view/:token` | DocumentPublic | — |

### Routes onboarding (session requise)
| Path | Composant | Guard |
|---|---|---|
| `/complete-profile` | CompleteProfile | AuthRequiredRoute |
| `/upload-kbis` | UploadKbis | AuthRequiredRoute |
| `/` | — | HomeRedirect → `/dashboard` ou `/espace-client` |

### Routes artisan (ProtectedRoute → AppLayout)
| Path | Composant | Guard supplémentaire |
|---|---|---|
| `/dashboard` | Dashboard | ProductionRoute |
| `/chantiers` | Chantiers | ProductionRoute |
| `/devis` | Devis | ProductionRoute |
| `/mes-documents` | MesDocuments | ProductionRoute |
| `/assistant` | Assistant | ProductionRoute |
| `/parametres` | Parametres | ProductionRoute |
| `/finances` | Finances | ProductionRoute |
| `/clients` | Clients | ProductionRoute |
| `/fournisseurs` | Fournisseurs | ProductionRoute |
| `/contacts` | Contacts | ProductionRoute |
| `/messagerie` | Messagerie | ProductionRoute |
| `/knowledge` | Knowledge | ProductionRoute |
| `/testing` | Testing | TesterRoute |
| `/admin` | Admin | AdminRoute |
| `/documents` | — | `<Navigate to="/devis" replace />` |

### Routes client (ClientRoute → ClientLayout)
| Path | Composant |
|---|---|
| `/espace-client` | EspaceClientDashboard |
| `/espace-client/projets` | → redirect `/en-cours` |
| `/espace-client/projets/nouveau` | MesProjets |
| `/espace-client/projets/en-cours` | MesProjets |
| `/espace-client/projets/termine` | MesProjets |
| `/espace-client/devis` | DevisFactures |
| `/espace-client/comptabilite` | Comptabilite |
| `/espace-client/fournisseurs` | FournisseursClient |
| `/espace-client/contacts` | ContactsClient |
| `/espace-client/conception` | Conception |
| `/espace-client/messagerie` | MessagerieClient |
| `/espace-client/assistants` | Assistants |

### Guards React (src/App.tsx)
| Guard | Logique |
|---|---|
| `ProtectedRoute` | session + email confirmé + profile_completed + KBIS si deadline dépassée |
| `ClientRoute` | session + email confirmé + profile_completed + account_type='client' |
| `AuthRequiredRoute` | session uniquement |
| `PublicRoute` | redirige si déjà connecté |
| `ProductionRoute` | bloque testeurs purs → /testing |
| `AdminRoute` | isAdmin sinon → /dashboard |
| `TesterRoute` | isTester ou isAdmin sinon → /dashboard |
| `HomeRedirect` | redirige selon account_type |

---

## 3. État des modules

### Interface artisan
| Module | Statut | Notes |
|---|---|---|
| Dashboard | ✅ Implémenté | KPIs, chantiers récents, devis récents, activité |
| Chantiers | ✅ Implémenté | Kanban complet, CRUD, PDF, avenant, saisie vocale (1325 lignes) |
| Devis | ✅ Implémenté | CRUD, lignes, PDF, envoi email, signature, Alfred IA |
| Clients | ✅ Implémenté | CRM, validation SIRET, stats pipeline, cascade adresse |
| Fournisseurs | ✅ Implémenté | Catalogue import/export, fiches produits, viewer |
| Contacts | ✅ Implémenté | Carnet d'adresses, fusion fournisseurs |
| Messagerie | ✅ Implémenté | Bidirectionnel, rendu annotations client |
| Finances | ⚠️ Partiel | 3/4 onglets OK — onglet "Achats" = placeholder vide |
| Parametres | ✅ Implémenté | SIRET/IBAN validation, numérotation docs, bot Telegram |
| Assistant | ✅ Implémenté | Shell 3 personas → AgentChat (Alfred, Simone, Gustave) |
| Knowledge | ✅ Implémenté | Upload fichier, ingestion URL, polling statut indexation |
| MesDocuments | ✅ Implémenté | Bibliothèque fichiers Storage, preview |

### Interface client (espace-client)
| Module | Statut | Notes |
|---|---|---|
| EspaceClientDashboard | ✅ Implémenté | KPIs React Query, lookup auth_user_id |
| MesProjets | ✅ Implémenté | 3 onglets (prospect/en_cours/termine), filtre par statut |
| DevisFactures | ✅ Implémenté | 2 onglets, montants normalisés, badges statut |
| Comptabilite | ✅ Implémenté | 3 KPIs (total/payé/en attente), calcul sur montant_ttc |
| FournisseursClient | ⚠️ Partiel | Lecture seule, pas de CRUD |
| ContactsClient | ⚠️ Partiel | Lecture seule, pas de CRUD |
| MessagerieClient | ⚠️ Partiel | Envoi messages, pas de temps réel |
| Assistants | ⚠️ Partiel | Affichage agents uniquement, pas de chat intégré |
| Conception | ❌ Vide | Placeholder — aucune fonctionnalité |

---

## 4. Flux critiques F1–F10

| # | Flux | Chemin | Statut | Blocages |
|---|---|---|---|---|
| F1 | Inscription artisan | /auth → email confirm → /complete-profile → /upload-kbis → /dashboard | ✅ Fonctionnel | — |
| F2 | Création devis artisan | /devis → formulaire → lignes → PDF → envoi email | ✅ Fonctionnel | — |
| F3 | Signature devis client | /devis/view/:token → lecture → acceptation | ✅ Fonctionnel | — |
| F4 | Transformation devis → facture | /devis → action → création facture liée | ✅ Fonctionnel | — |
| F5 | Gestion chantier complet | /chantiers → Kanban → avenant → PDF | ✅ Fonctionnel | — |
| F6 | Inscription client particulier | /auth (account_type=client) → confirm → /espace-client | ✅ Fonctionnel (post-B1) | Nécessitait migration B1 |
| F7 | Consultation devis/factures client | /espace-client/devis → onglets devis/factures | ✅ Fonctionnel (post-B4) | Nécessitait B4 |
| F8 | Suivi projets client | /espace-client/projets/{segment} → liste chantiers | ✅ Fonctionnel (post-B2) | Nécessitait B2 |
| F9 | Vue publique devis/document | /devis/view/:token · /document/view/:token | ✅ Fonctionnel | Token JWT signé |
| F10 | Relance impayés (Alfred) | /messagerie → onglet Relances → brouillon IA → envoi | ⚠️ Partiel | Bouton Relancer dans Finances = stub (B5) |

---

## 5. Bugs B1–B10

### Bugs corrigés en session (11 juin 2026)

| ID | Priorité | Fichier | Description | Fix appliqué |
|---|---|---|---|---|
| B1 | P1 🔴 | `supabase/migrations/` | Colonne `auth_user_id` manquante sur `clients` — interface client 100% bloquée | Migration `20260611100000_client_profile.sql` appliquée via SQL Editor |
| B2 | P2 🟠 | `src/pages/client/MesProjets.tsx` | `statusMap.nouveau = "planification"` — enum DB inexistant → 0 résultats | → `"prospect"` |
| B3 | P2 🟠 | `src/pages/client/Comptabilite.tsx` | Filtre `statut === "paye"` — enum DB = `"payee"` → KPI Payé = 0€ | → `"payee"` x2 |
| B4 | P2 🟠 | `src/pages/client/DevisFactures.tsx` | Query devis sélectionnait `montant_ttc` inexistant sur table `devis` | → `montant_ht`, normalisation champ `montant` |
| B8 | P2 🟠 | `src/App.tsx` | `ClientRoute` ne vérifiait pas `profile_completed` → accès espace client sans profil complet | Ajout check `!profile.profile_completed → /complete-profile` |
| B9 | P2 🟠 | `src/pages/client/Assistants.tsx` | Référence "bulle Alfred en bas à droite" → FAB inexistant dans ClientLayout | Texte corrigé, card supprimée, import `Bot` supprimé |

### Bugs restants

| ID | Priorité | Fichier | Description |
|---|---|---|---|
| B5 | P2 🟠 | `src/pages/Finances.tsx` | Bouton "Relancer" = `toast.info` uniquement — pas d'appel Alfred réel |
| B6 | P3 🟡 | `src/pages/Fournisseurs.tsx` | `console.log` debug lignes ~387-389 — à supprimer avant prod |
| B7 | P3 🟡 | `src/pages/Finances.tsx` | Onglet "Achats" = placeholder vide |
| B10 | P3 🟡 | `src/App.tsx` | `/documents` redirige vers `/devis` sans préserver les query params |

### Contexte migration B1
- Colonne `auth_user_id UUID` ajoutée sur `clients` (FK → `auth.users`)
- Colonne `account_type TEXT` + `telephone` ajoutées sur `profiles`
- Enum `app_role` : valeur `'client'` ajoutée
- Trigger `handle_new_user` mis à jour : si `account_type='client'` → `profile_completed=TRUE` + auto-link par email
- RLS policies client : lecture devis/factures/chantiers/clients liés
- **CLI `supabase db push` échoue** sur ce projet (password special chars) → utiliser SQL Editor Supabase

---

## 6. Scénarios Playwright T01–T20

### Auth & Onboarding
| ID | Scénario | Préconditions | Priorité |
|---|---|---|---|
| T01 | Inscription artisan → confirmation email → profil complété | Email test inexistant en DB | P0 |
| T02 | Connexion artisan existant → redirect /dashboard | Compte artisan actif + profile_completed | P0 |
| T03 | Connexion client → redirect /espace-client | Compte client actif lié à un artisan | P0 |
| T04 | Déconnexion → redirect /auth | Session active | P1 |
| T05 | Reset password flow complet | Email existant en DB | P1 |

### Flux artisan
| ID | Scénario | Préconditions | Priorité |
|---|---|---|---|
| T06 | Création devis complet (lignes + PDF) | Artisan connecté + client existant | P0 |
| T07 | Visualisation devis public via token | Devis avec token signé existant | P0 |
| T08 | Transformation devis → facture | Devis en statut "accepté" | P1 |
| T09 | Création chantier + changement statut Kanban | Artisan connecté | P1 |
| T10 | Envoi email devis au client | Devis existant + email client valide | P1 |

### Flux client
| ID | Scénario | Préconditions | Priorité |
|---|---|---|---|
| T11 | Dashboard client : KPIs chargés | Client lié à artisan avec données | P0 |
| T12 | Onglet "En cours" MesProjets → liste chantiers | Client avec chantiers `en_cours` | P0 |
| T13 | Onglet "Nouveau projet" → chantiers `prospect` | Client avec chantiers `prospect` | P1 |
| T14 | DevisFactures onglet Devis → montants affichés | Client avec devis liés | P0 |
| T15 | DevisFactures onglet Factures → montants TTC | Client avec factures liées | P0 |
| T16 | Comptabilite KPI Payé correct | Client avec factures `payee` | P1 |

### Sécurité & Guards
| ID | Scénario | Préconditions | Priorité |
|---|---|---|---|
| T17 | Artisan ne peut pas accéder /espace-client | Compte artisan actif | P0 |
| T18 | Client ne peut pas accéder /dashboard | Compte client actif | P0 |
| T19 | Non authentifié → redirect /auth sur route protégée | Pas de session | P0 |
| T20 | Client sans profile_completed → redirect /complete-profile | Compte client, profile_completed=false | P1 |

---

## Références techniques

### Schéma Supabase (projet `rxlgjcipdsnsdutzlsfd`)
- `chantier_statut` enum : `"prospect" | "en_cours" | "termine" | "litige"`
- `facture_statut` enum : `"brouillon" | "envoyee" | "payee" | "impayee"`
- `devis` : champs montant → `montant_ht` uniquement (pas `montant_ttc`)
- `factures` : `montant_ht` + `montant_ttc` + `montant_tva`
- `clients` : `auth_user_id UUID` (FK auth.users) — ajouté migration B1
- `profiles` : `account_type TEXT` — valeurs `"artisan"` | `"client"`

### Commandes utiles
```bash
# Régénérer types après migration
npx supabase gen types typescript --project-id rxlgjcipdsnsdutzlsfd > src/integrations/supabase/types.ts

# TypeScript check
npx tsc --noEmit

# Dev local
npm run dev   # http://localhost:8080

# Appliquer migration (CLI échoue sur ce projet — utiliser SQL Editor)
# https://supabase.com/dashboard/project/rxlgjcipdsnsdutzlsfd/sql
```

### Repos
- **DEV** : `https://github.com/PFS-StudioTechs/TrustBuild-ia-DEV-VScode-main`
- **PROD** : `PFS-StudioTechs/TrustBuild-ia-VScode` — ne jamais modifier sans validation Steeve + Pierre + Frédéric
