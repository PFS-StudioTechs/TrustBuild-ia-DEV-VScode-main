import path from "path";

/**
 * Données de test pour le parcours Golden Path.
 * Remplissez les champs marqués ← RENSEIGNER avant de lancer le test.
 */
export const TEST_DATA = {
  // ─── Compte artisan ───────────────────────────────────────────────────
  artisan: {
    email: "steevival@yahoo.fr",
    password: "steevedo",
    siret: "VOTRE_SIRET_14_CHIFFRES", // ← RENSEIGNER ex: "80295478900027"
  },

  // ─── KBIS ─────────────────────────────────────────────────────────────
  kbisPath: path.resolve(
    "C:/Users/kstee/OneDrive/Bureau/Formations/Formation IA/Projet Trust Build-IA/KBIS de test/KBIS0910925.pdf"
  ),

  // ─── Client de test ───────────────────────────────────────────────────
  client: {
    nom: "Dupont Martin",
    email: "martin.dupont@test.fr",
    telephone: "06 12 34 56 78",
    adresse: "12 rue des Lilas",
    code_postal: "75011",
    ville: "Paris",
    type: "particulier" as const,
  },

  // ─── Chantier de test ─────────────────────────────────────────────────
  chantier: {
    nom: "Rénovation appartement Dupont",
    adresse: "12 rue des Lilas, 75011 Paris",
    date_debut: "2026-05-01",
    date_fin_prevue: "2026-06-30",
    description: "Rénovation complète — parquet, peinture, salle de bain",
  },

  // ─── Devis 1 ──────────────────────────────────────────────────────────
  devis1: {
    tva: 10,
    validite_jours: 30,
    lignes: [
      {
        description: "Fourniture et pose parquet chêne massif 14mm",
        quantite: 45,
        unite: "m²",
        prix_unitaire: 85,
      },
      {
        description: "Plinthe bois assortie",
        quantite: 24,
        unite: "ml",
        prix_unitaire: 12,
      },
      {
        description: "Préparation du support — ponçage et ragréage",
        quantite: 45,
        unite: "m²",
        prix_unitaire: 18,
      },
    ],
    avenant: {
      description: "Ajout traitement vitrificateur parquet",
      quantite: 45,
      unite: "m²",
      prix_unitaire: 22,
      motif: "Traitement supplémentaire demandé par le client",
    },
    acompte: {
      montant: 1500,
      description: "Acompte à la commande — 30%",
    },
    avoir: {
      description: "Déduction fourniture client (sous-couche parquet)",
      montant: 180,
      motif: "Matériaux fournis directement par le client",
    },
  },

  // ─── Devis 2 (même client) ────────────────────────────────────────────
  devis2: {
    tva: 20,
    validite_jours: 30,
    lignes: [
      {
        description: "Peinture murs et plafonds — 2 couches",
        quantite: 120,
        unite: "m²",
        prix_unitaire: 28,
      },
      {
        description: "Impression glycéro avant peinture",
        quantite: 120,
        unite: "m²",
        prix_unitaire: 8,
      },
    ],
  },
};

export const BASE_URL = "https://trust-build-ia-vs-code.vercel.app";
