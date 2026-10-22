import { describe, expect, it } from "vitest";
import { backingSize, centreU, sampleSphere, translateX } from "./sphere";

describe("sphere", () => {
  it('translateX("none") is 0', () => {
    expect(translateX("none")).toBe(0);
  });

  it('translateX("matrix(1, 0, 0, 1, -340, 0)") is -340', () => {
    expect(translateX("matrix(1, 0, 0, 1, -340, 0)")).toBe(-340);
  });

  it('translateX("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -12, 0, 0, 1)") is -12', () => {
    expect(translateX("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -12, 0, 0, 1)")).toBe(-12);
  });

  it('translateX("rotate(1deg)") is NaN', () => {
    expect(translateX("rotate(1deg)")).toBeNaN();
  });

  it("centreU(0, 0, 680) is 0.25", () => {
    expect(centreU(0, 0, 680)).toBeCloseTo(0.25, 6);
  });

  it("centreU(0, -340, 680) is 0.75", () => {
    expect(centreU(0, -340, 680)).toBeCloseTo(0.75, 6);
  });

  it("centreU(-680, 0, 680) is 0.25", () => {
    expect(centreU(-680, 0, 680)).toBeCloseTo(0.25, 6);
  });

  it("centreU(-340, -340, 680) is 0.25", () => {
    expect(centreU(-340, -340, 680)).toBeCloseTo(0.25, 6);
  });

  it("sampleSphere(0, 0, 0.25) is the centre of the strip", () => {
    const sample = sampleSphere(0, 0, 0.25);
    expect(sample).not.toBeNull();
    expect(sample?.u).toBeCloseTo(0.25, 6);
    expect(sample?.v).toBeCloseTo(0.5, 6);
  });

  it("sampleSphere(1, 0, 0.25).u is 0.5", () => {
    expect(sampleSphere(1, 0, 0.25)?.u).toBeCloseTo(0.5, 6);
  });

  it("sampleSphere(-1, 0, 0.25).u is 0", () => {
    expect(sampleSphere(-1, 0, 0.25)?.u).toBeCloseTo(0, 6);
  });

  it("sampleSphere(0, -1, 0).v is 0", () => {
    expect(sampleSphere(0, -1, 0)?.v).toBeCloseTo(0, 6);
  });

  it("sampleSphere(0, 1, 0).v is 1", () => {
    expect(sampleSphere(0, 1, 0)?.v).toBeCloseTo(1, 6);
  });

  it("sampleSphere(1, 0, 0.9).u wraps to 0.15", () => {
    expect(sampleSphere(1, 0, 0.9)?.u).toBeCloseTo(0.15, 6);
  });

  it("sampleSphere(0.8, 0.8, 0) is outside the disc", () => {
    expect(sampleSphere(0.8, 0.8, 0)).toBeNull();
  });

  it("backingSize(340, 2) is 680", () => {
    expect(backingSize(340, 2)).toBe(680);
  });

  it("backingSize(210.8, 3) is 632", () => {
    expect(backingSize(210.8, 3)).toBe(632);
  });

  it("backingSize(0, 2) is 1", () => {
    expect(backingSize(0, 2)).toBe(1);
  });
});
