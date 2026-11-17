import { describe, expect, it } from "vitest";

import { networkName } from "@/ui/card-face/network/network-name";

const t = (key: string) => `t:${key}`;

describe("networkName", () => {
  it("names each known key from the catalog", () => {
    expect(
      ["visa", "mastercard", "amex", "elo", "hipercard"].map((key) =>
        networkName(key, t),
      ),
    ).toEqual([
      "t:cardFace.network.visa",
      "t:cardFace.network.mastercard",
      "t:cardFace.network.amex",
      "t:cardFace.network.elo",
      "t:cardFace.network.hipercard",
    ]);
  });

  it("keeps the raw key of another stored network", () => {
    expect(networkName("diners", t)).toBe("diners");
    expect(networkName("constructor", t)).toBe("constructor");
  });

  it("names the absence of a network", () => {
    expect(networkName(undefined, t)).toBe("t:card.network.none");
  });
});
