import { describe, expect, it } from "vitest";

import { previewFace } from "@/features/cards/card-appearance/preview-face";

const institution = { id: "i1", identifier: "nubank", name: "Nubank" } as never;
const plastic = {
  id: "pc1",
  holder: "Ana",
  last_four: "1234",
  network: "visa",
  virtual: false,
  active: true,
} as never;

describe("previewFace", () => {
  it("carries the account and the plastic card", () => {
    expect(previewFace("Roxinho", institution, "nubank", plastic)).toEqual({
      title: "Roxinho",
      holder: "Ana",
      logo: "nubank",
      institutionName: "Nubank",
      lastFour: "1234",
      network: "visa",
    });
  });

  it("leaves out what is absent", () => {
    expect(previewFace("Roxinho", undefined, undefined, undefined)).toEqual({
      title: "Roxinho",
      holder: "",
    });
  });
});
