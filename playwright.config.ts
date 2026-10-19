import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

function localEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(".devos/supabase.env", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)='(.*)'$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3000",
    timeout: 180_000,
    reuseExistingServer: false,
    env: Object.fromEntries(
      Object.entries({ ...process.env, ...localEnv() }).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  },
  projects: [
    { name: "pages", testIgnore: /import\.spec\.ts$/ },
    { name: "import", testMatch: /import\.spec\.ts$/, dependencies: ["pages"] },
  ],
});
