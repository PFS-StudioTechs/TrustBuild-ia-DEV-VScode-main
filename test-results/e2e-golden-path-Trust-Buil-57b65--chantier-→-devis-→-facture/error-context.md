# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-golden-path.spec.ts >> TrustBuild-IA — Golden Path >> Parcours complet : connexion → KBIS → SIRET → client → chantier → devis → facture
- Location: tests\e2e-golden-path.spec.ts:31:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: /entreprise|mon entreprise/i }) to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - img "TrustBuild-IA" [ref=e6]
        - generic [ref=e7]: TrustBuild-IA
      - navigation [ref=e8]:
        - button "Tableau" [ref=e9] [cursor=pointer]:
          - img [ref=e10]
          - generic [ref=e15]: Tableau
        - button "Devis & Factures" [ref=e16] [cursor=pointer]:
          - img [ref=e17]
          - generic [ref=e20]: Devis & Factures
        - button "Suivi des chantiers" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
          - generic [ref=e26]: Suivi des chantiers
        - button "Comptabilité" [ref=e27] [cursor=pointer]:
          - img [ref=e28]
          - generic [ref=e31]: Comptabilité
        - button "Clients" [ref=e32] [cursor=pointer]:
          - img [ref=e33]
          - generic [ref=e38]: Clients
        - button "Fournisseurs" [ref=e39] [cursor=pointer]:
          - img [ref=e40]
          - generic [ref=e45]: Fournisseurs
        - button "Contacts" [ref=e46] [cursor=pointer]:
          - img [ref=e47]
          - generic [ref=e51]: Contacts
        - button "Messagerie" [ref=e52] [cursor=pointer]:
          - img [ref=e53]
          - generic [ref=e55]: Messagerie
        - button "Assistants" [ref=e56] [cursor=pointer]:
          - img [ref=e57]
          - generic [ref=e60]: Assistants
        - button "Mes Fichiers" [ref=e62] [cursor=pointer]:
          - img [ref=e63]
          - generic [ref=e65]: Mes Fichiers
        - button "Réglages" [ref=e66] [cursor=pointer]:
          - img [ref=e67]
          - generic [ref=e70]: Réglages
      - button "Déconnexion" [ref=e72] [cursor=pointer]:
        - img [ref=e73]
        - generic [ref=e76]: Déconnexion
    - main [ref=e78]:
      - generic [ref=e79]:
        - heading "Paramètres" [level=1] [ref=e80]
        - generic [ref=e81]:
          - tablist [ref=e82]:
            - tab "Profil" [selected] [ref=e83] [cursor=pointer]:
              - img [ref=e84]
              - text: Profil
            - tab "Mon template" [ref=e87] [cursor=pointer]:
              - img [ref=e88]
              - text: Mon template
            - tab "Intégrations" [ref=e94] [cursor=pointer]:
              - img [ref=e95]
              - text: Intégrations
          - tabpanel "Profil" [ref=e97]:
            - generic [ref=e98]:
              - generic [ref=e99]:
                - img [ref=e101]
                - heading "Mon profil" [level=2] [ref=e104]
              - generic [ref=e105]:
                - generic [ref=e106]:
                  - generic [ref=e107]:
                    - text: Prénom
                    - textbox [ref=e108]: steeve
                  - generic [ref=e109]:
                    - text: Nom
                    - textbox [ref=e110]: decembre
                - generic [ref=e111]:
                  - text: SIRET
                  - textbox "123 456 789 00012" [disabled] [ref=e113]
                - generic [ref=e114]:
                  - text: Email
                  - textbox [disabled] [ref=e115]: steevival@yahoo.fr
                - button "Enregistrer" [ref=e116] [cursor=pointer]:
                  - img
                  - text: Enregistrer
            - generic [ref=e117]:
              - generic [ref=e118]:
                - img [ref=e120]
                - heading "Sécurité (2FA)" [level=2] [ref=e122]
                - generic [ref=e123]: Désactivé
              - generic [ref=e124]:
                - paragraph [ref=e125]: Ajoutez une couche de sécurité supplémentaire avec une application d'authentification (Google Authenticator, Authy, Microsoft Authenticator…).
                - button "Activer le 2FA" [ref=e126] [cursor=pointer]:
                  - img
                  - text: Activer le 2FA
    - button "Ouvrir Jarvis" [ref=e127] [cursor=pointer]:
      - img
