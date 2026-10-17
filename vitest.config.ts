import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

function localEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(".devos/supabase.env")) return env;
  const text = readFileSync(".devos/supabase.env", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)='(.*)'$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function testEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(localEnv())) {
    const current = process.env[key];
    env[key] = current === undefined ? value : current;
  }
  return env;
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: testEnv(),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
