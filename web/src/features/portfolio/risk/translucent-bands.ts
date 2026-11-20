// Workaround for Slotted issue #154: the engine takes a band's tone to 12% alpha only when the
// tone resolves to rgb(), and the equori theme resolves tones to oklch(), so the band is drawn
// opaque over the lines. The option is the engine's, read as loose data.
const bandAlpha = 0.12;

export function translucentBands(
  option: Record<string, unknown>,
): Record<string, unknown> {
  const series = option.series;
  if (!Array.isArray(series)) return option;

  for (const s of series as Record<string, unknown>[]) {
    const area = s.markArea as
      { data?: { itemStyle?: { color?: unknown } }[][] } | undefined;

    for (const [start] of area?.data ?? []) {
      const color = start?.itemStyle?.color;
      if (start?.itemStyle && typeof color === "string") {
        start.itemStyle.color = withAlpha(color, bandAlpha);
      }
    }
  }

  return option;
}

// withAlpha writes an oklch() colour with an alpha; any other colour is returned as it came.
export function withAlpha(color: string, alpha: number): string {
  const oklch = /^oklch\(([^/)]+)\)$/.exec(color.trim());

  const channels = oklch?.[1];

  return channels === undefined
    ? color
    : `oklch(${channels.trim()} / ${String(alpha)})`;
}
