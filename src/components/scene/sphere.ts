function wrapUnit(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function matrixValues(transform: string, head: string): number[] | null {
  if (!transform.startsWith(head) || !transform.endsWith(")")) return null;
  const values = transform
    .slice(head.length, -1)
    .split(",")
    .map((part) => Number(part.trim()));
  if (values.some((value) => Number.isNaN(value))) return null;
  return values;
}

export function translateX(transform: string): number {
  if (transform === "none") return 0;
  const matrix3d = matrixValues(transform, "matrix3d(");
  if (matrix3d) return matrix3d.length === 16 ? matrix3d[12] : Number.NaN;
  const matrix = matrixValues(transform, "matrix(");
  if (matrix) return matrix.length === 6 ? matrix[4] : Number.NaN;
  return Number.NaN;
}

export function centreU(spinX: number, turnX: number, tile: number): number {
  return wrapUnit((tile / 4 - spinX - turnX) / tile);
}

export function sampleSphere(x: number, y: number, centre: number): { u: number; v: number } | null {
  if (x * x + y * y > 1) return null;
  const z = Math.sqrt(1 - x * x - y * y);
  return {
    u: wrapUnit(centre + Math.atan2(x, z) / (2 * Math.PI)),
    v: 0.5 + Math.asin(y) / Math.PI,
  };
}

export function backingSize(cssSize: number, ratio: number): number {
  return Math.max(1, Math.round(cssSize * ratio));
}
