// An exact fraction: the denominator is positive and shares no factor with the numerator.
export interface Rational {
  num: bigint;
  den: bigint;
}

const DECIMAL_PLACES = 10;
const SIGNIFICANT_DIGITS = 15;

// Reads a plain decimal ("12.5", ".5", "1.").
export function rational(text: string): Rational {
  const [whole = "", fraction = ""] = text.split(".");

  return reduce(
    BigInt(`${whole}${fraction}` || "0"),
    10n ** BigInt(fraction.length),
  );
}

export function add(a: Rational, b: Rational): Rational {
  return reduce(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function subtract(a: Rational, b: Rational): Rational {
  return add(a, negate(b));
}

export function multiply(a: Rational, b: Rational): Rational {
  return reduce(a.num * b.num, a.den * b.den);
}

// Null when the divisor is zero.
export function divide(a: Rational, b: Rational): Rational | null {
  if (b.num === 0n) return null;

  return reduce(a.num * b.den, a.den * b.num);
}

export function negate(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

// The number of digits of the integer part, at least one.
export function integerDigits(a: Rational): number {
  return (magnitude(a.num) / a.den).toString().length;
}

// K17: a plain decimal with at most 10 places and 15 significant digits, rounded half away from
// zero, without trailing zeros; "." is the separator and "-" the sign.
export function decimalText(a: Rational): string {
  const places = Math.min(
    DECIMAL_PLACES,
    Math.max(0, SIGNIFICANT_DIGITS - integerDigits(a)),
  );
  const scaled =
    (magnitude(a.num) * 10n ** BigInt(places) * 2n + a.den) / (a.den * 2n);

  if (scaled === 0n) return "0";

  const digits = scaled.toString().padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const fraction = digits.slice(digits.length - places).replace(/0+$/, "");
  const sign = a.num < 0n ? "-" : "";

  return fraction === "" ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

function reduce(num: bigint, den: bigint): Rational {
  const sign = den < 0n ? -1n : 1n;
  const factor = divisor(magnitude(num), magnitude(den));

  return { num: (sign * num) / factor, den: (sign * den) / factor };
}

function divisor(a: bigint, b: bigint): bigint {
  let [x, y] = [a, b];

  while (y !== 0n) [x, y] = [y, x % y];

  return x === 0n ? 1n : x;
}

function magnitude(value: bigint): bigint {
  return value < 0n ? -value : value;
}
