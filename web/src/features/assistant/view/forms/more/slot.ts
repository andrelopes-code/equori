// The categorical colour of the i-th series: the theme's eight slots, then the neutral of "the rest".
export function slot(i: number): string {
  return i < 8
    ? `var(--equori-slot-${String(i + 1)})`
    : "color-mix(in oklab, var(--slotted-text) 34%, transparent)";
}
