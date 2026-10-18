export function tokenSeconds(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.endsWith("ms")) return Number.parseFloat(raw) / 1000;
  if (raw.endsWith("s")) return Number.parseFloat(raw);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function tokenMs(name: string): number {
  return tokenSeconds(name) * 1000;
}

export function tokenEase(name: string): [number, number, number, number] | "linear" {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw === "linear") return "linear";
  const match = /([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(raw);
  if (!match) return "linear";
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}
