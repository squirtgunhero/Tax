import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
  },
  workers: 1,
  reporter: "list",
});
