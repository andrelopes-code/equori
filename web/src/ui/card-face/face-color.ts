export const graphite = "#2b2d33";

// Light-scheme values of --equori-slot-N in app/app.css; face-color.test.ts keeps them equal.
const slots: Record<number, string> = {
  1: "#7368d4",
  2: "#b46400",
  3: "#009597",
  4: "#c6495b",
  5: "#0083ce",
  6: "#4d8e16",
  7: "#ad51a7",
  8: "#c4530f",
};

export function faceColor(
  color: string | undefined,
  slot: number | undefined,
): string {
  return color ?? slotHex(slot) ?? graphite;
}

export function slotHex(slot: number | undefined): string | undefined {
  return slot === undefined ? undefined : slots[slot];
}
