// A money field types like a till: every digit enters at the right as the smallest unit, so
// "1234" is 12,34 at scale 2 and the reader never types a separator. The value is the integer
// of minor units the digits spell (O7); anything else in the text is ignored.
export function minorFromTyped(text: string, maxDigits: number): number {
  const digits = text.replace(/\D/g, "").slice(0, maxDigits);
  return digits === "" ? 0 : Number(digits);
}
