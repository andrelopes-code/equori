import { describe, expect, it } from "vitest";

import {
  loadLogoIndex,
  logoOf,
  logoURL,
} from "@/features/accounts/institution-logo";

describe("logoURL", async () => {
  const index = await loadLogoIndex();

  it.each<[string, string | undefined, string | undefined]>([
    ["Nubank", "18236120", "18236120.png"],
    ["Mercado Pago", "10573521", "10573521.png"],
    [
      "a Sicoob affiliate uses the file of its system",
      "04715685",
      "04891850.png",
    ],
    ["an ISPB outside the catalogue", "99999999", undefined],
    ["no ISPB", undefined, undefined],
  ])("%s", (_, ispb, file) => {
    const url = logoURL(index, ispb);
    if (file === undefined) expect(url).toBeUndefined();
    else expect(url).toMatch(new RegExp(`${file.replace(".", "\\.")}$`));
  });
});

describe("logoOf", async () => {
  const index = await loadLogoIndex();

  it("resolves a br_ispb identifier to its PNG", () => {
    expect(
      logoOf({ scheme: "br_ispb", identifier: "00360305" }, index),
    ).toMatch(/00360305\.png$/);
  });

  it.each<[string, { scheme: string; identifier: string } | null]>([
    ["a scheme without a resolver", { scheme: "bic", identifier: "BOFAUS3N" }],
    ["no identifier", null],
  ])("returns undefined for %s", (_, id) => {
    expect(logoOf(id, index)).toBeUndefined();
  });

  it("returns undefined while the index is loading", () => {
    expect(
      logoOf({ scheme: "br_ispb", identifier: "00360305" }, undefined),
    ).toBeUndefined();
  });
});
