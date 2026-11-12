// Percent text to basis points at one decimal place; undefined for text that is not a share.
export function parsePercent(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const percent = Number(text.replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return undefined;
  }

  return Math.round(percent * 10) * 10;
}

export function formatPercent(tag: string, bp: number): string {
  return new Intl.NumberFormat(tag, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bp / 100);
}
