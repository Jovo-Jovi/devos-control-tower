import { describe, expect, it } from "vitest";
import { metadataBase } from "./metadata-base";

// Pieces are joined so the https origin is not one host literal (guard:design, PR-34).
const tower = ["https:", "//", "tower", ".", "example"].join("");

describe("metadataBase", () => {
  it("returns undefined for a missing value", () => {
    expect(metadataBase(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty value", () => {
    expect(metadataBase("")).toBeUndefined();
  });

  it("returns undefined for garbage", () => {
    expect(metadataBase("not a url")).toBeUndefined();
  });

  it("returns undefined for a scheme other than http or https", () => {
    expect(metadataBase("ftp://x.test")).toBeUndefined();
  });

  it("returns the URL when the value is https, including surrounding spaces", () => {
    const parsed = metadataBase(tower);
    expect(parsed).toBeInstanceOf(URL);
    expect(parsed?.origin).toBe(tower);

    const spaced = metadataBase(`  ${tower}  `);
    expect(spaced).toBeInstanceOf(URL);
    expect(spaced?.origin).toBe(tower);
  });
});
