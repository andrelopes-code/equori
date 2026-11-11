import { describe, expect, it } from "vitest";

import type { AmountToneMode } from "@/theme/amounts";
import {
  amountTone,
  directionOf,
  type AmountDirection,
  type AmountKind,
  type AmountTextTone,
} from "@/ui/money/amount-tone";

describe("amountTone", () => {
  const cases: [
    AmountKind,
    AmountDirection,
    AmountToneMode,
    boolean,
    AmountTextTone,
  ][] = [
    ["flow", "in", "colour", false, "success"],
    ["flow", "out", "colour", false, "inherit"],
    ["flow", "none", "colour", false, "inherit"],
    ["result", "in", "colour", false, "success"],
    ["result", "out", "colour", false, "danger"],
    ["result", "none", "colour", false, "inherit"],
    ["flow", "in", "sign", false, "inherit"],
    ["result", "out", "sign", false, "inherit"],
    ["flow", "in", "colour", true, "inherit"],
    ["result", "out", "colour", true, "inherit"],
  ];

  it.each(cases)(
    "%s %s %s hidden=%s is %s",
    (kind, direction, mode, hidden, expected) => {
      expect(amountTone(kind, direction, mode, hidden)).toBe(expected);
    },
  );
});

describe("directionOf", () => {
  it.each([
    [125, "in"],
    [-1, "out"],
    [0, "none"],
  ] as const)("%s is %s", (amount, expected) => {
    expect(directionOf(amount)).toBe(expected);
  });
});
