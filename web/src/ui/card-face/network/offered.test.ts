import { describe, expect, it } from "vitest";

import { offeredNetworks } from "@/ui/card-face/network/offered";

describe("offeredNetworks", () => {
  it("adds elo and hipercard for BR", () => {
    expect(offeredNetworks("BR")).toEqual([
      "visa",
      "mastercard",
      "amex",
      "elo",
      "hipercard",
    ]);
  });

  it("offers the international networks for US", () => {
    expect(offeredNetworks("US")).toEqual(["visa", "mastercard", "amex"]);
  });

  it("offers the international networks when the region is unset", () => {
    expect(offeredNetworks(undefined)).toEqual(["visa", "mastercard", "amex"]);
  });
});
