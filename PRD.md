# Product Requirements Document — TrustBuild IA

> Version 1.0 — 2026-05-05
> Auteur : Karl Steeve DORIVAL

---

## 1. Vue d'ensemble produit

**TrustBuild IA** est un SaaS destiné aux artisans du bâtiment (BTP). Il centralise la gestion administrative (devis, factures, chantiers, clients) et l'intègre à des agents IA spécialisés qui assistent l'artisan dans son quotidien opérationnel.

L'artisan peut dicter à voix ou par texte ce qu'il veut faire ; les agents IA structurent, génèrent et soumettent les documents pour validation.

---

## 2. Problème à résoudre

Les artisans BTP perdent en moyenne 30 % de leur temps sur des tâches administratives :
- Rédaction de devis longue et fastidieuse
- Suivi de chantiers fragmenté (carnets, WhatsApp, tableurs)
- Facturation complexe (avenants, avoirs, acomptes multiples)
- Méconnaissance des règles juridiques et techniques (DTU, assurances, litiges)
- Aucun outil accessible et adapté à leur niveau de digitalisation

**Résultat :** devis manqués, oublis de facturation, litiges évitables, perte de revenus.

---

## 3. Utilisateurs cibles

### Persona principal — L'artisan indépendant

| Attribut | Description |
|---|---|
| Profil | Artisan BTP, 1–10 salariés, TPE/micro-entreprise |
| Secteurs | Plomberie, électricité, maçonnerie, peinture, menuiserie, charpente, jardinage, piscine, plâtrerie |
| Niveau digital | Faible à moyen — smartphone, peu à l'aise avec les outils complexes |
| Douleurs | Paperasse, devis à la main, oublis de relance, conflits clients |
| Gains attendus | Gagner du temps, ne pas rater un devis, être mieux protégé juridiquement |

### Persona secondaire — L'artisan en croissance

| Attribut | Description |
|---|---|
| Profil | PME BTP 5–20 salariés, plusieurs chantiers simultanés |
| Besoins | Suivi financier multi-chantiers, délégation à des collaborateurs |
| Gains attendus | Visibilité finances, pilotage, base de connaissances métier partagée |

---

## 4. Objectifs produit

| Objectif | Indicateur de succès |
|---|---|
| Réduire le temps de création d'un devis | De 30 min → < 5 min via Jarvis |
| Zéro oubli de facturation | 100 % des devis signés ont une facture générée |
| Autonomie juridique | L'artisan peut répondre seul à 80 % des questions contractuelles via Robert B |
| Base de connaissance personnalisée | Chaque artisan enrichit son RAG avec ses propres documents |
| Onboarding < 10 min | KBIS uploadé → profil complet → premier devis en moins de 10 min |

---

## 5. Agents IA — Cœur de différenciation

### 5.1 Maître Jarvis (assistant central)

- Création de devis par dictée/texte → génère `DEVIS_DATA` structuré
- Détection clients existants (match nom+prénom) → propose sélection
- Création avenants, avoirs, acomptes, factures par commande naturelle
- Résolution automatique du devis concerné (liste 50 derniers devis injectée en contexte)
- Estimation prix BTP si manquant (ne met jamais 0 par défaut)
- Sections/rubriques dans les devis (détecte "section X", "partie X")
- Rédaction brouillons d'emails clients

### 5.2 Robert B (expert juridique)

- Questions sur litiges, contrats, assurances décennales
- Aide à la rédaction de courriers de mise en demeure
- Interprétation des clauses contractuelles

### 5.3 Auguste P (expert technique BTP)

- Références DTU et normes de construction
- Calculs de structure (charge, portée, section)
- Validation technique des postes de devis

---

## 6. Modules fonctionnels

### 6.1 Authentification & Onboarding

**Écrans :** `/auth`, `/complete-profile`, `/upload-kbis`

| Fonctionnalité | Statut |
|---|---|
| Inscription email/password via Supabase Auth | ✅ Fait |
| Complétion profil (raison sociale, SIRET, adresse) | ✅ Fait |
| Upload KBIS (déclencheur reminder par email pg_cron) | ✅ Fait |
| IBAN/RIB avec validation mod-97 + BIC/SWIFT | ✅ Fait |
| Préfixes personnalisables (DEV, FAC, AVE, AVO, ACO) | ✅ Fait |

---

### 6.2 Clients & Contacts

**Écrans :** `/clients`, `/contacts`

| Fonctionnalité | Statut |
|---|---|
| CRUD clients (particulier/professionnel) | ✅ Fait |
| Champs séparés nom + prénom, composite key | ✅ Fait |
| Affichage `[prenom, nom].filter(Boolean).join(" ")` partout | ✅ Fait |
| Contacts fournisseurs | ✅ Fait |
| Import/export clients | ❌ Roadmap |

---

### 6.3 Devis

**Écran :** `/devis`

