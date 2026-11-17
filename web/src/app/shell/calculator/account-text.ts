import { numberFormatter } from "@/i18n/format";

// The account has two forms. The logical form is what the parser reads: digits, ".", "+", "-",
// "*", "/", "(", ")" and "%". The drawn form is what the field shows: the separators and signs
// of the tag, the digits in groups of three, a space on each side of an operator between two
// numbers. A caret is an index in one form or the other.

export interface Separators {
  decimal: string;
  group: string;
}

export interface Account {
  logical: string;
  caret: number;
}

export interface Drawn {
  text: string;
  caret: number;
}

// K10: the longest account.
const LIMIT = 60;

const MINUS = "−";

const DRAWN_SIGN: Record<string, string> = {
  "+": "+",
  "-": MINUS,
  "*": "×",
  "/": "÷",
};

const LOGICAL_SIGN: Record<string, string> = {
  "×": "*",
  "*": "*",
  x: "*",
  X: "*",
  "÷": "/",
  "/": "/",
  [MINUS]: "-",
  "-": "-",
  "+": "+",
  "(": "(",
  ")": ")",
  "%": "%",
};

// A character of the logical form and whether it stood before the caret.
interface Mark {
  char: string;
  before: boolean;
}

export function separatorsOf(tag: string): Separators {
  const marks = numberFormatter(tag, { minimumFractionDigits: 1 })
    .format(11111.5)
    .replace(/\d/g, "");

  return {
    decimal: marks.at(-1) ?? ".",
    group: marks.length > 1 ? (marks[0] ?? "") : "",
  };
}

// The edit the field reports, as the next account. An erased separator or space is decoration:
// the field's text loses nothing the parser reads, so the edit takes the character beside it.
export function change(
  previous: string,
  raw: string,
  rawCaret: number,
  inputType: string,
  data: string | null,
  separators: Separators,
): Account {
  // K12: a typed dot is the decimal key, whatever the tag groups with.
  const typedDot = inputType === "insertText" && data === ".";
  const text = typedDot
    ? `${raw.slice(0, rawCaret - 1)}${separators.decimal}${raw.slice(rawCaret)}`
    : raw;
  const { logical, caret } = read(text, rawCaret, separators);

  if (logical !== previous || !inputType.startsWith("delete")) {
    return normalize(logical, caret);
  }

  if (inputType.endsWith("Backward") && caret > 0) {
    return normalize(
      logical.slice(0, caret - 1) + logical.slice(caret),
      caret - 1,
    );
  }

  if (inputType.endsWith("Forward")) {
    return normalize(logical.slice(0, caret) + logical.slice(caret + 1), caret);
  }

  return normalize(logical, caret);
}

// K10: the logical form of a drawn or pasted text; every other character is dropped.
export function read(
  raw: string,
  rawCaret: number,
  separators: Separators,
): Account {
  const logical = (text: string) =>
    Array.from(text)
      .map((char) => logicalChar(char, separators))
      .join("");

  return {
    logical: logical(raw),
    caret: logical(raw.slice(0, rawCaret)).length,
  };
}

// Leaves an account the parser reads, or reads up to its last complete part: an operator
// replaces the operator before it, a parenthesis closes only one that is open, a number holds
// one decimal separator and no leading zero, and a number beside a parenthesis multiplies it.
export function normalize(logical: string, caret: number): Account {
  const marks: Mark[] = [];

  Array.from(logical).forEach((char, index) => {
    place(marks, char, index < caret);
  });

  const kept = marks.slice(0, LIMIT);

  return {
    logical: kept.map((mark) => mark.char).join(""),
    caret: kept.filter((mark) => mark.before).length,
  };
}

// K11: the drawn form, and the drawn caret that follows the same logical character.
export function render(
  logical: string,
  caret: number,
  separators: Separators,
): Drawn {
  const pieces = Array.from(logical).map((char, index) =>
    piece(logical, index, char, separators),
  );

  return {
    text: pieces.join(""),
    caret: pieces.slice(0, caret).join("").length,
  };
}

