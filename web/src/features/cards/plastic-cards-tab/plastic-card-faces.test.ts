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

  it("draws the network of a card", () => {
    const [face] = plasticFaces(
      [
        {
          id: "d",
          holder: "Ana",
          last_four: "0002",
          active: true,
          network: "visa",
          foreign_charge_bp: 0,
        },
      ],
      base,
    );

    expect(face?.face.network).toBe("visa");
  });

  it("carries the appearance props to every face", () => {
    const faces = plasticFaces(
      [
        { id: "a", holder: "A", last_four: "1", active: true },
        { id: "b", holder: "B", last_four: "2", active: true },
      ].map((card) => ({ ...card, foreign_charge_bp: 0 })),
      { ...base, art: "waves", chip: "gold" },
    );

    expect(faces.map(({ face }) => [face.art, face.chip])).toEqual([
      ["waves", "gold"],
      ["waves", "gold"],
    ]);
  });
});
