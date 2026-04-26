import { createLovableConfig } from "lovable-agent-playwright-config/config";

export default createLovableConfig({
  use: {
    baseURL: "https://trust-build-ia-vs-code.vercel.app",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    headless: false, // false = fenêtre visible pour suivre le test en direct
    viewport: { width: 1280, height: 900 },
    locale: "fr-FR",
  },
  reporter: [
    ["html", { outputFolder: "tests/rapport-playwright", open: "never" }],
    ["list"],
  ],
  testDir: "tests",
  timeout: 300_000,
});
