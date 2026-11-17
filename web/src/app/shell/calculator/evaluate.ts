import {
  add,
  divide,
  integerDigits,
  multiply,
  negate,
  rational,
  subtract,
} from "@/app/shell/calculator/rational";
import type { Rational } from "@/app/shell/calculator/rational";

export type ErrorCode = "division_by_zero" | "too_large";

export type Outcome =
  | { kind: "empty" }
  | { kind: "value"; value: Rational }
  | { kind: "error"; code: ErrorCode };

// K18: the integer part of a result holds at most this many digits.
const INTEGER_DIGITS = 12;

const HUNDRED = rational("100");

// A term and whether it is one percentage ("10%"), which an addition reads as a share of its
// left side (K15).
interface Term {
  value: Rational;
  percent: boolean;
}

class DivisionByZero extends Error {}

class Unreadable extends Error {}

// Reads an account written with digits, ".", "+", "-", "*", "/", "(", ")" and "%".
export function evaluate(account: string): Outcome {
  // K16: an operator or an opening parenthesis at the end waits for its number.
  const complete = account.replace(/[-+*/(]+$/, "");

  if (complete === "") return { kind: "empty" };

  try {
    const reader = new Reader(complete);
    const value = reader.sum();

    if (!reader.done()) return { kind: "empty" };
    if (integerDigits(value) > INTEGER_DIGITS) {
      return { kind: "error", code: "too_large" };
    }

    return { kind: "value", value };
  } catch (error) {
    if (error instanceof DivisionByZero) {
      return { kind: "error", code: "division_by_zero" };
    }
    if (error instanceof Unreadable) return { kind: "empty" };

    throw error;
  }
}

// A recursive descent over the account: sum, product, factor, primary.
class Reader {
  private at = 0;

  constructor(private readonly text: string) {}

  done(): boolean {
    return this.at === this.text.length;
  }

  sum(): Rational {
    let left = this.product().value;

    for (;;) {
      const sign = this.take("+", "-");
      if (sign === null) return left;

      const right = this.product();
      const amount = right.percent ? multiply(left, right.value) : right.value;

      left = sign === "+" ? add(left, amount) : subtract(left, amount);
    }
  }

  private product(): Term {
    let left = this.factor();

    for (;;) {
      const sign = this.take("*", "/");
      if (sign === null) return left;

      const right = this.factor().value;

      left = {
        value:
          sign === "*"
            ? multiply(left.value, right)
            : quotient(left.value, right),
        percent: false,
      };
    }
  }

  private factor(): Term {
    if (this.take("-") !== null) {
      const inner = this.factor();

      return { value: negate(inner.value), percent: inner.percent };
    }

    let value = this.primary();
    let percent = false;

    while (this.take("%") !== null) {
      value = quotient(value, HUNDRED);
      percent = true;
    }

    return { value, percent };
  }

  private primary(): Rational {
    if (this.take("(") !== null) {
      const inner = this.sum();

      // K16: a parenthesis left open closes at the end of the account.
      if (this.take(")") === null && !this.done()) throw new Unreadable();

      return inner;
    }

    const number = /^(\d+\.?\d*|\.\d+)/.exec(this.text.slice(this.at));
    if (number === null) throw new Unreadable();

    this.at += number[0].length;

    return rational(number[0]);
  }

  private take(...signs: string[]): string | null {
    const sign = this.text[this.at];
    if (sign === undefined || !signs.includes(sign)) return null;

    this.at += 1;

    return sign;
  }
}

function quotient(a: Rational, b: Rational): Rational {
  const result = divide(a, b);
  if (result === null) throw new DivisionByZero();

  return result;
}