// K17: a plain decimal of rational.ts in the separators of the tag. Grouped, it is the text of
// the screen, with the minus sign of an amount; ungrouped, it is the text another program reads.
export function numberText(
  plain: string,
  separators: Separators,
  grouped: boolean,
): string {
  const negative = plain.startsWith("-");
  const [whole = "", fraction = ""] = plain.replace("-", "").split(".");
  const digits = grouped
    ? Array.from(whole).map((digit, index) =>
        groupedDigit(whole, index, digit, separators),
      )
    : [whole];
  const sign = grouped ? MINUS : "-";

  return [
    negative ? sign : "",
    ...digits,
    fraction === "" ? "" : `${separators.decimal}${fraction}`,
  ].join("");
}

// K22: the parenthesis key opens one when none is open or when a number must follow.
export function parenthesis(logical: string, caret: number): "(" | ")" {
  const before = logical.slice(0, caret);
  const open = count(before, "(") - count(before, ")");
  const last = before.at(-1) ?? "";

  return open > 0 && !"+-*/(".includes(last) ? ")" : "(";
}

function logicalChar(char: string, separators: Separators): string {
  if (/\d/.test(char)) return char;
  if (char === separators.decimal) return ".";

  return LOGICAL_SIGN[char] ?? "";
}

function place(marks: Mark[], char: string, before: boolean): void {
  const last = marks.at(-1)?.char ?? "";
  const afterValue = last === ")" || last === "%";
  const push = (next: string) => marks.push({ char: next, before });

  if (/\d/.test(char)) {
    if (afterValue) push("*");
    if (trailingNumber(marks) === "0") marks.pop();

    push(char);
  } else if (char === ".") {
    if (trailingNumber(marks).includes(".")) return;
    if (afterValue) push("*");

    push(char);
  } else if (char === "(") {
    if (afterValue || /[\d.]/.test(last)) push("*");

    push(char);
  } else if (char === ")") {
    const open = marks.filter((mark) => mark.char === "(").length;
    const closed = marks.filter((mark) => mark.char === ")").length;

    if (open > closed && !"+-*/(".includes(last)) push(char);
  } else if (char === "%") {
    if (/\d/.test(last) || last === ")") push(char);
  } else {
    placeOperator(marks, char, before);
  }
}

// A minus may stand before a number (at the start, after "(", "*" or "/"); any other operator
// needs a value on its left.
function placeOperator(marks: Mark[], char: string, before: boolean): void {
  const replaced = char === "-" ? "+-" : "+-*/";

  while (marks.length > 0 && replaced.includes(marks.at(-1)?.char ?? " ")) {
    marks.pop();
  }

  const last = marks.at(-1)?.char ?? "";
  const leading = last === "" || last === "(";

  if (char === "-" || !leading) marks.push({ char, before });
}

// The digits and separator of the number that ends the account, or "" when it ends otherwise.
function trailingNumber(marks: Mark[]): string {
  const text = marks.map((mark) => mark.char).join("");

  return /[\d.]*$/.exec(text)?.[0] ?? "";
}

function piece(
  logical: string,
  index: number,
  char: string,
  separators: Separators,
): string {
  if (char === ".") return separators.decimal;

  if (/\d/.test(char)) {
    // The integer part this digit belongs to, when it is not a decimal place.
    const start =
      index - (/\d*$/.exec(logical.slice(0, index))?.[0].length ?? 0);
    const whole = /^\d*/.exec(logical.slice(start))?.[0] ?? "";

    return logical[start - 1] === "."
      ? char
      : groupedDigit(whole, index - start, char, separators);
  }

  const sign = DRAWN_SIGN[char];
  if (sign === undefined) return char;

  // Between two values the operator stands apart; before a number it is its sign.
  return /[\d.)%]/.test(logical[index - 1] ?? "") ? ` ${sign} ` : sign;
}

// A digit of an integer part, preceded by the grouping separator at each third place.
function groupedDigit(
  whole: string,
  index: number,
  digit: string,
  separators: Separators,
): string {
  const opensGroup = index > 0 && (whole.length - index) % 3 === 0;

  return opensGroup ? `${separators.group}${digit}` : digit;
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
