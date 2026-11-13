import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

// The contract lists every Problem.code in the description of the field; tests run from web/.
const shared = readFileSync("../api/shared.yaml", "utf8");

describe("problem codes", () => {
  it("gives every code of the contract its words in each catalog", () => {
    const codes = problemCodes(shared);
    const catalogs = { en: catalogEn, "pt-BR": catalogPtBR };

    const missing = Object.entries(catalogs).flatMap(([tag, catalog]) =>
      codes
        .filter((code) => !(`problem.${code}` in catalog))
        .map((code) => `${tag} ${code}`),
    );

    expect(codes.length).toBeGreaterThan(80);
    expect(missing).toEqual([]);
  });
});

function problemCodes(yaml: string): string[] {
  const values = /Stable error identifier\. Values: ([^.]+)\./.exec(yaml)?.[1];
  if (values === undefined) {
    throw new Error("the code list is missing from api/shared.yaml");
  }

  return values.split(",").map((code) => code.trim());
}
