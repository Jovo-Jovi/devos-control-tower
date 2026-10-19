// Stable sky positions for the night starfield. The photographic Milky Way stays
// in the plate; these are only the few points that drift and twinkle.

export const DESKTOP_STAR_COUNT = 64;
export const PHONE_STAR_COUNT = 32;

export type Star = {
  x: number;
  y: number;
  radius: number;
  halo: number;
  alpha: number;
  period: number;
  phase: number;
  drift: number;
  bright: boolean;
};

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function createStars(count: number, seed = 0x51a2c0de): Star[] {
  const random = mulberry32(seed);
  const stars: Star[] = [];
  for (let index = 0; index < count; index += 1) {
    const bright = random() < 0.08;
    stars.push({
      x: random(),
      y: random(),
      radius: bright ? 1.15 + random() * 0.55 : 0.35 + random() * 0.7,
      halo: bright ? 7 + random() * 4 : 2.4 + random() * 2.8,
      alpha: bright ? 0.62 + random() * 0.28 : 0.16 + random() * 0.28,
      period: 3.6 + random() * 6.4,
      phase: random() * Math.PI * 2,
      drift: (random() - 0.42) * 1.35,
      bright,
    });
  }
  return stars;
}
