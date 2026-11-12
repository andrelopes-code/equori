export const meterSegments = 14;

export function litSegments(
  creditLimit: number | undefined,
  freeLimit: number | undefined,
): number | null {
  if (
    creditLimit === undefined ||
    freeLimit === undefined ||
    creditLimit <= 0
  ) {
    return null;
  }

  const used = Math.min(Math.max(1 - freeLimit / creditLimit, 0), 1);

  return Math.round(used * meterSegments);
}
