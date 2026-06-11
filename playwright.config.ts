import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, ".env.local") });

export default defineConfig({
  use: {
    baseURL: "http://localhost:8080",
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
