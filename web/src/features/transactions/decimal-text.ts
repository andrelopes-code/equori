// Integer units of a scale as exact decimal text, by string manipulation (O7). A quantity is not a
// monetary value, so it reaches the screen unmasked.
export function decimalText(amount: number, scale: number): string {
  const digits = Math.abs(amount)
    .toString()
    .padStart(scale + 1, "0");
  const sign = amount < 0 ? "-" : "";
  if (scale === 0) return sign + digits;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
