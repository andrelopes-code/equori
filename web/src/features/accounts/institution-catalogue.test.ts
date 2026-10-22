import { describe, expect, it } from "vitest";

import {
  catalogueEntries,
  displayName,
  sortInstitutions,
} from "@/features/accounts/institution-catalogue";
import type { LogoIndex } from "@/features/accounts/institution-logo";

describe("displayName", () => {
  it.each([
    ["NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO", "Nu Pagamentos"],
    ["ITAÚ UNIBANCO S.A.", "Itaú Unibanco"],
    ["Banco do Brasil S.A.", "Banco do Brasil"],
    ["BANCO SANTANDER (BRASIL) S.A.", "Banco Santander (Brasil)"],
    ["CAIXA ECONOMICA FEDERAL", "Caixa Economica Federal"],
    ["BANCO DA AMAZONIA S.A.", "Banco da Amazonia"],
    ["XP INVESTIMENTOS CCTVM S/A", "XP Investimentos CCTVM"],
  ])("reads %s as %s", (legal, want) => {
    expect(displayName(legal)).toBe(want);
  });
});

describe("catalogueEntries", () => {
  const index: LogoIndex = {
    "60701190": ["341", "ITAÚ UNIBANCO S.A.", 3],
    "18236120": ["260", "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO", 3],
    "00000000": ["001", "Banco do Brasil S.A.", 3],
    "10143499": [null, "CCLA JATAÍ E REGIÃO", 0],
  };

  it("lists the entries with a logo by name, without the ones the owner has", () => {
    expect(catalogueEntries(index, [{ ispb: "18236120" }], "pt-BR")).toEqual([
      {
        ispb: "00000000",
        code: "001",
        name: "Banco do Brasil",
        legalName: "Banco do Brasil S.A.",
      },
      {
        ispb: "60701190",
        code: "341",
        name: "Itaú Unibanco",
        legalName: "ITAÚ UNIBANCO S.A.",
      },
    ]);
  });
});

describe("sortInstitutions", () => {
  it("collates by the given locale", () => {
    expect(sortInstitutions(["Ålandsbanken", "Zeta", "Aba"], "sv-SE")).toEqual([
      "Aba",
      "Zeta",
      "Ålandsbanken",
    ]);
    expect(sortInstitutions(["Ålandsbanken", "Zeta", "Aba"], "en-US")).toEqual([
      "Aba",
      "Ålandsbanken",
      "Zeta",
    ]);
  });
});
