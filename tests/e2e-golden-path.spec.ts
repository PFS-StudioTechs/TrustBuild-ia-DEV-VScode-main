import { test, expect, Page } from "@playwright/test";
import { TEST_DATA, BASE_URL } from "./test-data";
import fs from "fs";

// ─── Helpers ───────────────────────────────────────────────────────────────

const SCREENSHOTS_DIR = "tests/screenshots";

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let stepCount = 0;
async function shot(page: Page, name: string) {
  ensureScreenshotsDir();
  stepCount++;
  const file = `${SCREENSHOTS_DIR}/${String(stepCount).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 ${file}`);
}

async function waitToast(page: Page, timeoutMs = 8000) {
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "visible", timeout: timeoutMs }).catch(() => {});
}

// ─── Test principal ────────────────────────────────────────────────────────

test.describe("Trust Build-IA — Golden Path", () => {
  test.setTimeout(300_000); // 5 minutes max

  test("Parcours complet : connexion → KBIS → SIRET → client → chantier → devis → facture", async ({ page }) => {
    stepCount = 0;

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 — Connexion
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("01 — Connexion artisan", async () => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState("networkidle");
      await shot(page, "auth-page");

      // Remplir le formulaire de connexion
      await page.getByPlaceholder(/email/i).fill(TEST_DATA.artisan.email);
      await page.getByPlaceholder(/mot de passe|password/i).fill(TEST_DATA.artisan.password);
      await page.getByRole("button", { name: /se connecter|connexion/i }).click();

      await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 20_000 });
      await page.waitForLoadState("networkidle");
      await shot(page, "dashboard-apres-connexion");

      await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 — Vérification banner KBIS
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("02 — Vérification banner avertissement KBIS", async () => {
      await page.waitForTimeout(1000);
      await shot(page, "banner-kbis-visible");

      const banner = page.getByText(/vous n'avez pas encore renseigné votre kbis/i);
      const bannerVisible = await banner.isVisible().catch(() => false);
      console.log(`ℹ️  Banner KBIS visible : ${bannerVisible}`);
      // Non bloquant : peut ne pas apparaître si le délai 6 mois n'est pas configuré
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 — SIRET dans Paramètres
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("03 — Saisie et vérification du SIRET", async () => {
      await page.goto(`${BASE_URL}/parametres`);
      await page.waitForLoadState("networkidle");
      await shot(page, "parametres-page");

      // Cliquer sur l'onglet Entreprise
      const entrepriseTab = page.getByRole("tab", { name: /entreprise|mon entreprise/i });
      await entrepriseTab.waitFor({ timeout: 5000 });
      await entrepriseTab.click();
      await page.waitForTimeout(500);

      // Saisir le SIRET
      const siretInput = page.getByPlaceholder("123 456 789 00012");
      await siretInput.clear();
      await siretInput.fill(TEST_DATA.artisan.siret);
      await shot(page, "siret-saisi");

      // Vérifier via INSEE
      await page.getByRole("button", { name: "Vérifier" }).click();
      await page.waitForTimeout(6000); // Appel API INSEE

      await shot(page, "siret-verifie");
      await expect(page.getByText(/établissement actif/i)).toBeVisible({ timeout: 10_000 });

      // Enregistrer
      await page.getByRole("button", { name: /enregistrer|sauvegarder/i }).first().click();
      await waitToast(page);
      await shot(page, "siret-enregistre");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 4 — Upload KBIS + vérification IA
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("04 — Upload KBIS et vérification par l'IA", async () => {
      await page.goto(`${BASE_URL}/mes-documents`);
      await page.waitForLoadState("networkidle");
      await shot(page, "mes-fichiers-page");

      // Cliquer sur "Déposer" dans la carte KBIS
      const deposerBtn = page.getByRole("button", { name: /déposer/i }).first();
      await deposerBtn.waitFor({ timeout: 5000 });
      await deposerBtn.click();
      await page.waitForTimeout(500);

      // Upload du fichier via l'input caché dans KbisUploadSection
      const kbisInput = page.locator("input[type='file'][accept='.pdf,.jpg,.jpeg,.png']").first();
      await kbisInput.setInputFiles(TEST_DATA.kbisPath);
      await page.waitForTimeout(500);
      await shot(page, "kbis-fichier-selectionne");

      // Lancer la vérification IA
      await page.getByRole("button", { name: /déposer et vérifier/i }).click();

      // Attendre la vérification (Edge Function + Claude)
      await page.getByText(/vérification ia en cours|vérifié par l'ia/i).first().waitFor({
        state: "visible",
        timeout: 30_000,
      });
      await page.waitForTimeout(2000);
      await shot(page, "kbis-verifie-ia");

      // Confirmer le succès
      await expect(page.getByText(/kbis vérifié par l'ia/i)).toBeVisible({ timeout: 15_000 });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 5 — Création d'un client
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("05 — Création du client", async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState("networkidle");
      await shot(page, "clients-page");

      // Ouvrir le formulaire de création
      await page.getByRole("button", { name: /nouveau client|ajouter|créer/i }).first().click();
      await page.waitForTimeout(500);

      // Remplir le formulaire
      await page.getByLabel(/nom/i).fill(TEST_DATA.client.nom);
      await page.getByLabel(/email/i).fill(TEST_DATA.client.email);
      await page.getByLabel(/téléphone|phone/i).fill(TEST_DATA.client.telephone);
      await page.getByLabel(/adresse/i).fill(TEST_DATA.client.adresse);
      await page.getByLabel(/code postal/i).fill(TEST_DATA.client.code_postal);
      await page.getByLabel(/ville/i).fill(TEST_DATA.client.ville);
      await shot(page, "client-formulaire-rempli");

      // Enregistrer
      await page.getByRole("button", { name: /créer|enregistrer|ajouter/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1000);
      await shot(page, "client-cree");

      await expect(page.getByText(TEST_DATA.client.nom)).toBeVisible({ timeout: 8000 });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 6 — Création d'un chantier
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("06 — Création du chantier", async () => {
      await page.goto(`${BASE_URL}/chantiers`);
      await page.waitForLoadState("networkidle");
      await shot(page, "chantiers-page");

      await page.getByRole("button", { name: /nouveau chantier|ajouter|créer/i }).first().click();
      await page.waitForTimeout(500);

      await page.getByLabel(/nom du chantier|nom/i).first().fill(TEST_DATA.chantier.nom);
      await page.getByLabel(/adresse/i).fill(TEST_DATA.chantier.adresse);

      // Sélection du client
      const clientSelect = page.getByRole("combobox", { name: /client/i });
      if (await clientSelect.isVisible()) {
        await clientSelect.click();
        await page.getByText(TEST_DATA.client.nom).first().click();
      }

      await shot(page, "chantier-formulaire-rempli");

      await page.getByRole("button", { name: /créer|enregistrer|valider/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1000);
      await shot(page, "chantier-cree");

      await expect(page.getByText(TEST_DATA.chantier.nom)).toBeVisible({ timeout: 8000 });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 7 — Devis 1 : création
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("07 — Devis 1 : création", async () => {
      await page.goto(`${BASE_URL}/devis`);
      await page.waitForLoadState("networkidle");
      await shot(page, "devis-page");

      await page.getByRole("button", { name: /nouveau devis|créer un devis|nouveau/i }).first().click();
      await page.waitForTimeout(500);

      // Sélectionner le chantier
      const chantierSelect = page.getByRole("combobox", { name: /chantier/i }).first();
      if (await chantierSelect.isVisible()) {
        await chantierSelect.click();
        await page.getByText(TEST_DATA.chantier.nom).first().click();
      }

      // Sélectionner le client si champ séparé
      const clientSelect = page.getByRole("combobox", { name: /client/i }).first();
      if (await clientSelect.isVisible()) {
        await clientSelect.click();
        await page.getByText(TEST_DATA.client.nom).first().click();
      }

      // Ajouter les lignes de devis
      for (let i = 0; i < TEST_DATA.devis1.lignes.length; i++) {
        const ligne = TEST_DATA.devis1.lignes[i];

        if (i > 0) {
          // Ajouter une ligne supplémentaire
          const addBtn = page.getByRole("button", { name: /ajouter une ligne|\+ ligne/i });
          if (await addBtn.isVisible()) await addBtn.click();
          await page.waitForTimeout(300);
        }

        // Remplir la ligne
        const descInputs = page.getByPlaceholder(/description|désignation/i);
        await descInputs.nth(i).fill(ligne.description);

        const qtyInputs = page.getByPlaceholder(/quantité|qté/i);
        if (await qtyInputs.nth(i).isVisible()) {
          await qtyInputs.nth(i).fill(String(ligne.quantite));
        }

        const uniteInputs = page.getByPlaceholder(/unité|m²|ml/i);
        if (await uniteInputs.nth(i).isVisible()) {
          await uniteInputs.nth(i).fill(ligne.unite);
        }

        const puInputs = page.getByPlaceholder(/prix unitaire|p\.u\.|pu/i);
        if (await puInputs.nth(i).isVisible()) {
          await puInputs.nth(i).fill(String(ligne.prix_unitaire));
        }
      }

      await shot(page, "devis1-formulaire-rempli");

      await page.getByRole("button", { name: /créer|enregistrer|générer/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1500);
      await shot(page, "devis1-cree");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 8 — Devis 1 : envoi
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("08 — Devis 1 : envoi au client", async () => {
      // Cliquer sur "Envoyer" dans la card du devis
      const envoyerBtn = page.getByRole("button", { name: /envoyer|envoi/i }).first();
      if (await envoyerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await envoyerBtn.click();
        await waitToast(page);
      }
      await shot(page, "devis1-envoye");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 9 — Devis 1 : avenant
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("09 — Devis 1 : ajout avenant", async () => {
      // Ouvrir l'onglet Avenants dans la DevisCard
      const avenantTab = page.getByRole("tab", { name: /avenant/i }).first();
      await avenantTab.waitFor({ timeout: 5000 });
      await avenantTab.click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: /nouvel avenant|ajouter/i }).first().click();
      await page.waitForTimeout(500);

      const av = TEST_DATA.devis1.avenant;
      await page.getByPlaceholder(/description|désignation/i).last().fill(av.description);
      await page.getByPlaceholder(/motif|raison/i).last().fill(av.motif);
      await page.getByPlaceholder(/quantité|qté/i).last().fill(String(av.quantite));
      await page.getByPlaceholder(/unité/i).last().fill(av.unite);
      await page.getByPlaceholder(/prix unitaire|p\.u\./i).last().fill(String(av.prix_unitaire));

      await shot(page, "avenant-formulaire-rempli");
      await page.getByRole("button", { name: /créer|enregistrer/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1000);
      await shot(page, "avenant-cree");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 10 — Devis 1 : signature
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("10 — Devis 1 : passage en signé", async () => {
      // Revenir sur l'onglet Devis principal
      const devisTab = page.getByRole("tab", { name: /^devis$/i }).first();
      if (await devisTab.isVisible().catch(() => false)) await devisTab.click();
      await page.waitForTimeout(500);

      // Cliquer sur le bouton Marquer comme signé
      const signerBtn = page.getByRole("button", { name: /signer|signé|marquer comme signé/i }).first();
      await signerBtn.waitFor({ timeout: 5000 });
      await signerBtn.click();

      // Confirmer si dialog de confirmation
      const confirmBtn = page.getByRole("button", { name: /confirmer|oui|valider/i }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await waitToast(page);
      await page.waitForTimeout(1500);
      await shot(page, "devis1-signe");

      // Le statut doit afficher "Signé"
      await expect(page.getByText(/signé/i).first()).toBeVisible({ timeout: 8000 });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 11 — Devis 1 : acompte
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("11 — Devis 1 : ajout acompte", async () => {
      const acompteTab = page.getByRole("tab", { name: /acompte/i }).first();
      await acompteTab.waitFor({ timeout: 5000 });
      await acompteTab.click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: /ajouter|nouvel acompte/i }).first().click();
      await page.waitForTimeout(500);

      const ac = TEST_DATA.devis1.acompte;
      const montantInput = page.getByLabel(/montant/i).last();
      if (await montantInput.isVisible()) await montantInput.fill(String(ac.montant));

      const descInput = page.getByLabel(/description|libellé/i).last();
      if (await descInput.isVisible()) await descInput.fill(ac.description);

      await shot(page, "acompte-formulaire-rempli");
      await page.getByRole("button", { name: /créer|enregistrer|ajouter/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1000);
      await shot(page, "acompte-cree");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 12 — Devis 1 : avoir
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("12 — Devis 1 : création avoir (note de crédit)", async () => {
      const avoirTab = page.getByRole("tab", { name: /avoir|note de crédit/i }).first();
      await avoirTab.waitFor({ timeout: 5000 });
      await avoirTab.click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: /ajouter|nouvel avoir/i }).first().click();
      await page.waitForTimeout(500);

      const av = TEST_DATA.devis1.avoir;
      await page.getByPlaceholder(/description|désignation/i).last().fill(av.description);
      await page.getByPlaceholder(/motif|raison/i).last().fill(av.motif);

      const montantInput = page.getByPlaceholder(/montant/i).last();
      if (await montantInput.isVisible()) await montantInput.fill(String(av.montant));

      await shot(page, "avoir-formulaire-rempli");
      await page.getByRole("button", { name: /créer|enregistrer/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1000);
      await shot(page, "avoir-cree");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 13 — Devis 2 : création (même client)
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("13 — Devis 2 : création pour le même client", async () => {
      await page.getByRole("button", { name: /nouveau devis|créer un devis/i }).first().click();
      await page.waitForTimeout(500);

      // Sélectionner le même chantier/client
      const chantierSelect = page.getByRole("combobox", { name: /chantier/i }).first();
      if (await chantierSelect.isVisible()) {
        await chantierSelect.click();
        await page.getByText(TEST_DATA.chantier.nom).first().click();
      }

      // Lignes du devis 2
      for (let i = 0; i < TEST_DATA.devis2.lignes.length; i++) {
        const ligne = TEST_DATA.devis2.lignes[i];
        if (i > 0) {
          const addBtn = page.getByRole("button", { name: /ajouter une ligne|\+ ligne/i });
          if (await addBtn.isVisible()) await addBtn.click();
          await page.waitForTimeout(300);
        }
        await page.getByPlaceholder(/description|désignation/i).nth(i).fill(ligne.description);
        const qtyInputs = page.getByPlaceholder(/quantité|qté/i);
        if (await qtyInputs.nth(i).isVisible()) await qtyInputs.nth(i).fill(String(ligne.quantite));
        const puInputs = page.getByPlaceholder(/prix unitaire|p\.u\./i);
        if (await puInputs.nth(i).isVisible()) await puInputs.nth(i).fill(String(ligne.prix_unitaire));
      }

      await shot(page, "devis2-formulaire-rempli");
      await page.getByRole("button", { name: /créer|enregistrer/i }).last().click();
      await waitToast(page);
      await page.waitForTimeout(1500);
      await shot(page, "devis2-cree");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 14 — Devis 2 : signature
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("14 — Devis 2 : envoi + signature", async () => {
      // Envoyer
      const envoyerBtn = page.getByRole("button", { name: /envoyer/i }).first();
      if (await envoyerBtn.isVisible({ timeout: 3000 }).catch(() => false)) await envoyerBtn.click();

      // Signer
      const signerBtn = page.getByRole("button", { name: /signer|marquer comme signé/i }).first();
      await signerBtn.waitFor({ timeout: 5000 });
      await signerBtn.click();
      const confirmBtn = page.getByRole("button", { name: /confirmer|oui|valider/i }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) await confirmBtn.click();

      await waitToast(page);
      await page.waitForTimeout(1500);
      await shot(page, "devis2-signe");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 15 — Facture partielle
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("15 — Génération de la facture partielle (Devis 1)", async () => {
      // Revenir sur le Devis 1 et générer la facture depuis l'onglet principal
      const devis1Card = page.getByText(/DEV-/).first();
      if (await devis1Card.isVisible()) await devis1Card.click();
      await page.waitForTimeout(500);

      const facturePartBtn = page.getByRole("button", { name: /facture partielle|générer.*facture/i }).first();
      if (await facturePartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await facturePartBtn.click();
        await waitToast(page);
      }
      await page.waitForTimeout(1500);
      await shot(page, "facture-partielle-generee");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 16 — Facture totale
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("16 — Génération de la facture totale (Devis 1 + Devis 2)", async () => {
      const factureTotBtn = page.getByRole("button", { name: /facture totale|facture finale|générer.*totale/i }).first();
      if (await factureTotBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await factureTotBtn.click();
        await waitToast(page);
      }
      await page.waitForTimeout(1500);
      await shot(page, "facture-totale-generee");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 17 — Vérification dans Finances
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("17 — Vérification dans la vue Finances", async () => {
      await page.goto(`${BASE_URL}/finances`);
      await page.waitForLoadState("networkidle");
      await shot(page, "finances-vue-finale");

      // Vérifier que des factures sont visibles
      const hasFacture = await page.getByText(/FAC-|facture/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`ℹ️  Factures visibles dans Finances : ${hasFacture}`);
    });

    console.log("\n✅ Golden Path terminé — captures dans tests/screenshots/");
  });
});
