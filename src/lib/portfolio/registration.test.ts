import { describe, expect, it } from "vitest";
import { parseRegistration } from "./registration";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const valid = { key: "TOWER", repo: "fixture-org/fixture-repo", stale: "1440" };

describe("parseRegistration", () => {
  it("accepts a trimmed valid input", () => {
    expect(parseRegistration(form({ key: "  TOWER ", repo: " fixture-org/fixture-repo ", stale: " 1440 " }))).toEqual({
      ok: true,
      key: "TOWER",
      repo: "fixture-org/fixture-repo",
      staleAfterMinutes: 1440,
    });
  });

  it("rejects a lowercase key", () => {
    const result = parseRegistration(form({ ...valid, key: "tower" }));
    expect(result).toMatchObject({ ok: false, key: "key" });
  });

  it("rejects a one-character key", () => {
    const result = parseRegistration(form({ ...valid, key: "A" }));
    expect(result).toMatchObject({ ok: false, key: "key" });
  });

  it("rejects a 33-character key", () => {
    const result = parseRegistration(form({ ...valid, key: `A${"B".repeat(32)}` }));
    expect(result).toMatchObject({ ok: false, key: "key" });
  });

  it("rejects a repository without a slash", () => {
    const result = parseRegistration(form({ ...valid, repo: "fixture-org" }));
    expect(result).toMatchObject({ ok: false, repo: "repo" });
  });

  it("rejects a repository with a space", () => {
    const result = parseRegistration(form({ ...valid, repo: "fixture org/fixture-repo" }));
    expect(result).toMatchObject({ ok: false, repo: "repo" });
  });

  it("rejects stale values 0, 100001 and 1.5", () => {
    expect(parseRegistration(form({ ...valid, stale: "0" }))).toMatchObject({ ok: false, stale: "stale" });
    expect(parseRegistration(form({ ...valid, stale: "100001" }))).toMatchObject({ ok: false, stale: "stale" });
    expect(parseRegistration(form({ ...valid, stale: "1.5" }))).toMatchObject({ ok: false, stale: "stale" });
  });

  it("accepts the stale bounds 1 and 100000", () => {
    expect(parseRegistration(form({ ...valid, stale: "1" }))).toMatchObject({ ok: true, staleAfterMinutes: 1 });
    expect(parseRegistration(form({ ...valid, stale: "100000" }))).toMatchObject({
      ok: true,
      staleAfterMinutes: 100000,
    });
  });
});
