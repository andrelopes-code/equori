import { describe, expect, it } from "vitest";

import { searchEntities } from "@/features/accounts/catalogue-search";

const entities = Array.from({ length: 45 }, (_, i) => ({
  id: `e${String(i)}`,
  label: i === 3 ? "Itaú Unibanco" : `Banco ${String(i).padStart(2, "0")}`,
  description: i === 3 ? "ITAÚ UNIBANCO S.A." : `BANCO ${String(i)} S.A.`,
  meta: i === 3 ? "341" : String(100 + i),
}));

describe("searchEntities", () => {
  it("answers one page at a time and says when more follow", () => {
    const first = searchEntities(entities, "", 0, 20);
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    const last = searchEntities(entities, "", 2, 20);
    expect(last.items).toHaveLength(5);
    expect(last.hasMore).toBe(false);
  });

  it("matches the name without accents, the legal name and the code", () => {
    expect(
      searchEntities(entities, "itau", 0, 20).items.map((e) => e.id),
    ).toEqual(["e3"]);
    expect(
      searchEntities(entities, "unibanco s.a", 0, 20).items.map((e) => e.id),
    ).toEqual(["e3"]);
    expect(
      searchEntities(entities, "341", 0, 20).items.map((e) => e.id),
    ).toEqual(["e3"]);
  });
});
