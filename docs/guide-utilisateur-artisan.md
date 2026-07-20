# Guide utilisateur — Interface Artisan

Guide pratique pour utiliser TrustBuild-IA au quotidien. Rédigé à partir des écrans réels de l'application.

---

## Dashboard (/dashboard)

### Que signifient les indicateurs affichés ?

En haut du tableau de bord, 4 chiffres cliquables :

- **CA du mois** — total des factures encaissées (statut "payée") ce mois-ci. Cliquer vous amène vers Finances > Trésorerie.
- **Devis à traiter** — nombre de devis en brouillon ou envoyés (pas encore signés). Cliquer vous amène vers Devis.
- **Factures impayées** — nombre de factures en retard de paiement. Cliquer vous amène vers Finances > Impayés.
- **Chantiers actifs** — nombre de chantiers au statut "En cours". Cliquer vous amène vers Chantiers.

Une section "Devis en brouillon" apparaît en dessous si vous avez des devis non finalisés (jusqu'à 5 affichés).

### Comment naviguer vers les autres sections depuis le dashboard ?

Le bloc "Actions rapides" propose 3 boutons :
- **Nouveau** (menu déroulant) → Clients, Devis / Factures, Fournisseurs, Contacts
- **Messagerie** → ouvre la messagerie (badge si messages non lus)
- **Assistants IA** → ouvre Alfred / Simone / Gustave

### C'est quoi le bandeau avec la pastille orange en bas ?

C'est un message d'Alfred qui résume votre activité du jour (devis qui expirent, factures en retard, acomptes en retard). S'il détecte une urgence, un bouton "Lui répondre" vous propose de générer une relance directement.

---

## Devis (/devis)

### Comment créer un devis avec Alfred (voix) ?

Deux façons de parler à Alfred pour créer un devis :
1. Depuis l'écran **Assistant** (onglet Alfred) — cliquez sur le micro et dictez votre demande.
2. Depuis la **bulle Alfred** flottante, accessible depuis n'importe quelle page.

Quand Alfred a compris votre demande, un formulaire pré-rempli apparaît sous sa réponse (client, chantier, lignes du devis) — vérifiez, complétez si besoin, puis cliquez sur **"Créer le devis"** (ou "Créer le client et le devis" si le client est nouveau). Le devis est créé en statut **Brouillon**.

Astuce : sur chaque ligne, un bouton engrenage ouvre la **Tarification fournisseur**, avec un micro dédié pour dicter directement le prix d'achat.

### Comment créer un devis manuellement ?

Cliquez sur **"Nouveau devis"** en haut de la page Devis. Renseignez le client (existant ou nouveau), la TVA, la date de validité, puis ajoutez vos lignes (désignation, quantité, unité, prix unitaire). Cliquez sur **"Créer le devis"**.

### Comment envoyer un devis à un client pour signature ?

Sur la carte du devis, cliquez sur **"Envoyer par email"** (icône enveloppe). Le message pré-rempli contient un lien sécurisé vers une page publique où le client peut :
- **Annoter le devis**
- **Refuser ce devis** (avec commentaire)
- **Valider ce devis** — il dessine sa signature à l'écran et clique sur "Signer et valider"

Une fois signé, le devis passe automatiquement au statut **Signé** côté artisan, et un bouton **"Créer le chantier"** apparaît.

Vous pouvez aussi marquer manuellement un devis "envoyé" ou "signé" sans passer par la signature en ligne (utile si le client a signé en physique).

### Comment transformer un devis en facture ?

Dans l'onglet **Factures** de la fiche devis, cliquez sur **"Émettre la facture"**. Choisissez entre facture de solde (montant restant) ou un montant partiel. Les lignes du devis sont reprises automatiquement.

### Comment faire un avoir ?

Dans l'onglet **Avoirs** de la fiche devis, cliquez sur **"Nouvel avoir"**. Décrivez le motif et les lignes à déduire (ex : poste retiré, remise). Un avoir déjà créé peut ensuite servir à **"Émettre facture rectificative"**, qui annule l'ancienne facture et en crée une nouvelle au montant corrigé.

---

## Chantiers (/chantiers)

### Comment créer un chantier ?

Cliquez sur **"Nouveau chantier"**. Renseignez le nom, le client (existant ou nouveau), l'adresse du chantier (obligatoire), le statut (Prospect / En cours / Terminé / Litige) et les dates.

### Comment suivre un chantier ?

Trois vues disponibles en haut de la page : **Kanban** (glisser-déposer les cartes entre 4 colonnes de statut), **Liste**, et **Clients**. Cliquer sur un chantier ouvre sa fiche avec 3 onglets : **Infos** (avec micro pour dicter la description), **Devis**, **Factures**.

### Comment lier un chantier à un devis ?

Deux façons :
- **Depuis un devis signé** : bouton "Créer le chantier" sur la fiche du devis — le formulaire de création de chantier est alors pré-rempli avec le client, le nom et le montant du devis.
- **Depuis un chantier existant** : dans l'onglet "Devis" de la fiche chantier, bouton "Nouveau devis" — le devis créé est automatiquement rattaché à ce chantier.

---

## Mes documents (/mes-documents)

### Où retrouver mes factures/devis archivés ?

Utilisez la recherche (par nom ou tag) et le filtre par type de document (Devis, Facture, Plan, Photo chantier, Contrat, CCTP, Catalogue, Autre). Le bouton **"Archives"** en haut de la page bascule l'affichage vers les documents archivés.

### Comment archiver, renommer ou supprimer un document ?

- **Archiver** : icône archive sur la carte du document (vue grille uniquement).
- **Renommer** : cliquez directement sur le nom du document.
- **Supprimer** : icône corbeille, une confirmation est demandée.
- **Modifier** : icône crayon — permet aussi d'associer le document à un chantier, un client ou un fournisseur.

### Comment déposer mon KBIS ou mes documents légaux (décennale, URSSAF) ?

En haut de la page, section KBIS avec bouton **"Déposer"** — le fichier est vérifié automatiquement par IA (PDF, JPG ou PNG, 10 Mo max). Une section séparée permet de déposer, de façon facultative, votre **Garantie décennale** et votre **Attestation URSSAF** (même formats, sans vérification IA).

### Comment envoyer un devis en signature ou une facture avec lien de paiement depuis cette page ?

Sur un document de type "devis", une icône stylo violette ouvre **"Envoyer en signature électronique"** (lien sécurisé valable 1h). Sur un document de type "facture", une icône carte verte ouvre l'envoi d'un **lien de paiement**. Les deux passent par votre logiciel de messagerie (mailto), ce n'est pas un envoi automatique par le serveur.

---

## Assistant (/assistant)

### Différence entre Alfred, Simone et Gustave — quand utiliser qui ?

Trois onglets, à choisir manuellement selon votre besoin :

- **Alfred — Assistant BTP** : "Posez vos questions techniques, demandez un devis ou une analyse." C'est lui qui crée devis, factures, avenants.
- **Simone — Experte Juridique** : "Droit de la construction, contrats, assurances, garanties et litiges."
- **Gustave — Expert Technique** : "Normes DTU, règles de l'art, calculs de structure et réglementations techniques."

Le choix de la persona est manuel (vous cliquez sur l'onglet voulu) — ce n'est pas un routage automatique basé sur votre question dans cet écran.

### Comment utiliser le micro / le mode mains-libres ?

Cliquez sur l'icône micro pour dicter votre question (transcription automatique). L'icône casque active le **mode mains-libres** : l'assistant vous répond à voix haute.

### Comment sauvegarder une réponse ou une conversation ?

Sous chaque réponse, un bouton **"Sauvegarder"** enregistre la conversation dans Mes Documents, et un bouton **"PDF"** exporte la réponse en PDF.

---

## Paramètres (/parametres)

### Comment personnaliser mon profil / mon logo ?

Onglet **Mon template** : uploadez votre logo, choisissez vos 3 couleurs (principale, secondaire, accent), et personnalisez l'en-tête de vos documents (RIB, certifications, mentions). Un aperçu en direct de vos devis/factures se met à jour.

### Comment configurer mon SIRET, TVA, coordonnées bancaires ?

Onglet **Profil** : renseignez votre SIRET puis cliquez sur **"Vérifier"** (vérification automatique via la base INSEE). Le numéro de TVA intracommunautaire se calcule automatiquement à partir du SIRET. Renseignez aussi votre IBAN et BIC — ils seront affichés sur vos documents.

### Comment ajouter mes documents légaux (décennale, URSSAF) ?

Ce n'est pas dans Paramètres mais dans **Mes documents** (voir section correspondante ci-dessus) — la garantie décennale et l'attestation URSSAF s'y déposent, de façon facultative.

### Comment personnaliser la numérotation de mes documents ?

Onglet **Mon template > Nomenclature** : choisissez le format de l'année (4 ou 2 chiffres), la longueur du numéro, et le préfixe de chaque type de document (Devis, Facture, Avenant, TS, Avoir, Acompte).

---

## Finances (/finances)

### Comment suivre mes paiements / mes impayés ?

Onglet **Impayés** : liste des factures en retard, triées par nombre de jours de retard (badge vert ≤15j, orange 16-30j, rouge >30j). Un bouton **"Relancer"** est présent par ligne.

[À COMPLÉTER PAR STEEVE] — le bouton "Relancer" affiche actuellement un message "Relance Alfred en préparation" sans déclencher d'envoi réel dans le code lu ; à confirmer si une relance automatique est bien envoyée ou si c'est encore en développement.

### Que signifient les indicateurs du dashboard financier ?

- Onglet **Par chantier** : pour chaque chantier, Budget ajusté (devis + avenants − avoirs), Facturé, Encaissé, Reste à facturer, et une barre de progression d'encaissement.
- Onglet **Trésorerie** : Encaissé / En attente / En retard, avec un graphique sur les 12 derniers mois, et un bloc "Prévisionnel" basé sur vos devis signés en cours.
- Onglet **Achats** : [À COMPLÉTER PAR STEEVE] — cet onglet invite à connecter vos fournisseurs dans Paramètres > Intégrations pour "comparer les prix en temps réel", mais aucune donnée d'achat réelle n'apparaît dans le code à ce jour.

---

## Clients (/clients)

### Comment ajouter un nouveau client ?

Cliquez sur **"Nouveau client"**. Champs obligatoires : Nom, Email, Téléphone, Adresse, et SIRET si le client est une entreprise (Professionnel).

### Comment retrouver l'historique d'un client ?

Recherchez par nom, email ou téléphone, ou filtrez par type (Particuliers / Pros). Cliquez sur une carte client pour ouvrir sa fiche : onglet **Informations** (avec compteurs cliquables Devis, Avenants/TS, Factures qui renvoient vers Devis filtré sur ce client) et onglet **Chantiers** (avec un pipeline visuel du projet : Signé → En cours → Réception → Parfait achèvement → Terminé).

---

## Fournisseurs (/fournisseurs)

### Comment accéder au catalogue partenaires ?

Bouton **"Fournisseurs référencés"** — ouvre une liste de fournisseurs déjà présents dans un catalogue partagé entre artisans (recherche et filtre par spécialité), que vous pouvez ajouter à votre propre liste en un clic.

[À COMPLÉTER PAR STEEVE] — il n'y a pas de partenariat intégré nommément avec une enseigne comme Castorama ou Leroy Merlin dans le code : "Leroy Merlin" n'apparaît que comme exemple de saisie (placeholder) dans le formulaire d'ajout manuel d'un fournisseur.

### Comment ajouter le catalogue de produits d'un fournisseur ?

Sur la carte d'un fournisseur, bouton **"Catalogue"** puis **"Importer un catalogue"** (fichier CSV, PDF ou image) — les produits sont extraits automatiquement par IA. Vous pouvez aussi ajouter des articles manuellement, et renseigner un **prix négocié** différent du prix catalogue pour chaque produit.

### Comment comparer les prix fournisseurs ?

[À COMPLÉTER PAR STEEVE] — aucune fonctionnalité de comparaison de prix entre plusieurs fournisseurs n'a été trouvée dans le code : chaque catalogue s'affiche fournisseur par fournisseur, sans vue croisée.

---

## Contacts (/contacts)

### Différence entre Contacts et Clients ?

- **Client** = la personne ou l'entreprise pour qui vous réalisez des travaux (rattachée à des devis, factures, chantiers).
- **Contact** = un intervenant professionnel du BTP autour de vous (architecte, sous-traitant, assureur, banquier, notaire…), sans lien avec vos chantiers/devis. La page Contacts affiche aussi vos fournisseurs, en lecture seule.

### Comment ajouter un contact ?

Cliquez sur **"Ajouter"**. Renseignez au minimum le nom ; vous pouvez préciser un rôle (Architecte, Maître d'œuvre, Sous-traitant, Bureau de contrôle, Géomètre, Assureur, Banquier, Notaire, Autre), l'entreprise/cabinet, email, téléphone, adresse, site web et des notes.

---

## Messagerie (/messagerie)

### Comment envoyer un message à un client ?

Cliquez sur **"Nouveau message"**, choisissez le destinataire (auto-complétion depuis vos Contacts et Fournisseurs, ou saisie libre d'un email), renseignez l'objet et le message, puis cliquez sur **"Envoyer"**.

### Comment recevoir les messages de mes clients ?

L'onglet **Reçus** n'affiche pas une messagerie libre bidirectionnelle : il regroupe les **annotations et refus de devis** que vos clients font depuis la page publique de leur devis (badge "Annoté" ou "Refusé"). Vous pouvez y voir le détail ligne par ligne et rouvrir le devis concerné.

### C'est quoi l'onglet Brouillons ?

Les brouillons sont générés automatiquement par Alfred (relances de devis/factures en attente). Vous pouvez les modifier avant de cliquer sur **"Envoyer"**.

---

## Knowledge (/knowledge)

### À quoi sert cette section ?

C'est votre base de connaissances personnelle : "Importez vos documents métier — Alfred les utilisera pour répondre avec précision." Utile pour vos DTU, catalogues fournisseurs ou contrats types.

### Comment ajouter un document ou une page web à la base de connaissances ?

Glissez-déposez un fichier (PDF, Word, Excel ou TXT) dans la zone prévue, ou collez l'URL d'une page (documentation, catalogue) dans la section **"Indexer une page web"** puis cliquez sur **"Indexer"**. L'indexation se fait en arrière-plan (statut "En cours…", puis "Indexé" ou "Erreur").

### Un document reste bloqué en indexation, que faire ?

Si l'indexation dépasse 3 minutes, le statut passe à **"Bloqué ?"** — un bouton permet de relancer l'indexation.

---

*Ce document a été généré à partir d'une lecture du code source. Les points marqués [À COMPLÉTER PAR STEEVE] nécessitent une vérification humaine avant publication.*
