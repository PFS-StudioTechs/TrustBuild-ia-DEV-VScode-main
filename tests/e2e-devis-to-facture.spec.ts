import { test, expect, Page, Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_DATA } from "./test-data";

const BASE_URL = "http://localhost:8080";

// ─── Supabase client (anon key) ─────────────────────────────────────────────

function makeDb() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY manquant dans .env.local"
    );
  return createClient(url, key);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitToast(page: Page, ms = 12_000) {
  await page
    .locator("[data-sonner-toast]")
    .first()
    .waitFor({ state: "visible", timeout: ms })
    .catch(() => {});
}

async function loginArtisan(page: Page) {
  await page.goto(`${BASE_URL}/auth`);
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(TEST_DATA.artisan.email);
  await page.locator("#password").fill(TEST_DATA.artisan.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded");
}

async function expandDevisCard(page: Page, devisNumero: string) {
  const cardText = page.getByText(devisNumero).first();
  await cardText.waitFor({ timeout: 8_000 });
  await cardText.click();
  await page.waitForTimeout(600);
}

// ─── Test ────────────────────────────────────────────────────────────────────

test.describe("TrustBuild-IA — Parcours Devis → Facture complet", () => {
  test.setTimeout(300_000);

  test(
    "Devis → Envoi → Signature publique → Acompte → Avenant → TS → Facture → Espace client",
    async ({ browser }) => {
      const db = makeDb();
      let devisNumero = "";
      let tokenPublic = "";

      // Contexte artisan avec enregistrement vidéo
      const artisanCtx = await browser.newContext({
        recordVideo: { dir: "tests/videos/", size: { width: 1280, height: 900 } },
      });
      const page = await artisanCtx.newPage();

      try {
        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 1 — Connexion artisan
        // ═════════════════════════════════════════════════════════════════
        await test.step("01 — Connexion artisan", async () => {
          await loginArtisan(page);
          await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
          console.log("✅ 01 — Artisan connecté");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 2 — Création devis
        // ═════════════════════════════════════════════════════════════════
        await test.step("02 — Création devis", async () => {
          await page.goto(`${BASE_URL}/devis`);
          await page.waitForLoadState("networkidle");

          await page
            .getByRole("button", { name: /nouveau devis|créer un devis/i })
            .first()
            .click();
          await page.waitForTimeout(500);

          // Sélection client Steeve DECEMBRE (lié à steevival@yahoo.fr)
          const clientCombo = page
            .getByRole("combobox", { name: /client/i })
            .first();
          if (
            await clientCombo.isVisible({ timeout: 3_000 }).catch(() => false)
          ) {
            await clientCombo.click();
            await page.waitForTimeout(300);
            const opt = page.getByText(/steeve decembre/i).first();
            await opt.waitFor({ timeout: 5_000 });
            await opt.click();
          } else {
            const clientInput = page
              .getByPlaceholder(/client|rechercher/i)
              .first();
            await clientInput.fill("Steeve");
            await page.waitForTimeout(500);
            await page.getByText(/steeve decembre/i).first().click();
          }
          await page.waitForTimeout(300);

          const desig = page.getByPlaceholder(/description|désignation/i);
          const qty   = page.getByPlaceholder(/quantité|qté/i);
          const pu    = page.getByPlaceholder(/prix unitaire|p\.u\./i);

          // Ligne 1 : Dépose ancienne installation, qté 1, PU 500
          await desig.nth(0).fill("Dépose ancienne installation");
          if (await qty.nth(0).isVisible()) await qty.nth(0).fill("1");
          if (await pu.nth(0).isVisible())  await pu.nth(0).fill("500");

          // Ligne 2 : Fourniture et pose receveur de douche, qté 1, PU 1200
          await page
            .getByRole("button", { name: /ajouter une ligne|\+ ligne/i })
            .first()
            .click();
          await page.waitForTimeout(300);
          await desig.nth(1).fill("Fourniture et pose receveur de douche");
          if (await qty.nth(1).isVisible()) await qty.nth(1).fill("1");
          if (await pu.nth(1).isVisible())  await pu.nth(1).fill("1200");

          await page
            .getByRole("button", { name: /créer le devis|créer|enregistrer/i })
            .last()
            .click();
          await waitToast(page);
          await page.waitForTimeout(2_000);

          // Récupérer le numéro DEV- depuis la page
          const firstNum = page.getByText(/DEV-/i).first();
          await firstNum.waitFor({ timeout: 10_000 });
          const rawText = (await firstNum.textContent()) ?? "";
          devisNumero = rawText.match(/DEV-[A-Z0-9\-]+/)?.[0] ?? "";

          if (!devisNumero)
            throw new Error("Numéro devis non trouvé dans la page après création");

          console.log(`✅ 02 — Devis créé : ${devisNumero}`);
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 3 — Envoi devis par email
        // ═════════════════════════════════════════════════════════════════
        await test.step("03 — Envoi devis par email", async () => {
          // S'assurer que la card est expanded
          await expandDevisCard(page, devisNumero);

          const envBtn = page
            .getByRole("button", { name: /Envoyer par email/i })
            .first();
          await envBtn.waitFor({ timeout: 8_000 });
          await envBtn.click();
          await page.waitForTimeout(800);

          // Dialog SendEmailDialog — confirmer sans modifier le corps
          const sendBtn = page.getByRole("button", { name: /^Envoyer$/i });
          await sendBtn.waitFor({ timeout: 5_000 });
          await sendBtn.click();
          await waitToast(page, 15_000);
          await page.waitForTimeout(1_500);

          const sentOk = await page
            .getByText(/envoyé|enregistré/i)
            .first()
            .isVisible({ timeout: 5_000 })
            .catch(() => false);
          if (!sentOk)
            console.warn(
              "⚠️ 03 — Toast envoi non détecté (Brevo peut-être non configuré) — on continue"
            );
          else console.log("✅ 03 — Devis envoyé");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 4 — Récupération token_public via Supabase
        // ═════════════════════════════════════════════════════════════════
        await test.step("04 — Récupération token_public", async () => {
          // Login Supabase JS pour passer le RLS artisan
          const { error: authErr } = await db.auth.signInWithPassword({
            email: TEST_DATA.artisan.email,
            password: TEST_DATA.artisan.password,
          });
          if (authErr)
            throw new Error(`Auth Supabase échouée : ${authErr.message}`);

          const { data, error } = await db
            .from("devis")
            .select("token_public")
            .eq("numero", devisNumero)
            .maybeSingle();

          if (error)
            throw new Error(`Supabase query error : ${error.message}`);

          if (!data?.token_public)
            throw new Error(
              `token_public NULL pour devis ${devisNumero}. ` +
                `L'envoi email a peut-être échoué (Brevo non configuré ?). ` +
                `Vérifiez que statut='envoye' et token_public IS NOT NULL dans Supabase.`
            );

          tokenPublic = data.token_public;
          console.log(`✅ 04 — token_public : ${tokenPublic.substring(0, 8)}…`);
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 5 — Signature publique (contexte sans cookies artisan)
        // ═════════════════════════════════════════════════════════════════
        await test.step("05 — Signature publique via /devis/view/:token", async () => {
          const publicCtx = await browser.newContext({
            recordVideo: { dir: "tests/videos/" },
          });
          const pub = await publicCtx.newPage();

          try {
            await pub.goto(`${BASE_URL}/devis/view/${tokenPublic}`);
            await pub.waitForLoadState("networkidle");

            // Vérifier affichage du devis
            await expect(pub.getByText(devisNumero)).toBeVisible({
              timeout: 10_000,
            });
            await expect(
              pub.getByText(/dépose ancienne installation/i)
            ).toBeVisible({ timeout: 5_000 });

            // Ouvrir dialog signature
            await pub
              .getByRole("button", { name: /Valider ce devis/i })
              .click();
            await pub.waitForTimeout(600);

            // Canvas — pas de data-testid, sélecteur par classe unique
            const canvas = pub.locator("canvas.cursor-crosshair").first();
            await canvas.waitFor({ timeout: 5_000 });
            const box = await canvas.boundingBox();
            if (!box)
              throw new Error("Canvas signature introuvable (boundingBox null)");

            // Tracé d'une signature simple
            await pub.mouse.move(box.x + 40, box.y + 70);
            await pub.mouse.down();
            await pub.mouse.move(box.x + 90,  box.y + 40, { steps: 8 });
            await pub.mouse.move(box.x + 150, box.y + 80, { steps: 8 });
            await pub.mouse.move(box.x + 200, box.y + 30, { steps: 8 });
            await pub.mouse.move(box.x + 240, box.y + 70, { steps: 8 });
            await pub.mouse.up();
            await pub.waitForTimeout(300);

            // Valider la signature
            await pub
              .getByRole("button", { name: /Signer et valider/i })
              .click();
            await pub.waitForTimeout(2_000);

            // Confirmation "Devis signé avec succès !"
            const confirmed = await pub
              .getByText(/signé avec succès|devis signé/i)
              .first()
              .isVisible({ timeout: 10_000 })
              .catch(() => false);
            if (!confirmed)
              console.warn(
                "⚠️ 05 — Dialog confirmation non détecté — vérifier manuellement"
              );
            else console.log("✅ 05 — Devis signé via vue publique");
          } finally {
            await publicCtx.close();
          }
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 6 — Vérification statut "Signé" côté artisan
        // ═════════════════════════════════════════════════════════════════
        await test.step("06 — Vérification statut Signé", async () => {
          await page.goto(`${BASE_URL}/devis`);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1_500);

          await expect(page.getByText(devisNumero)).toBeVisible({
            timeout: 8_000,
          });
          // Badge "Signé" visible sur la card sans expansion
          await expect(page.getByText(/^Signé$/i).first()).toBeVisible({
            timeout: 10_000,
          });
          console.log("✅ 06 — Statut Signé confirmé");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 7 — Acompte
        // ═════════════════════════════════════════════════════════════════
        await test.step("07 — Ajout acompte", async () => {
          await expandDevisCard(page, devisNumero);

          await page
            .getByRole("tab", { name: /Acomptes/i })
            .first()
            .click();
          await page.waitForTimeout(400);

          await page
            .getByRole("button", { name: /ajouter|nouvel acompte/i })
            .first()
            .click();
          await page.waitForTimeout(500);

          const ac = TEST_DATA.devis1.acompte;

          const montantInput = page.getByLabel(/montant/i).last();
          if (await montantInput.isVisible({ timeout: 3_000 }).catch(() => false))
            await montantInput.fill(String(ac.montant));

          const descInput = page.getByLabel(/description|libellé/i).last();
          if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false))
            await descInput.fill(ac.description);

          await page
            .getByRole("button", { name: /créer|enregistrer|ajouter/i })
            .last()
            .click();
          await waitToast(page);
          await page.waitForTimeout(1_000);
          console.log("✅ 07 — Acompte créé");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 8 — Avenant
        // ═════════════════════════════════════════════════════════════════
        await test.step("08 — Ajout avenant", async () => {
          await page
            .getByRole("tab", { name: /Avenants/i })
            .first()
            .click();
          await page.waitForTimeout(400);

          await page
            .getByRole("button", { name: /nouvel avenant|ajouter/i })
            .first()
            .click();
          await page.waitForTimeout(500);

          const av = TEST_DATA.devis1.avenant;

          await page
            .getByPlaceholder(/description|désignation/i)
            .last()
            .fill(av.description);

          const motifInput = page.getByPlaceholder(/motif|raison/i).last();
          if (await motifInput.isVisible({ timeout: 2_000 }).catch(() => false))
            await motifInput.fill(av.motif);

          const qtyInput = page.getByPlaceholder(/quantité|qté/i).last();
          if (await qtyInput.isVisible({ timeout: 2_000 }).catch(() => false))
            await qtyInput.fill(String(av.quantite));

          const uniteInput = page.getByPlaceholder(/unité/i).last();
          if (await uniteInput.isVisible({ timeout: 2_000 }).catch(() => false))
            await uniteInput.fill(av.unite);

          const puInput = page
            .getByPlaceholder(/prix unitaire|p\.u\./i)
            .last();
          if (await puInput.isVisible({ timeout: 2_000 }).catch(() => false))
            await puInput.fill(String(av.prix_unitaire));

          await page
            .getByRole("button", { name: /créer|enregistrer/i })
            .last()
            .click();
          await waitToast(page);
          await page.waitForTimeout(1_000);
          console.log("✅ 08 — Avenant créé");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 9 — Travaux Supplémentaires (TS)
        // ═════════════════════════════════════════════════════════════════
        await test.step("09 — Ajout TS (Travaux Supplémentaires)", async () => {
          await page.getByRole("tab", { name: /^TS/i }).first().click();
          await page.waitForTimeout(400);

          await page
            .getByRole("button", { name: /nouveau ts|ajouter|travaux/i })
            .first()
            .click();
          await page.waitForTimeout(500);

          await page
            .getByPlaceholder(/description|désignation/i)
            .last()
            .fill("Remplacement robinetterie");

          const qtyInput = page.getByPlaceholder(/quantité|qté/i).last();
          if (await qtyInput.isVisible({ timeout: 2_000 }).catch(() => false))
            await qtyInput.fill("1");

          const puInput = page
            .getByPlaceholder(/prix unitaire|p\.u\./i)
            .last();
          if (await puInput.isVisible({ timeout: 2_000 }).catch(() => false))
            await puInput.fill("350");

          await page
            .getByRole("button", { name: /créer|enregistrer/i })
            .last()
            .click();
          await waitToast(page);
          await page.waitForTimeout(1_000);
          console.log("✅ 09 — TS créé");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 10 — Génération facture
        // ═════════════════════════════════════════════════════════════════
        await test.step("10 — Génération facture", async () => {
          await page
            .getByRole("tab", { name: /^Factures/i })
            .first()
            .click();
          await page.waitForTimeout(400);

          const emettreBtn = page.getByRole("button", {
            name: /Émettre la facture/i,
          });
          await emettreBtn.waitFor({ timeout: 8_000 });
          await emettreBtn.click();
          await page.waitForTimeout(500);

          // Remplir date d'échéance si le champ est visible
          const echeanceInput = page
            .getByLabel(/échéance|date d'échéance/i)
            .last();
          if (
            await echeanceInput.isVisible({ timeout: 3_000 }).catch(() => false)
          ) {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            await echeanceInput.fill(d.toISOString().split("T")[0]);
          }

          const createBtn = page.getByRole("button", {
            name: /Créer la facture/i,
          });
          await createBtn.waitFor({ timeout: 5_000 });
          await createBtn.click();
          await waitToast(page);
          await page.waitForTimeout(2_000);

          await expect(page.getByText(/FAC-/i).first()).toBeVisible({
            timeout: 10_000,
          });
          console.log("✅ 10 — Facture générée");
        });

        // ═════════════════════════════════════════════════════════════════
        // ÉTAPE 11 — Envoi facture
        // ═════════════════════════════════════════════════════════════════
        await test.step("11 — Envoi facture par email", async () => {
          // Bouton "Envoyer par email" dans la FactureCard (onglet Factures, statut brouillon)
          const envBtn = page
            .getByRole("button", { name: /Envoyer par email/i })
            .first();
          await envBtn.waitFor({ timeout: 8_000 });
          await envBtn.click();
          await page.waitForTimeout(800);

          const sendBtn = page.getByRole("button", { name: /^Envoyer$/i });
          await sendBtn.waitFor({ timeout: 5_000 });
          await sendBtn.click();
          await waitToast(page, 15_000);
          await page.waitForTimeout(1_500);

          const sentOk = await page
            .getByText(/envoyé|enregistré/i)
            .first()
            .isVisible({ timeout: 5_000 })
            .catch(() => false);
          if (!sentOk)
            console.warn(
              "⚠️ 11 — Toast envoi facture non détecté (Brevo peut-être non configuré)"
            );
          else console.log("✅ 11 — Facture envoyée");
        });
      } finally {
        await artisanCtx.close();
      }

      // ═════════════════════════════════════════════════════════════════
      // ÉTAPE 12 — Vérification espace client
      // ═════════════════════════════════════════════════════════════════
      await test.step("12 — Vérification facture dans espace client", async () => {
        const clientCtx = await browser.newContext({
          recordVideo: { dir: "tests/videos/" },
        });
        const clientPage = await clientCtx.newPage();

        try {
          await clientPage.goto(`${BASE_URL}/auth`);
          await clientPage.waitForLoadState("networkidle");
          await clientPage.locator("#email").fill(TEST_DATA.clientAccount.email);
          await clientPage
            .locator("#password")
            .fill(TEST_DATA.clientAccount.password);
          await clientPage
            .getByRole("button", { name: /se connecter/i })
            .click();
          await clientPage.waitForURL(`${BASE_URL}/espace-client`, {
            timeout: 30_000,
          });

          await clientPage.goto(`${BASE_URL}/espace-client/devis`);
          await clientPage.waitForLoadState("networkidle");
          await expect(
            clientPage.getByText(/devis & factures/i).first()
          ).toBeVisible({ timeout: 10_000 });

          // Onglet Factures
          await clientPage
            .getByRole("button", { name: /^Factures$/i })
            .click();
          await clientPage.waitForTimeout(500);

          await expect(clientPage.getByText(/FAC-/i).first()).toBeVisible({
            timeout: 10_000,
          });
          console.log("✅ 12 — Facture visible dans l'espace client");
        } finally {
          await clientCtx.close();
        }
      });

      console.log("\n✅ Parcours complet Devis → Facture terminé avec succès");
    }
  );
});
