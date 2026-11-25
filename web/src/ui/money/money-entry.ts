// A money field types like a till: every digit enters at the right as the smallest unit, so
// "1234" is 12,34 at scale 2 and the reader never types a separator. The value is the integer
// of minor units the digits spell (O7); anything else in the text is ignored.
export function minorFromTyped(text: string, maxDigits: number): number {
  const digits = digitsOf(text).slice(0, maxDigits);
  return digits === "" ? 0 : Number(digits);
}

// The digits of a field after an edit, parted by the caret.
export interface MoneyEdit {
  head: string;
  tail: string;
}

// The edit that turned the text before into the text after, with the caret where the browser left
// it. Zeros stay on the right of the caret, so the first digit of 10.000,00 is exchanged without
// the rest of the amount falling to zero. A separator is not a digit: erasing one erases the digit
// on its far side.
export function moneyEdit(
  before: string,
  after: string,
  caret: number,
  forward: boolean,
  maxDigits: number,
): MoneyEdit {
  let head = digitsOf(after.slice(0, caret));
  let tail = digitsOf(after.slice(caret));

  if (after.length < before.length && head + tail === digitsOf(before)) {
    if (forward) tail = tail.slice(1);
    else head = head.slice(0, -1);
  }

  head = head.replace(/^0+/, "");

  return { head: head.slice(0, Math.max(maxDigits - tail.length, 0)), tail };
}

// The position in a text that leaves that many digits on its right, next to the digit before it.
export function caretBefore(text: string, digits: number): number {
  let position = text.length;
  let left = digits;
  while (position > 0 && (left > 0 || !isDigit(text.charAt(position - 1)))) {
    position -= 1;
    if (isDigit(text.charAt(position))) left -= 1;
  }

  return position;
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

function isDigit(character: string): boolean {
  return /\d/.test(character);
}
