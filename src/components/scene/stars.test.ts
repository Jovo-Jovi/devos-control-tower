import { describe, expect, it } from "vitest";
import { createStars, DESKTOP_STAR_COUNT } from "./stars";

describe("createStars", () => {
  it("repeats the same field for the same seed", () => {
    expect(createStars(DESKTOP_STAR_COUNT, 7)).toEqual(createStars(DESKTOP_STAR_COUNT, 7));
  });

  it("keeps every star inside the sky and out of lockstep", () => {
    const stars = createStars(DESKTOP_STAR_COUNT);
    expect(stars).toHaveLength(DESKTOP_STAR_COUNT);
    expect(stars.some((star) => star.bright)).toBe(true);
    const periods = new Set(stars.map((star) => star.period));
    expect(periods.size).toBeGreaterThan(DESKTOP_STAR_COUNT / 2);
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(1);
      expect(star.alpha).toBeGreaterThan(0);
      expect(star.alpha).toBeLessThanOrEqual(1);
    }
  });
});
