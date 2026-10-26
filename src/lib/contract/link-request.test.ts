import { describe, expect, it } from "vitest";
import { linkClaimsValid, parseLinkRequestBody, type LinkRequestBody } from "./link-request";

const good: LinkRequestBody = { v: 1, key: "LK-GOOD", engine: "0.2.0", contract: "v1" };

describe("parseLinkRequestBody", () => {
  it("accepts the good body", () => {
    expect(parseLinkRequestBody(good)).toEqual(good);
  });

  it("rejects each missing field and an extra field", () => {
    for (const field of ["v", "key", "engine", "contract"] as const) {
      const value: Record<string, unknown> = { ...good };
      delete value[field];
      expect(parseLinkRequestBody(value)).toBeNull();
    }
    expect(parseLinkRequestBody({ ...good, repository: "fixture-lk/extra" })).toBeNull();
  });

  it("rejects v as 2 and as a string", () => {
    expect(parseLinkRequestBody({ ...good, v: 2 })).toBeNull();
    expect(parseLinkRequestBody({ ...good, v: "1" })).toBeNull();
  });

  it("rejects the keys lower, A and a 33-character key", () => {
    expect(parseLinkRequestBody({ ...good, key: "lower" })).toBeNull();
    expect(parseLinkRequestBody({ ...good, key: "A" })).toBeNull();
    expect(parseLinkRequestBody({ ...good, key: "A".repeat(33) })).toBeNull();
    expect(parseLinkRequestBody({ ...good, key: "A".repeat(32) })).toEqual({ ...good, key: "A".repeat(32) });
  });

  it("rejects an engine with a space, 33 characters, é or U+202E", () => {
    expect(parseLinkRequestBody({ ...good, engine: "0.2 0" })).toBeNull();
    expect(parseLinkRequestBody({ ...good, engine: "a".repeat(33) })).toBeNull();
    expect(parseLinkRequestBody({ ...good, engine: "caf\u00e9" })).toBeNull();
    expect(parseLinkRequestBody({ ...good, engine: "1.0\u202E" })).toBeNull();
    expect(parseLinkRequestBody({ ...good, engine: "a".repeat(32) })).toEqual({
      ...good,
      engine: "a".repeat(32),
    });
    expect(parseLinkRequestBody({ ...good, contract: "0.2 0" })).toBeNull();
  });

  it("rejects an array, null and a string", () => {
    expect(parseLinkRequestBody([good])).toBeNull();
    expect(parseLinkRequestBody(null)).toBeNull();
    expect(parseLinkRequestBody("{")).toBeNull();
  });
});

describe("linkClaimsValid", () => {
  it("accepts a repository and a numeric owner id", () => {
    expect(linkClaimsValid("fixture-lk/repo", "1101")).toBe(true);
    expect(linkClaimsValid(`${"a".repeat(39)}/repo`, "1".repeat(20))).toBe(true);
  });

  it("rejects no-slash, a 40-character owner segment, an owner id abc and empty strings", () => {
    expect(linkClaimsValid("no-slash", "1101")).toBe(false);
    expect(linkClaimsValid(`${"a".repeat(40)}/repo`, "1101")).toBe(false);
    expect(linkClaimsValid("fixture-lk/repo", "abc")).toBe(false);
    expect(linkClaimsValid("", "")).toBe(false);
    expect(linkClaimsValid("", "1101")).toBe(false);
    expect(linkClaimsValid("fixture-lk/repo", "")).toBe(false);
  });
});
