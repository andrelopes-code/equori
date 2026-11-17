import { describe, expect, it } from "vitest";

import { evaluate } from "@/app/shell/calculator/evaluate";
import { decimalText } from "@/app/shell/calculator/rational";

describe("evaluate", () => {
  it.each(values)("reads %s as %s", (account, expected) => {
    const outcome = evaluate(account);

    expect(outcome.kind).toBe("value");
    expect(outcome.kind === "value" && decimalText(outcome.value)).toBe(
      expected,
    );
  });

  it.each(["", "(", "-", ")(", "1.5.2"])(
    "reads %j as no account",
    (account) => {
      expect(evaluate(account)).toEqual({ kind: "empty" });
    },
  );

  it.each([
    ["450/0", "division_by_zero"],
    ["1/(2-2)", "division_by_zero"],
    ["999999999999*10", "too_large"],
    ["-999999999999-1", "too_large"],
  ])("refuses %s as %s", (account, code) => {
    expect(evaluate(account)).toEqual({ kind: "error", code });
  });
});

const values = [
  // K14: order of the operators, parentheses, the minus before a number.
  ["1200*1.05-300", "960"],
  ["2+3*4", "14"],
  ["(2+3)*4", "20"],
  ["-5+2", "-3"],
  ["2*-3", "-6"],
  ["-(2+3)", "-5"],
  ["10/4", "2.5"],
  // G3: exact arithmetic.
  ["0.1+0.2", "0.3"],
  ["1/3*3", "1"],
  ["1234567.89*12/7-98765.43", "2017636.66714286"],
  // K15: percent.
  ["200+10%", "220"],
  ["200-10%", "180"],
  ["200*10%", "20"],
  ["50%", "0.5"],
  ["200+10%+10%", "242"],
  // K16: the last complete part.
  ["12+", "12"],
  ["2*(3+4", "14"],
  ["2*(", "2"],
  ["2*(3+", "6"],
  // K17: decimal places, significant digits, rounding away from zero.
  ["1/3", "0.3333333333"],
  ["2/3", "0.6666666667"],
  ["-2/3", "-0.6666666667"],
  ["999999999999", "999999999999"],
  ["123456789012/7", "17636684144.5714"],
  [".5+1.", "1.5"],
] as const;
