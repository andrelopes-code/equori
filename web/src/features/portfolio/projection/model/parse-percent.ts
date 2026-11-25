// A percent typed with a comma or a dot, in basis points.
export function parseBasisPoints(text: string): number | null {
  const dotted = text.trim().replace("\u2212", "-").replace(",", ".");

  return /^-?\d+(\.\d+)?$/.test(dotted)
    ? Math.round(Number(dotted) * 100)
    : null;
}
