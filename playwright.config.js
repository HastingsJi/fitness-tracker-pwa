import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:8789",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium"
      }
    },
    {
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 14"],
        browserName: "webkit"
      }
    }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:8789",
    reuseExistingServer: true,
    timeout: 10_000
  }
});
