const CY = [99, 245, 391, 537] as const;
const PY = [178, 270, 362, 454] as const;

export type SlotGeometry = {
  slot: number;
  d: string;
  portX: number;
  portY: number;
  module: number;
  side: "start" | "end";
};

export function slotGeometry(slot: number): SlotGeometry {
  const index = slot % 4;
  const start = slot < 4;
  const cy = CY[index] ?? CY[0];
  const py = PY[index] ?? PY[0];
  const d = start
    ? `M312 ${cy} C410 ${cy} 400 ${py} 498 ${py}`
    : `M888 ${cy} C790 ${cy} 800 ${py} 702 ${py}`;
  return {
    slot,
    d,
    portX: start ? 498 : 702,
    portY: py,
    module: index * 2 + (start ? 0 : 1),
    side: start ? "start" : "end",
  };
}

export const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => slotGeometry(slot));
