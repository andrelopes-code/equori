import { describe, expect, it } from "vitest";

import { appearancePreview } from "@/features/accounts/card-setup/card-appearance-preview";

describe("appearancePreview", () => {
  it("draws the name and the institution while no plastic card is set", () => {
    expect(
      appearancePreview({
        title: "Itaú Visa",
        logo: "/itau.png",
        institutionName: "Itaú",
        row: undefined,
      }),
    ).toEqual({
      title: "Itaú Visa",
      holder: "",
      virtual: false,
      logo: "/itau.png",
      institutionName: "Itaú",
    });
  });

  it("carries the first plastic card's holder, digits, kind and network", () => {
    expect(
      appearancePreview({
        title: "Itaú Visa",
        logo: undefined,
        institutionName: undefined,
        row: {
          holder: " Ana ",
          lastFour: "1234",
          virtual: true,
          network: "visa",
        },
      }),
    ).toEqual({
      title: "Itaú Visa",
      holder: "Ana",
      virtual: true,
      lastFour: "1234",
      network: "visa",
    });
  });
});
