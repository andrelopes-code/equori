import { describe, expect, it } from "vitest";

import { plasticFaces } from "@/features/cards/plastic-cards-tab/plastic-card-faces";

const base = { title: "Nubank Mastercard", color: "#820ad1" };

describe("plasticFaces", () => {
  it("draws one face per card, in order, with the look of the account", () => {
    const faces = plasticFaces(
      [
        {
          id: "a",
          holder: "Ana",
          last_four: "1234",
          virtual: false,
          active: true,
          foreign_charge_bp: 438,
        },
        {
          id: "b",
          holder: "Bia",
          last_four: "9876",
          active: false,
          foreign_charge_bp: 438,
        },
      ],
      base,
    );

    expect(faces).toEqual([
      {
        id: "a",
        face: {
          ...base,
          holder: "Ana",
          lastFour: "1234",
          virtual: false,
          active: true,
        },
      },
      {
        id: "b",
        face: {
          ...base,
          holder: "Bia",
          lastFour: "9876",
          virtual: false,
          active: false,
        },
      },
    ]);
  });

  it("marks a virtual card", () => {
    const [face] = plasticFaces(
      [
        {
          id: "c",
          holder: "Ana",
          last_four: "0001",
          virtual: true,
          active: true,
          foreign_charge_bp: 0,
        },
      ],
      base,
    );

    expect(face?.face.virtual).toBe(true);
  });
});
