// A typed text that is not a number or leaves the range; a field at rest is inside it.
export function outsideRange(
  text: string,
  value: number | null,
  min: number,
  max: number,
): boolean {
  return text.trim() !== "" && (value === null || value < min || value > max);
}
