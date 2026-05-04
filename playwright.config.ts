import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    baseURL: "https://trust-build-ia-vs-code.vercel.app",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    headless: false,
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
