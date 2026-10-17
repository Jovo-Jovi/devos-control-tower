#!/usr/bin/env node
// Visual evidence for the reviewer (OD-08 §5): full-page screenshots of the key pages at desktop
// and phone widths, written to .devos/screens/*.png. Claude reads these images during the review
// and compares them with docs/DESIGN_SYSTEM.md and the approved mockup.
// Uses the project's own Playwright; skips cleanly when the project has none.
// Usage: node scripts/devos/screens.mjs [--base https://preview.vercel.app] [--port 3200] [/ar /en ...]
// A --base that answers with the Vercel login (401, or a redirect to vercel.com/sso) is not used:
// the screenshots come from the local build instead, and .devos/screens/SOURCE.txt says which (PR-15).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { P } from "./lib.mjs";
import { readEnvFile } from "./supabase.mjs";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
let base = (opt("base", "") || "").replace(/\/$/, "");
const port = Number(opt("port", "3200"));
const pages = argv.filter((a, i) => a.startsWith("/") && argv[i - 1] !== "--base");
if (!pages.length) pages.push("/ar", "/en", "/ar/notices", "/en/notices");
const WIDTHS = [{ name: "desktop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844 }];

let chromium;
try {
  chromium = createRequire(P("package.json"))("@playwright/test").chromium;
} catch {
  console.log("screens: @playwright/test is not installed in this project; skipped");
  process.exit(0);
}

const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } : {};
mkdirSync(P(".devos/screens"), { recursive: true });
let source = base ? `preview ${base}` : "local build (next start)";
if (base) {
  let status = 0, loc = "";
  try {
    const r = await fetch(`${base}${pages[0]}`, { redirect: "manual", headers, signal: AbortSignal.timeout(20000) });
    status = r.status; loc = r.headers.get("location") ?? "";
  } catch (e) { loc = e.message; }
  if (status === 401 || status === 403 || status === 0 || (status >= 300 && status < 400 && /vercel\.com\/(sso|login)/.test(loc))) {
    console.log(`screens: the preview answers ${status}${loc ? " → " + loc.slice(0, 80) : ""} (Vercel login or unreachable); using the local build instead`);
    source = `local build (next start), because the preview ${base} answered ${status}: set VERCEL_AUTOMATION_BYPASS_SECRET to screenshot the preview`;
    base = "";
  }
}
writeFileSync(P(".devos/screens/SOURCE.txt"), `Screenshots taken from: ${source}\n`);

let server;
const url = base || `http://127.0.0.1:${port}`;
if (!base) {
  if (!existsSync(P(".next"))) { console.log("screens: no .next build; skipped"); process.exit(0); }
  server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: P(), env: { ...process.env, ...readEnvFile() }, stdio: "ignore", shell: process.platform === "win32", detached: process.platform !== "win32",
  });
  for (let i = 0; i < 120; i++) {
    try { await fetch(`${url}/`, { redirect: "manual" }); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
}

// DEVOS_CHROMIUM points at a specific Chromium when the bundled one is not installed.
const browser = await chromium.launch(process.env.DEVOS_CHROMIUM ? { executablePath: process.env.DEVOS_CHROMIUM } : {});
let count = 0;
try {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height }, extraHTTPHeaders: headers, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const path of pages) {
      await page.goto(url + path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts?.ready);
      const file = `.devos/screens/${path.replace(/^\//, "").replace(/\//g, "-") || "root"}-${w.name}.png`;
      await page.screenshot({ path: P(file), fullPage: true });
      console.log(`screens: ${file}`);
      count++;
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  if (server) {
    try { process.platform === "win32" ? spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"]) : process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
  }
}
console.log(`screens: ${count} screenshot(s) in .devos/screens/`);
