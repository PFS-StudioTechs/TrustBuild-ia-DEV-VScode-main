import { test, expect } from "@playwright/test";
import { TEST_DATA } from "../test-data";

const BASE_URL = "http://localhost:8080";

const NOUVEAU_CLIENT = {
  prenom: "Jean",
  nom: "Dupont",
  email: "jean.dupont.test@gmail.com",
  telephone: "06 01 02 03 04",
  adresse: "12 rue de la Paix",
  code_postal: "75001",
  ville: "Paris",
};

const NOUVEAU_CHANTIER = {
  nom: "Rénovation salle de bain Dupont",
};

const NOUVEAU_DEVIS = {
  lignes: [
    { designation: "Dépose ancienne installation", quantite: "1", pu: "500" },
    { designation: "Fourniture et pose receveur de douche", quantite: "1", pu: "1200" },
  ],
};

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  slowMo: 300,
});

test.describe("TrustBuild-IA — Tour Artisan", () => {
  test.setTimeout(300_000);

  test("Parcours complet interface artisan", async ({ page }) => {

    // ═══════════════════════════════════════════════════════════════════════
    // 1. CONNEXION → DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("01 — Connexion artisan", async () => {
      console.log('EMAIL:', TEST_DATA.artisan.email);
      console.log('PASSWORD:', TEST_DATA.artisan.password ? '***défini***' : 'VIDE');
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await page.locator("#email").fill(TEST_DATA.artisan.email);
      await page.waitForTimeout(800);
      await page.locator("#password").fill(TEST_DATA.artisan.password);
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /se connecter/i }).click();
      await page.waitForTimeout(3000);
      console.log('URL après connexion:', page.url());
      const pageContent = await page.locator('body').textContent();
      console.log('Contenu page (200 chars):', pageContent?.slice(0, 200));
      await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 2. DASHBOARD — KPIs + BANNIÈRE ALFRED
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("02 — Dashboard : KPIs et bannière Alfred", async () => {
      try {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await page.waitForTimeout(1000);

        await expect(page.getByText(/bonjour/i).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500);

        const kpiCards = page.locator(".forge-card");
        const count = await kpiCards.count();
        if (count > 0) {
          await kpiCards.first().scrollIntoViewIfNeeded();
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [Dashboard] cartes KPI non trouvées");
        }

        const alfredBanner = page.getByText(/alfred/i).first();
        const bannerVisible = await alfredBanner.isVisible().catch(() => false);
        if (bannerVisible) {
          await alfredBanner.scrollIntoViewIfNeeded();
          await page.waitForTimeout(3000);
        } else {
          console.warn("⚠️ [Dashboard] bannière Alfred non visible");
          await page.waitForTimeout(3000);
        }
      } catch {
        console.warn("⚠️ [Dashboard] erreur lors du tour des KPIs");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 3. PARAMÈTRES — ONGLET PROFIL + MON TEMPLATE
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("03 — Paramètres : Profil et Nomenclature", async () => {
      try {
        await page.goto(`${BASE_URL}/parametres`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        await expect(page.getByText(/paramètres/i).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500);

        const profilTab = page.getByRole("tab", { name: /profil/i });
        const profilVisible = await profilTab.isVisible({ timeout: 5000 }).catch(() => false);
        if (profilVisible) {
          await profilTab.click();
          await page.waitForTimeout(1000);

          const siretInput = page.getByPlaceholder("123 456 789 00012");
          const siretVisible = await siretInput.isVisible().catch(() => false);
          if (siretVisible) {
            await siretInput.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1500);
          }
        } else {
          console.warn("⚠️ [Paramètres] onglet Profil non trouvé");
        }

        const templateTab = page.getByRole("tab", { name: /mon template/i });
        const templateVisible = await templateTab.isVisible({ timeout: 5000 }).catch(() => false);
        if (templateVisible) {
          await templateTab.click();
          await page.waitForTimeout(1000);

          const nomenclature = page.getByText(/nomenclature/i).first();
          const nomVisible = await nomenclature.isVisible().catch(() => false);
          if (nomVisible) {
            await nomenclature.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1500);
          } else {
            console.warn("⚠️ [Paramètres] section Nomenclature non trouvée");
          }
        } else {
          console.warn("⚠️ [Paramètres] onglet Mon template non trouvé");
        }
      } catch {
        console.warn("⚠️ [Paramètres] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 4. CLIENTS — LISTE + CRÉATION JEAN DUPONT
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("04 — Clients : liste et création nouveau client", async () => {
      try {
        await page.goto(`${BASE_URL}/clients`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        await expect(page.getByText(/clients/i).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500);

        const firstCard = page.locator(".forge-card").first();
        const cardVisible = await firstCard.isVisible({ timeout: 5000 }).catch(() => false);
        if (cardVisible) {
          await firstCard.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          await firstCard.click();
          await page.waitForTimeout(1500);

          const infoTab = page.getByRole("tab", { name: /informations/i });
          const infoVisible = await infoTab.isVisible({ timeout: 5000 }).catch(() => false);
          if (infoVisible) {
            await infoTab.click();
            await page.waitForTimeout(1000);
          }

          const chantiersTab = page.getByRole("tab", { name: /chantiers/i });
          const chantiersVisible = await chantiersTab.isVisible({ timeout: 5000 }).catch(() => false);
          if (chantiersVisible) {
            await chantiersTab.click();
            await page.waitForTimeout(1000);
          }

          const closeBtn = page.getByRole("button", { name: /fermer|×|close/i }).first();
          const closeVisible = await closeBtn.isVisible({ timeout: 3000 }).catch(() => false);
          if (closeVisible) {
            await closeBtn.click();
            await page.waitForTimeout(800);
          } else {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(800);
          }
        } else {
          console.warn("⚠️ [Clients] aucune fiche client existante");
        }

        const newClientBtn = page.getByRole("button", { name: /nouveau client/i });
        const newClientVisible = await newClientBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (!newClientVisible) {
          console.warn("⚠️ [Clients] bouton Nouveau client non trouvé — skip création");
          return;
        }

        await newClientBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await newClientBtn.click();
        await page.waitForTimeout(1500);

        const prenomInput = page.getByPlaceholder("Jean");
        const prenomVisible = await prenomInput.isVisible({ timeout: 5000 }).catch(() => false);
        if (!prenomVisible) {
          console.warn("⚠️ [Clients] formulaire Nouveau client non ouvert — skip");
          return;
        }

        await prenomInput.fill(NOUVEAU_CLIENT.prenom);
        await page.waitForTimeout(600);

        await page.getByPlaceholder("Dupont").fill(NOUVEAU_CLIENT.nom);
        await page.waitForTimeout(600);

        await page.getByPlaceholder("jean@email.com").fill(NOUVEAU_CLIENT.email);
        await page.waitForTimeout(600);

        await page.getByPlaceholder("06 12 34 56 78").fill(NOUVEAU_CLIENT.telephone);
        await page.waitForTimeout(600);

        // Adresse : getByLabel en premier, fallback getByPlaceholder
        try {
          const adresseLabel = page.getByLabel(/adresse/i).first();
          const adresseLabelVisible = await adresseLabel.isVisible({ timeout: 3000 }).catch(() => false);
          if (adresseLabelVisible) {
            await adresseLabel.fill(NOUVEAU_CLIENT.adresse);
          } else {
            const adressePh = page.getByPlaceholder(/rue|adresse/i).first();
            await adressePh.fill(NOUVEAU_CLIENT.adresse);
          }
          await page.waitForTimeout(600);
        } catch {
          console.warn("⚠️ [Clients] champ adresse non trouvé");
        }

        try {
          const cpLabel = page.getByLabel(/code postal/i).first();
          const cpLabelVisible = await cpLabel.isVisible({ timeout: 3000 }).catch(() => false);
          if (cpLabelVisible) {
            await cpLabel.fill(NOUVEAU_CLIENT.code_postal);
          } else {
            const cpPh = page.getByPlaceholder(/75|code/i).first();
            await cpPh.fill(NOUVEAU_CLIENT.code_postal);
          }
          await page.waitForTimeout(600);
        } catch {
          console.warn("⚠️ [Clients] champ code postal non trouvé");
        }

        try {
          const villeLabel = page.getByLabel(/ville/i).first();
          const villeLabelVisible = await villeLabel.isVisible({ timeout: 3000 }).catch(() => false);
          if (villeLabelVisible) {
            await villeLabel.fill(NOUVEAU_CLIENT.ville);
          } else {
            const villePh = page.getByPlaceholder(/paris|ville/i).first();
            await villePh.fill(NOUVEAU_CLIENT.ville);
          }
          await page.waitForTimeout(600);
        } catch {
          console.warn("⚠️ [Clients] champ ville non trouvé");
        }

        await page.waitForTimeout(1000);

        const enregistrerBtn = page.getByRole("button", { name: "Enregistrer" });
        const enregistrerVisible = await enregistrerBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (enregistrerVisible) {
          await enregistrerBtn.click();
          await page.waitForTimeout(3000);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [Clients] bouton Enregistrer non trouvé");
        }
      } catch {
        console.warn("⚠️ [Clients] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 5. CHANTIERS — KANBAN + CRÉATION CHANTIER DUPONT
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("05 — Chantiers : kanban, liste, nouveau chantier", async () => {
      try {
        await page.goto(`${BASE_URL}/chantiers`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        const kanbanTab = page.getByRole("tab", { name: /kanban/i });
        const kanbanVisible = await kanbanTab.isVisible({ timeout: 5000 }).catch(() => false);
        if (kanbanVisible) {
          await kanbanTab.click();
          await page.waitForTimeout(1000);

          for (const col of ["Prospect", "En cours", "Terminé"]) {
            const colEl = page.getByText(col).first();
            const colVisible = await colEl.isVisible().catch(() => false);
            if (colVisible) {
              await colEl.scrollIntoViewIfNeeded();
              await page.waitForTimeout(800);
            }
          }
        } else {
          console.warn("⚠️ [Chantiers] onglet Kanban non trouvé");
        }

        const listeTab = page.getByRole("tab", { name: /liste/i });
        const listeVisible = await listeTab.isVisible({ timeout: 5000 }).catch(() => false);
        if (listeVisible) {
          await listeTab.click();
          await page.waitForTimeout(1000);
        } else {
          console.warn("⚠️ [Chantiers] onglet Liste non trouvé");
        }

        const newBtn = page.getByRole("button", { name: /nouveau chantier/i });
        const newBtnVisible = await newBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (!newBtnVisible) {
          console.warn("⚠️ [Chantiers] bouton Nouveau chantier non trouvé — skip création");
          return;
        }

        await newBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await newBtn.click();
        await page.waitForTimeout(1500);

        // Champ nom du chantier
        const nomChantier = page.getByPlaceholder(/nom|chantier|titre/i).first();
        const nomVisible = await nomChantier.isVisible({ timeout: 5000 }).catch(() => false);
        if (nomVisible) {
          await nomChantier.fill(NOUVEAU_CHANTIER.nom);
          await page.waitForTimeout(600);
        } else {
          const nomLabel = page.getByLabel(/nom|chantier|titre/i).first();
          const nomLabelVisible = await nomLabel.isVisible({ timeout: 3000 }).catch(() => false);
          if (nomLabelVisible) {
            await nomLabel.fill(NOUVEAU_CHANTIER.nom);
            await page.waitForTimeout(600);
          } else {
            console.warn("⚠️ [Chantiers] champ nom du chantier non trouvé");
          }
        }

        // Sélection client Jean Dupont
        const clientSearch = page.getByPlaceholder(/client|rechercher/i).first();
        const clientSearchVisible = await clientSearch.isVisible({ timeout: 5000 }).catch(() => false);
        if (clientSearchVisible) {
          await clientSearch.fill("Jean Dupont");
          await page.waitForTimeout(1000);
          const clientOption = page.getByText(/Jean Dupont/i).first();
          const clientOptionVisible = await clientOption.isVisible({ timeout: 3000 }).catch(() => false);
          if (clientOptionVisible) {
            await clientOption.click();
            await page.waitForTimeout(600);
          }
        } else {
          console.warn("⚠️ [Chantiers] champ client non trouvé");
        }

        await page.waitForTimeout(1000);

        const submitChantier = page.getByRole("button", { name: /créer|enregistrer|valider/i }).last();
        const submitVisible = await submitChantier.isVisible({ timeout: 5000 }).catch(() => false);
        if (submitVisible) {
          await submitChantier.click();
          await page.waitForTimeout(3000);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [Chantiers] bouton de soumission non trouvé");
        }
      } catch {
        console.warn("⚠️ [Chantiers] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 6. DEVIS — CRÉATION 2 LIGNES + APERÇU PDF
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("06 — Devis : création avec 2 lignes et aperçu PDF", async () => {
      try {
        await page.goto(`${BASE_URL}/devis`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        // Parcourir les onglets (Documents.tsx : Devis, Avenants, TS, Factures, Avoirs)
        for (const [tabPattern, tabLabel] of [
          [/devis/i, "Devis"], [/avenants/i, "Avenants"], [/^ts$/i, "TS"],
          [/factures/i, "Factures"], [/avoirs/i, "Avoirs"],
        ] as [RegExp, string][]) {
          const tab = page.getByRole("tab", { name: tabPattern });
          const visible = await tab.isVisible({ timeout: 5000 }).catch(() => false);
          if (visible) {
            await tab.click();
            await page.waitForTimeout(1000);
          } else {
            console.warn(`⚠️ [Devis] onglet ${tabLabel} non trouvé`);
          }
        }

        // Revenir sur l'onglet Devis avant de créer
        const devisTab = page.getByRole("tab", { name: /devis/i });
        const devisTabVisible = await devisTab.isVisible().catch(() => false);
        if (devisTabVisible) {
          await devisTab.click();
          await page.waitForTimeout(1000);
        }

        const newDevisBtn = page.getByRole("button", { name: /nouveau devis|créer un devis/i });
        const newDevisVisible = await newDevisBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (!newDevisVisible) {
          console.warn("⚠️ [Devis] bouton Nouveau devis non trouvé — skip création");
          return;
        }

        await newDevisBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await newDevisBtn.click();
        await page.waitForTimeout(1500);

        // Sélection client Jean Dupont
        const clientInput = page.getByPlaceholder("Rechercher un client...");
        const clientInputVisible = await clientInput.isVisible({ timeout: 5000 }).catch(() => false);
        if (clientInputVisible) {
          await clientInput.fill("Jean Dupont");
          await page.waitForTimeout(1000);
          const clientOption = page.getByText(/Jean Dupont/i).first();
          const clientOptionVisible = await clientOption.isVisible({ timeout: 3000 }).catch(() => false);
          if (clientOptionVisible) {
            await clientOption.click();
            await page.waitForTimeout(800);
          } else {
            console.warn("⚠️ [Devis] client Jean Dupont non trouvé dans la liste");
          }
        } else {
          console.warn("⚠️ [Devis] champ recherche client non trouvé");
        }

        // Ligne 1
        const desig0 = page.getByPlaceholder("Désignation").nth(0);
        const desig0Visible = await desig0.isVisible({ timeout: 5000 }).catch(() => false);
        if (desig0Visible) {
          await desig0.fill(NOUVEAU_DEVIS.lignes[0].designation);
          await page.waitForTimeout(500);
          await page.getByPlaceholder("Qté").nth(0).fill(NOUVEAU_DEVIS.lignes[0].quantite);
          await page.waitForTimeout(400);
          await page.getByPlaceholder("P.U.").nth(0).fill(NOUVEAU_DEVIS.lignes[0].pu);
          await page.waitForTimeout(400);
        } else {
          console.warn("⚠️ [Devis] champ Désignation (ligne 1) non trouvé");
        }

        // Ajout ligne 2
        const ajouterBtn = page.getByRole("button", { name: /ajouter une ligne/i });
        const ajouterVisible = await ajouterBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (ajouterVisible) {
          await ajouterBtn.click();
          await page.waitForTimeout(800);

          const desig1 = page.getByPlaceholder("Désignation").nth(1);
          const desig1Visible = await desig1.isVisible({ timeout: 3000 }).catch(() => false);
          if (desig1Visible) {
            await desig1.fill(NOUVEAU_DEVIS.lignes[1].designation);
            await page.waitForTimeout(500);
            await page.getByPlaceholder("Qté").nth(1).fill(NOUVEAU_DEVIS.lignes[1].quantite);
            await page.waitForTimeout(400);
            await page.getByPlaceholder("P.U.").nth(1).fill(NOUVEAU_DEVIS.lignes[1].pu);
            await page.waitForTimeout(400);
          } else {
            console.warn("⚠️ [Devis] champ Désignation (ligne 2) non trouvé après ajout");
          }
        } else {
          console.warn("⚠️ [Devis] bouton Ajouter une ligne non trouvé");
        }

        await page.waitForTimeout(1000);

        // Soumettre
        const creerBtn = page.getByRole("button", { name: "Créer le devis" });
        const creerVisible = await creerBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (creerVisible) {
          await creerBtn.click();
          await page.waitForTimeout(3000);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(2000);
        } else {
          console.warn("⚠️ [Devis] bouton Créer le devis non trouvé");
          return;
        }

        // Aperçu PDF sur la card créée
        const pdfBtn = page.getByRole("button", { name: /pdf|aperçu/i }).first();
        const pdfBtnVisible = await pdfBtn.isVisible({ timeout: 8000 }).catch(() => false);
        if (pdfBtnVisible) {
          await pdfBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await pdfBtn.click();
          await page.waitForTimeout(3000);

          // Fermer le modal PDF si présent
          const closeModal = page.getByRole("button", { name: /fermer|×|close/i }).first();
          const closeVisible = await closeModal.isVisible({ timeout: 3000 }).catch(() => false);
          if (closeVisible) {
            await closeModal.click();
            await page.waitForTimeout(800);
          } else {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(800);
          }
        } else {
          console.warn("⚠️ [Devis] bouton PDF non trouvé après création");
        }
      } catch {
        console.warn("⚠️ [Devis] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 7. MESSAGERIE — ONGLETS + HOVER NOUVEAU MESSAGE
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("07 — Messagerie : Envoyés, Reçus, Brouillons", async () => {
      try {
        await page.goto(`${BASE_URL}/messagerie`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        await expect(page.getByText("Messagerie").first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500);

        for (const tabName of ["Envoyés", "Reçus", "Brouillons"]) {
          const tab = page.getByRole("button", { name: new RegExp(tabName, "i") });
          const visible = await tab.isVisible({ timeout: 5000 }).catch(() => false);
          if (visible) {
            await tab.click();
            await page.waitForTimeout(1000);
          } else {
            console.warn(`⚠️ [Messagerie] onglet ${tabName} non trouvé`);
          }
        }

        const newMsgBtn = page.getByRole("button", { name: /nouveau message/i });
        const newMsgVisible = await newMsgBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (newMsgVisible) {
          await newMsgBtn.scrollIntoViewIfNeeded();
          await newMsgBtn.hover();
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [Messagerie] bouton Nouveau message non trouvé");
        }
      } catch {
        console.warn("⚠️ [Messagerie] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 8. FINANCES — ONGLETS (skip Achats)
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("08 — Finances : Par chantier, Trésorerie, Impayés", async () => {
      try {
        await page.goto(`${BASE_URL}/finances`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        await expect(page.getByText(/suivi financier/i).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500);

        for (const tabName of ["Par chantier", "Trésorerie", "Impayés"]) {
          const tab = page.getByRole("tab", { name: new RegExp(tabName, "i") });
          const visible = await tab.isVisible({ timeout: 5000 }).catch(() => false);
          if (visible) {
            await tab.click();
            await page.waitForTimeout(1000);
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
            await page.waitForTimeout(800);
          } else {
            console.warn(`⚠️ [Finances] onglet ${tabName} non trouvé`);
          }
        }
      } catch {
        console.warn("⚠️ [Finances] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 9. ASSISTANT — ALFRED CHAT
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("09 — Assistant : chat Alfred", async () => {
      try {
        await page.goto(`${BASE_URL}/assistant`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        const alfredTab = page.getByRole("tab", { name: /alfred/i });
        const alfredVisible = await alfredTab.isVisible({ timeout: 10_000 }).catch(() => false);
        if (alfredVisible) {
          await alfredTab.click();
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [Assistant] onglet Alfred non trouvé");
        }

        const chatInput = page.getByPlaceholder("Posez votre question…");
        const inputVisible = await chatInput.isVisible({ timeout: 10_000 }).catch(() => false);
        if (inputVisible) {
          await chatInput.click();
          await page.waitForTimeout(500);

          const message = "Bonjour Alfred, montre-moi tes capacités";
          for (const char of message) {
            await chatInput.type(char);
            await page.waitForTimeout(50);
          }
          await page.waitForTimeout(800);

          const submitBtn = page.locator("form").locator('button[type="submit"]');
          const submitVisible = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);
          if (submitVisible) {
            await submitBtn.click();
            await page.waitForTimeout(15_000);
          } else {
            console.warn("⚠️ [Assistant] bouton envoi non trouvé");
          }
        } else {
          console.warn("⚠️ [Assistant] input chat non trouvé");
        }
      } catch {
        console.warn("⚠️ [Assistant] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 10. MES DOCUMENTS — LISTE + HOVER AJOUTER
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("10 — MesDocuments : liste et upload", async () => {
      try {
        await page.goto(`${BASE_URL}/mes-documents`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

        await expect(page.getByText(/mes documents/i).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1500);

        const firstDoc = page.locator(".forge-card").first();
        const docVisible = await firstDoc.isVisible({ timeout: 5000 }).catch(() => false);
        if (docVisible) {
          await firstDoc.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [MesDocuments] aucun document trouvé — bibliothèque peut-être vide");
        }

        const addBtn = page.getByRole("button", { name: /ajouter/i });
        const addVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (addVisible) {
          await addBtn.scrollIntoViewIfNeeded();
          await addBtn.hover();
          await page.waitForTimeout(1500);
        } else {
          console.warn("⚠️ [MesDocuments] bouton Ajouter non trouvé");
        }
      } catch {
        console.warn("⚠️ [MesDocuments] erreur lors du tour");
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 11. DÉCONNEXION
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("11 — Déconnexion", async () => {
      try {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await page.waitForTimeout(1000);

        const logoutBtn = page.getByRole("button", { name: /déconnexion|se déconnecter|quitter/i });
        const logoutVisible = await logoutBtn.isVisible({ timeout: 10_000 }).catch(() => false);
        if (logoutVisible) {
          await logoutBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          await logoutBtn.click();
          await page.waitForURL(`${BASE_URL}/auth`, { timeout: 15_000 });
          await page.waitForTimeout(2000);
        } else {
          console.warn("⚠️ [Déconnexion] bouton logout non trouvé — tentative via goto /auth");
          await page.goto(`${BASE_URL}/auth`);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(2000);
        }
      } catch {
        console.warn("⚠️ [Déconnexion] erreur lors de la déconnexion");
      }
    });

    console.log("\n🎬 Tour artisan terminé — vidéo disponible dans playwright-report/");
  });
});