```

# Test source

```ts
  1   | import { test, expect, Page } from "@playwright/test";
  2   | import { TEST_DATA, BASE_URL } from "./test-data";
  3   | import fs from "fs";
  4   | 
  5   | // ─── Helpers ───────────────────────────────────────────────────────────────
  6   | 
  7   | const SCREENSHOTS_DIR = "tests/screenshots";
  8   | 
  9   | function ensureScreenshotsDir() {
  10  |   if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  11  | }
  12  | 
  13  | let stepCount = 0;
  14  | async function shot(page: Page, name: string) {
  15  |   ensureScreenshotsDir();
  16  |   stepCount++;
  17  |   const file = `${SCREENSHOTS_DIR}/${String(stepCount).padStart(2, "0")}-${name}.png`;
  18  |   await page.screenshot({ path: file, fullPage: true });
  19  |   console.log(`📸 ${file}`);
  20  | }
  21  | 
  22  | async function waitToast(page: Page, timeoutMs = 8000) {
  23  |   await page.locator("[data-sonner-toast]").first().waitFor({ state: "visible", timeout: timeoutMs }).catch(() => {});
  24  | }
  25  | 
  26  | // ─── Test principal ────────────────────────────────────────────────────────
  27  | 
  28  | test.describe("TrustBuild-IA — Golden Path", () => {
  29  |   test.setTimeout(300_000); // 5 minutes max
  30  | 
  31  |   test("Parcours complet : connexion → KBIS → SIRET → client → chantier → devis → facture", async ({ page }) => {
  32  |     stepCount = 0;
  33  | 
  34  |     // ═══════════════════════════════════════════════════════════════════════
  35  |     // ÉTAPE 1 — Connexion
  36  |     // ═══════════════════════════════════════════════════════════════════════
  37  |     await test.step("01 — Connexion artisan", async () => {
  38  |       await page.goto(`${BASE_URL}/auth`);
  39  |       await page.waitForLoadState("networkidle");
  40  |       await shot(page, "auth-page");
  41  | 
  42  |       // Remplir le formulaire de connexion (selectors par id/label)
  43  |       await page.locator("#email").fill(TEST_DATA.artisan.email);
  44  |       await page.locator("#password").fill(TEST_DATA.artisan.password);
  45  |       await page.getByRole("button", { name: /se connecter/i }).click();
  46  | 
  47  |       await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30_000 });
  48  |       await page.waitForLoadState("domcontentloaded");
  49  |       await page.waitForTimeout(2000);
  50  |       await shot(page, "dashboard-apres-connexion");
  51  | 
  52  |       await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
  53  |     });
  54  | 
  55  |     // ═══════════════════════════════════════════════════════════════════════
  56  |     // ÉTAPE 2 — Vérification banner KBIS
  57  |     // ═══════════════════════════════════════════════════════════════════════
  58  |     await test.step("02 — Vérification banner avertissement KBIS", async () => {
  59  |       await page.waitForTimeout(1000);
  60  |       await shot(page, "banner-kbis-visible");
  61  | 
  62  |       const banner = page.getByText(/vous n'avez pas encore renseigné votre kbis/i);
  63  |       const bannerVisible = await banner.isVisible().catch(() => false);
  64  |       console.log(`ℹ️  Banner KBIS visible : ${bannerVisible}`);
  65  |       // Non bloquant : peut ne pas apparaître si le délai 6 mois n'est pas configuré
  66  |     });
  67  | 
  68  |     // ═══════════════════════════════════════════════════════════════════════
  69  |     // ÉTAPE 3 — SIRET dans Paramètres
  70  |     // ═══════════════════════════════════════════════════════════════════════
  71  |     await test.step("03 — Saisie et vérification du SIRET", async () => {
  72  |       await page.goto(`${BASE_URL}/parametres`);
  73  |       await page.waitForLoadState("networkidle");
  74  |       await shot(page, "parametres-page");
  75  | 
  76  |       // Cliquer sur l'onglet Entreprise
  77  |       const entrepriseTab = page.getByRole("tab", { name: /entreprise|mon entreprise/i });
> 78  |       await entrepriseTab.waitFor({ timeout: 5000 });
      |                           ^ TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
  79  |       await entrepriseTab.click();
  80  |       await page.waitForTimeout(500);
  81  | 
  82  |       // Saisir le SIRET
  83  |       const siretInput = page.getByPlaceholder("123 456 789 00012");
  84  |       await siretInput.clear();
  85  |       await siretInput.fill(TEST_DATA.artisan.siret);
  86  |       await shot(page, "siret-saisi");
  87  | 
  88  |       // Vérifier via INSEE
  89  |       await page.getByRole("button", { name: "Vérifier" }).click();
  90  |       await page.waitForTimeout(6000); // Appel API INSEE
  91  | 
  92  |       await shot(page, "siret-verifie");
  93  |       await expect(page.getByText(/établissement actif/i)).toBeVisible({ timeout: 10_000 });
  94  | 
  95  |       // Enregistrer
  96  |       await page.getByRole("button", { name: /enregistrer|sauvegarder/i }).first().click();
  97  |       await waitToast(page);
  98  |       await shot(page, "siret-enregistre");
  99  |     });
  100 | 
  101 |     // ═══════════════════════════════════════════════════════════════════════
  102 |     // ÉTAPE 4 — Upload KBIS + vérification IA
  103 |     // ═══════════════════════════════════════════════════════════════════════
  104 |     await test.step("04 — Upload KBIS et vérification par l'IA", async () => {
  105 |       await page.goto(`${BASE_URL}/mes-documents`);
  106 |       await page.waitForLoadState("networkidle");
  107 |       await shot(page, "mes-fichiers-page");
  108 | 
  109 |       // Cliquer sur "Déposer" dans la carte KBIS
  110 |       const deposerBtn = page.getByRole("button", { name: /déposer/i }).first();
  111 |       await deposerBtn.waitFor({ timeout: 5000 });
  112 |       await deposerBtn.click();
  113 |       await page.waitForTimeout(500);
  114 | 
  115 |       // Upload du fichier via l'input caché dans KbisUploadSection
  116 |       const kbisInput = page.locator("input[type='file'][accept='.pdf,.jpg,.jpeg,.png']").first();
  117 |       await kbisInput.setInputFiles(TEST_DATA.kbisPath);
  118 |       await page.waitForTimeout(500);
  119 |       await shot(page, "kbis-fichier-selectionne");
  120 | 
  121 |       // Lancer la vérification IA
  122 |       await page.getByRole("button", { name: /déposer et vérifier/i }).click();
  123 | 
  124 |       // Attendre la vérification (Edge Function + Claude)
  125 |       await page.getByText(/vérification ia en cours|vérifié par l'ia/i).first().waitFor({
  126 |         state: "visible",
  127 |         timeout: 30_000,
  128 |       });
  129 |       await page.waitForTimeout(2000);
  130 |       await shot(page, "kbis-verifie-ia");
  131 | 
  132 |       // Confirmer le succès
  133 |       await expect(page.getByText(/kbis vérifié par l'ia/i)).toBeVisible({ timeout: 15_000 });
  134 |     });
  135 | 
  136 |     // ═══════════════════════════════════════════════════════════════════════
  137 |     // ÉTAPE 5 — Création d'un client
  138 |     // ═══════════════════════════════════════════════════════════════════════
  139 |     await test.step("05 — Création du client", async () => {
  140 |       await page.goto(`${BASE_URL}/clients`);
  141 |       await page.waitForLoadState("networkidle");
  142 |       await shot(page, "clients-page");
  143 | 
  144 |       // Ouvrir le formulaire de création
  145 |       await page.getByRole("button", { name: /nouveau client|ajouter|créer/i }).first().click();
  146 |       await page.waitForTimeout(500);
  147 | 
  148 |       // Remplir le formulaire
  149 |       await page.getByLabel(/nom/i).fill(TEST_DATA.client.nom);
  150 |       await page.getByLabel(/email/i).fill(TEST_DATA.client.email);
  151 |       await page.getByLabel(/téléphone|phone/i).fill(TEST_DATA.client.telephone);
  152 |       await page.getByLabel(/adresse/i).fill(TEST_DATA.client.adresse);
  153 |       await page.getByLabel(/code postal/i).fill(TEST_DATA.client.code_postal);
  154 |       await page.getByLabel(/ville/i).fill(TEST_DATA.client.ville);
  155 |       await shot(page, "client-formulaire-rempli");
  156 | 
  157 |       // Enregistrer
  158 |       await page.getByRole("button", { name: /créer|enregistrer|ajouter/i }).last().click();
  159 |       await waitToast(page);
  160 |       await page.waitForTimeout(1000);
  161 |       await shot(page, "client-cree");
  162 | 
  163 |       await expect(page.getByText(TEST_DATA.client.nom)).toBeVisible({ timeout: 8000 });
  164 |     });
  165 | 
  166 |     // ═══════════════════════════════════════════════════════════════════════
  167 |     // ÉTAPE 6 — Création d'un chantier
  168 |     // ═══════════════════════════════════════════════════════════════════════
  169 |     await test.step("06 — Création du chantier", async () => {
  170 |       await page.goto(`${BASE_URL}/chantiers`);
  171 |       await page.waitForLoadState("networkidle");
  172 |       await shot(page, "chantiers-page");
  173 | 
  174 |       await page.getByRole("button", { name: /nouveau chantier|ajouter|créer/i }).first().click();
  175 |       await page.waitForTimeout(500);
  176 | 
  177 |       await page.getByLabel(/nom du chantier|nom/i).first().fill(TEST_DATA.chantier.nom);
  178 |       await page.getByLabel(/adresse/i).fill(TEST_DATA.chantier.adresse);
```