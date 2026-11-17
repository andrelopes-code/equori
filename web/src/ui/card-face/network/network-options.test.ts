import { describe, expect, it } from "vitest";

import { networkOptions } from "@/ui/card-face/network/network-options";

describe("networkOptions", () => {
  const cases: [string, string | undefined, string | undefined, string[]][] = [
    [
      "a region without a case",
      "US",
      undefined,
      ["visa", "mastercard", "amex"],
    ],
    [
      "a region with extra networks",
      "BR",
      undefined,
      ["visa", "mastercard", "amex", "elo", "hipercard"],
    ],
    [
      "a stored network that is offered",
      "US",
      "visa",
      ["visa", "mastercard", "amex"],
    ],
    [
      "a stored network that is not offered",
      "US",
      "elo",
      ["visa", "mastercard", "amex", "elo"],
    ],
    ["an empty stored network", "US", "", ["visa", "mastercard", "amex"]],
  ];

  it.each(cases)("%s", (_name, region, stored, expected) => {
    expect(networkOptions(region, stored)).toEqual(expected);
  });
});
