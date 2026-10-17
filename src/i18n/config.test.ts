import { describe, expect, it } from "vitest";
import { defaultLocale, directionOf, locales } from "./config";

describe("U-T01-1 i18n config", () => {
  it("exposes a single English locale as the default, left to right", () => {
    expect([...locales]).toEqual(["en"]);
    expect(defaultLocale).toBe("en");
    expect(directionOf(defaultLocale)).toBe("ltr");
  });
});