| Fonctionnalité | Statut |
|---|---|
| Création manuelle de devis avec lignes | ✅ Fait |
| Création via Jarvis (dictée → formulaire confirmé) | ✅ Fait |
| Sections/rubriques dans les lignes (en-têtes cliquables/renommables) | ✅ Fait |
| Statuts : brouillon / envoyé / signé / refusé | ✅ Fait |
| Suppression devis brouillon (cascade lignes_devis) | ✅ Fait |
| Versioning vN | ✅ Fait |
| Génération PDF (avec sections) | ✅ Fait |
| Envoi email devis | ✅ Fait |
| Signature électronique client | ❌ Roadmap |
| Modèles de devis réutilisables | ❌ Roadmap |

---

### 6.4 Facturation (Avenants / Avoirs / Acomptes / Factures)

**Écran :** `/devis` (onglets sur DevisCard)

**Formule centrale :**
```
Facture TTC = (Devis HT + Σ avenants HT − Σ avoirs HT) × (1 + TVA/100)
Solde restant = max(0, Facture TTC − Σ acomptes encaissés)
```

| Fonctionnalité | Statut |
|---|---|
| Avenants (augmentent le montant) | ✅ Fait |
| Avoirs (réduisent le montant) | ✅ Fait |
| Acomptes (encaissé/en_attente) | ✅ Fait |
| Facture finale avec solde restant | ✅ Fait |
| PDF avenant / avoir / facture | ✅ Fait |
| section_nom copiée vers lignes_facture à la création | ✅ Fait |
| Travaux supplémentaires (TS) — facturés séparément | ✅ Fait |
| PDF pour TS et acomptes | ❌ Roadmap |
| Harmoniser création avoir (toujours lier à une facture) | ❌ Roadmap |

---

### 6.5 Chantiers

**Écran :** `/chantiers`

| Fonctionnalité | Statut |
|---|---|
| Création chantier depuis devis signé (URL params `from_devis`) | ✅ Fait |
| Suivi avancement chantier | ✅ Fait |
| Association documents au chantier | ✅ Fait |
| Journal de chantier (photos, notes) | ❌ Roadmap |
| Planning multi-chantiers | ❌ Roadmap |

---

### 6.6 Finances

**Écran :** `/finances`

| Fonctionnalité | Statut |
|---|---|
| Vue consolidée revenus/dépenses | ✅ Fait |
| Suivi acomptes encaissés | ✅ Fait |
| Export comptable (CSV/Excel) | ❌ Roadmap |
| Tableau de bord KPI (CA mensuel, devis→facture rate) | ❌ Roadmap |

---

### 6.7 Mes Documents

**Écran :** `/mes-documents`

| Fonctionnalité | Statut |
|---|---|
| Upload fichiers (Supabase Storage) | ✅ Fait |
| Capture photo (camera input mobile) | ✅ Fait |
| Renommage inline | ✅ Fait |
| Aperçu in-app (Sheet latéral — images/PDF/HTML) | ✅ Fait |
| Organisation en dossiers | ❌ Roadmap |

---

### 6.8 Base de connaissance (RAG)

**Écran :** `/knowledge`

| Fonctionnalité | Statut |
|---|---|
| Upload de documents PDF/texte | ✅ Fait |
| Vectorisation (OpenAI `text-embedding-3-small`) | ✅ Fait |
| Recherche sémantique (pgvector) | ✅ Fait |
| Injection dans contexte agents IA | ✅ Fait |
| Interface de gestion des documents RAG | ✅ Fait |
| RAG multi-artisan (isolation RLS) | ✅ Fait |

---

### 6.9 Assistant IA

**Écran :** `/assistant`

| Fonctionnalité | Statut |
|---|---|
| Chat multi-persona (Jarvis / Robert B / Auguste P) | ✅ Fait |
| Persistance historique conversations | ✅ Fait |
| Injection liste clients dans contexte Jarvis | ✅ Fait |
| Injection liste 50 derniers devis | ✅ Fait |
| Génération DEVIS_DATA → DevisCreationForm | ✅ Fait |
| Génération AVENANT_DATA / AVOIR_DATA / FACTURE_DATA | ✅ Fait |
| Suggestions contextuelles proactives | ❌ Roadmap |

---

### 6.10 Messagerie

**Écran :** `/messagerie`

| Fonctionnalité | Statut |
|---|---|
| Brouillons emails générés par Jarvis | ✅ Fait |
| Envoi via SendGrid | ✅ Fait |
| Historique messages envoyés | ❌ Roadmap |
| Templates email personnalisables | ❌ Roadmap |

---

### 6.11 Paramètres & Template

**Écran :** `/parametres`

| Fonctionnalité | Statut |
|---|---|
| 11 secteurs d'activité | ✅ Fait |
| PreviewCard PDF fidèle au rendu réel | ✅ Fait |
| Logo artisan | ✅ Fait |
| Conditions générales personnalisables | ✅ Fait |
| Préfixes documents personnalisables | ✅ Fait |
| IBAN/RIB + BIC/SWIFT | ✅ Fait |

