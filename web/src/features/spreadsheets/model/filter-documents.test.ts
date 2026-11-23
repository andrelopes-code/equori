import { describe, expect, it } from "vitest";

import type { SpreadsheetSummary } from "@/features/spreadsheets/api";
import { filterDocuments } from "@/features/spreadsheets/model/filter-documents";

function doc(name: string): SpreadsheetSummary {
  return {
    id: name,
    name,
    version: 1,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
  };
}

const documents = [doc("Orçamento 2027"), doc("Trip to Lisbon"), doc("IPTU")];

describe("filterDocuments", () => {
  it.each([
    ["", ["Orçamento 2027", "Trip to Lisbon", "IPTU"]],
    ["  ", ["Orçamento 2027", "Trip to Lisbon", "IPTU"]],
    ["orcamento", ["Orçamento 2027"]],
    ["ORÇA", ["Orçamento 2027"]],
    ["t", ["Orçamento 2027", "Trip to Lisbon", "IPTU"]],
    ["lis", ["Trip to Lisbon"]],
    ["xyz", []],
  ])("query %j keeps %j", (query, names) => {
    expect(
      filterDocuments(documents, query, "pt-BR").map((d) => d.name),
    ).toEqual(names);
  });
});
