#!/usr/bin/env node
// Export a repository's PHASES ledger and review verdicts as contract events.
// Git is read-only, via execFileSync (never a shell). File text never reaches stderr.
import { execFileSync } from "node:child_process";
import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import { historyEvents, summary, toJsonLines } from "./history.mjs";

const USAGE = "usage: node scripts/tower/export-history.mjs --repo <dir> --project <KEY> [--out <file>]\n";
const PROJECT = /^[A-Z][A-Z0-9_-]{1,31}$/;

/**
 * @param {string[]} argv
 * @returns {{ repo: string, project: string, out?: string } | null}
 */
function parseArgs(argv) {
  /** @type {{ repo?: string, project?: string, out?: string }} */
  const parsed = {};
  for (let index = 2; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== "--repo" && flag !== "--project" && flag !== "--out") return null;
    if (value === undefined || value.startsWith("--")) return null;
    index += 1;
    if (flag === "--repo") parsed.repo = value;
    else if (flag === "--project") parsed.project = value;
    else parsed.out = value;
  }
  if (!parsed.repo || !parsed.project || !PROJECT.test(parsed.project)) return null;
  return { repo: parsed.repo, project: parsed.project, out: parsed.out };
}

/**
 * @param {string} dir
 * @param {string[]} args
 * @returns {string}
 */
function git(dir, args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_PAGER: "cat", GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr).trim() : "";
    const detail = stderr.split("\n")[0]?.slice(0, 300) || "git failed";
    throw new Error(`history: git ${args[0]}: ${detail}`);
  }
}

/**
 * @param {string} file
 * @param {string} body
 */
function writeOut(file, body) {
  const temporary = `${file}.${process.pid}.partial`;
  try {
    writeFileSync(temporary, body);
    renameSync(temporary, file);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // The partial file was never created.
    }
    throw error;
  }
}

/**
 * @param {string} repo
 * @param {string} project
 * @returns {{ body: string, counts: ReturnType<typeof summary> }}
 */
function exportRepo(repo, project) {
  const head = git(repo, ["rev-parse", "HEAD"]).trim();
  const phases = git(repo, ["show", "HEAD:docs/PHASES.md"]);
  const listed = git(repo, ["ls-tree", "--name-only", "HEAD", "docs/reviews/"]).split("\n").filter(Boolean);
  const order = git(repo, ["rev-list", "--reverse", "--topo-order", "HEAD"]).split("\n").filter(Boolean);
  const rank = new Map(order.map((sha, index) => [sha, index]));

  const reviews = listed.map((path) => {
    const log = git(repo, ["log", "-1", "--diff-filter=A", "--format=%H %cI", "--", path]).trim();
    const found = /^([0-9a-f]{40}) (\S+)$/.exec(log);
    if (!found) throw new Error(`history: ${path}: adding commit was not found`);
    if (!rank.has(found[1])) throw new Error(`history: ${path}: adding commit is not in HEAD`);
    const shown = git(repo, ["show", `HEAD:${path}`]);
    const firstLine = shown.split("\n", 1)[0] ?? "";
    return { path, firstLine, commit: found[1], at: found[2], rank: rank.get(found[1]) ?? 0 };
  });

  reviews.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.path < right.path) return -1;
    if (left.path > right.path) return 1;
    return 0;
  });

  const events = historyEvents({
    project,
    head,
    phases,
    reviews: reviews.map(({ path, firstLine, commit, at }) => ({ path, firstLine, commit, at })),
  });
  return { body: toJsonLines(events), counts: summary(events) };
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  let exported;
  try {
    exported = exportRepo(parsed.repo, parsed.project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "history: export failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    if (parsed.out !== undefined) writeOut(parsed.out, exported.body);
    else process.stdout.write(exported.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "history: export failed";
    process.stderr.write(`history: could not write the export: ${message.split("\n")[0]}\n`);
    process.exitCode = 1;
    return;
  }

  const counts = exported.counts;
  process.stderr.write(
    `export-history: run=${counts.run} tasks=${counts.tasks} attempts=${counts.attempts} events=${counts.events}\n`,
  );
}

main();