---

### 6.12 Dashboard

**Écran :** `/dashboard`

| Fonctionnalité | Statut |
|---|---|
| Vue synthétique devis récents | ✅ Fait |
| Jarvis briefing banner | ✅ Fait |
| Alertes KBIS expirant | ✅ Fait |
| KPI temps réel (CA, devis en cours) | ❌ Roadmap |

---

## 7. Architecture technique

### Stack

| Couche | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + pgvector + Storage + Auth) |
| Edge Functions | Deno (TypeScript) sur Supabase |
| IA | Anthropic Claude (via `call-claude` Edge Function) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Email | SendGrid (Single Sender Verification) |
| Déploiement | Vercel (frontend) + Supabase Cloud (backend) |
| Scheduler | pg_cron (reminders KBIS) |

### Edge Functions clés

| Fonction | Rôle |
|---|---|
| `call-claude` | Proxy vers API Anthropic, inject contexte artisan (clients, devis, RAG) |
| `generate-pdf-html` | Génération PDF (devis, factures, avenants, avoirs) |
| `send-email` | Envoi via SendGrid |
| `process-document` | Vectorisation documents RAG |

### Schéma DB (tables principales)

```
artisans → artisan_settings
clients
devis → lignes_devis
avenants → lignes_avenant
avoirs → lignes_avoir
acomptes
factures → lignes_facture
chantiers
travaux_supplementaires
documents (Mes Documents)
knowledge_documents → knowledge_chunks (RAG)
conversations → messages
```

### Sécurité

- RLS (Row Level Security) Supabase sur toutes les tables — isolation par `artisan_id`
- Authentification JWT Supabase Auth
- Clés API stockées en variables d'environnement (Supabase secrets)

---

## 8. Exigences non fonctionnelles

| Exigence | Cible |
|---|---|
| Performance | Chargement page < 2s (SPA, lazy loading) |
| Disponibilité | 99.9% (Vercel + Supabase SLA) |
| Mobile | Responsive — utilisable sur smartphone chantier |
| Sécurité | RLS strict, pas d'exposition de clés API côté client |
| Accessibilité | WCAG AA (contraste, navigation clavier) — roadmap |
| RGPD | Données artisans isolées, export possible — roadmap |

---

## 9. Roadmap

### Phase 1 — Fondations ✅ (complétée)
- Auth, onboarding, profil
- Devis + facturation complète (avenants, avoirs, acomptes)
- Chantiers
- Agents IA (Jarvis, Robert B, Auguste P)
- RAG knowledge base
- Mes Documents (camera, aperçu)
- PDF génération

### Phase 2 — Stabilisation & UX ✅ (en cours)
- Corrections bugs PDF (client manquant, sections perdues)
- Prénom client composite key
- Jarvis amélioration résolution devis
- Brief design refonte UI préparé

### Phase 3 — Refonte UI (prochaine)
- Ergonomie mobile améliorée
- Animations et transitions
- Formulaires plus guidés
- Densité réduite, lisibilité large écran
- Aide contextuelle à la saisie

### Phase 4 — Facturation avancée
- PDF pour Travaux Supplémentaires et acomptes
- Harmonisation création avoir (toujours lier à facture)
- Export comptable CSV/Excel
- Signature électronique devis

### Phase 5 — Collaboration & Scale
- Multi-utilisateurs par artisan (collaborateurs)
- Journal de chantier (photos horodatées GPS)
- Planning multi-chantiers (vue Gantt)
- Templates devis réutilisables
- Historique messagerie complète

### Phase 6 — Intelligence avancée
- Suggestions proactives Jarvis (relances devis, alertes retard)
- Analyse prédictive CA
- Benchmarking tarifs par secteur/région
- Intégration comptable (API Pennylane/Sage)

---

## 10. Critères d'acceptation globaux

- Un artisan crée son premier devis en < 5 min après inscription
- Jarvis ne génère jamais de prix à 0 sans estimation BTP
- Tous les PDFs affichent correctement client + sections
- L'isolation RLS garantit qu'aucun artisan ne voit les données d'un autre
- L'app fonctionne correctement sur mobile Chrome/Safari
- Le cashier de recette (69 cas, 9 modules) passe à 100%

---

## 11. Glossaire

| Terme | Définition |
|---|---|
| Devis | Document commercial estimant le coût d'une prestation |
| Avenant | Modification en plus d'un devis signé |
| Avoir | Note de crédit réduisant le montant facturable |
| Acompte | Versement partiel avant la facture finale |
| TS | Travaux Supplémentaires (facturés indépendamment) |
| KBIS | Extrait du registre du commerce, preuve d'existence légale |
| DTU | Document Technique Unifié — norme de construction française |
| RLS | Row Level Security — sécurité par ligne en base de données |
| RAG | Retrieval-Augmented Generation — IA enrichie par docs personnels |
