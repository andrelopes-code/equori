import { describe, expect, it } from "vitest";

import {
  change,
  normalize,
  numberText,
  parenthesis,
  read,
  render,
  separatorsOf,
} from "@/app/shell/calculator/account-text";

const pt = separatorsOf("pt-BR");
const en = separatorsOf("en-US");

describe("separatorsOf", () => {
  it("reads the separators of the tag", () => {
    expect(pt).toEqual({ decimal: ",", group: "." });
    expect(en).toEqual({ decimal: ".", group: "," });
  });
});

describe("normalize", () => {
  it.each(normalized)("writes %s as %s", (typed, expected) => {
    expect(normalize(typed, typed.length).logical).toBe(expected);
  });

  it("keeps the caret after the character it followed", () => {
    expect(normalize("12+*3", 4)).toEqual({ logical: "12*3", caret: 3 });
    expect(normalize("2(3", 2)).toEqual({ logical: "2*(3", caret: 3 });
    expect(normalize("007", 1)).toEqual({ logical: "7", caret: 0 });
  });

  it("holds at most 60 characters", () => {
    expect(normalize("1".repeat(61), 61)).toEqual({
      logical: "1".repeat(60),
      caret: 60,
    });
  });
});

describe("render", () => {
  it.each(rendered)("draws %s at %i in %s as %s at %i", (...row) => {
    const [logical, caret, tag, text, drawn] = row;

    expect(render(logical, caret, tag === "pt" ? pt : en)).toEqual({
      text,
      caret: drawn,
    });
  });
});

describe("read", () => {
  it.each([
    ["1.200,50 × 2", 5, pt, "1200.50*2", 4],
    ["R$ 1.200,50", 11, pt, "1200.50", 7],
    ["1,200.50", 8, en, "1200.50", 7],
    ["2 x 3", 5, en, "2*3", 3],
    ["8 − 3 ÷ 2", 9, pt, "8-3/2", 5],
  ] as const)("reads %j at %i", (raw, caret, tag, logical, read_) => {
    expect(read(raw, caret, tag)).toEqual({ logical, caret: read_ });
  });
});

describe("change", () => {
  it("removes the digit before a grouping separator the reader erased", () => {
    // "1.|200" with Backspace leaves "1|200" in the field.
    expect(
      change("1200", "1200", 1, "deleteContentBackward", null, pt),
    ).toEqual({ logical: "200", caret: 0 });
  });

  it("removes the operator whose space the reader erased", () => {
    // "12 + |3" with Backspace leaves "12 +|3".
    expect(
      change("12+3", "12 +3", 4, "deleteContentBackward", null, pt),
    ).toEqual({ logical: "123", caret: 2 });
    // "12| + 3" with Delete leaves "12|+ 3".
    expect(
      change("12+3", "12+ 3", 2, "deleteContentForward", null, pt),
    ).toEqual({ logical: "123", caret: 2 });
  });

  it("writes a typed dot as the decimal separator of the tag (K12)", () => {
    expect(change("12", "12.", 3, "insertText", ".", pt)).toEqual({
      logical: "12.",
      caret: 3,
    });
    expect(change("12", "12.", 3, "insertText", ".", en)).toEqual({
      logical: "12.",
      caret: 3,
    });
  });

  it("drops the grouping separators of a pasted number (K10)", () => {
    expect(change("", "1.200,50", 8, "insertFromPaste", null, pt)).toEqual({
      logical: "1200.50",
      caret: 7,
    });
    expect(change("12", "12,", 3, "insertText", ",", en)).toEqual({
      logical: "12",
      caret: 2,
    });
  });
});

describe("numberText", () => {
  it.each([
    ["2017636.66714286", pt, true, "2.017.636,66714286"],
    ["-2017636.66714286", pt, true, "−2.017.636,66714286"],
    ["-2017636.66714286", pt, false, "-2017636,66714286"],
    ["960", en, true, "960"],
    ["-0.5", en, true, "−0.5"],
    ["1200.5", en, true, "1,200.5"],
  ] as const)("writes %s", (plain, tag, grouped, expected) => {
    expect(numberText(plain, tag, grouped)).toBe(expected);
  });
});

describe("parenthesis", () => {
  it.each([
    ["", 0, "("],
    ["2*", 2, "("],
    ["(", 1, "("],
    ["(1+2", 4, ")"],
    ["(1+2)", 5, "("],
    ["(1+", 3, "("],
    ["((1+2)", 6, ")"],
  ] as const)("chooses for %j at %i: %s", (logical, caret, expected) => {
    expect(parenthesis(logical, caret)).toBe(expected);
  });
});

const normalized = [
  ["12+*", "12*"],
  ["*5", "5"],
  ["2*-3", "2*-3"],
  ["2+-3", "2-3"],
  ["2*-+3", "2+3"],
  ["1)", "1"],
  ["(1)", "(1)"],
  ["(+1)", "(1)"],
  ["()", "("],
  ["2(", "2*("],
  ["(2)3", "(2)*3"],
  ["5%2", "5%*2"],
  ["1.2.3", "1.23"],
  ["007", "7"],
  ["0.5", "0.5"],
  ["10", "10"],
  ["5%%", "5%"],
  ["+%", ""],
  ["(1+2)%", "(1+2)%"],
  ["-5", "-5"],
  ["--5", "-5"],
] as const;

const rendered = [
  ["1200*1.05-300", 13, "pt", "1.200 × 1,05 − 300", 18],
  ["1200*1.05-300", 13, "en", "1,200 × 1.05 − 300", 18],
  ["1200", 1, "pt", "1.200", 1],
  ["1200", 2, "pt", "1.200", 3],
  ["12+", 3, "pt", "12 + ", 5],
  ["12+3", 2, "pt", "12 + 3", 2],
  ["2*-3", 4, "pt", "2 × −3", 6],
  ["-5", 2, "pt", "−5", 2],
  ["(1+2)*3", 7, "pt", "(1 + 2) × 3", 11],
  ["1234567.891", 11, "pt", "1.234.567,891", 13],
  [".5", 2, "pt", ",5", 2],
  ["200+10%", 7, "pt", "200 + 10%", 9],
  ["", 0, "pt", "", 0],
] as const;
