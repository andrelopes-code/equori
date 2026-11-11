import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

// CalculatorMethod builds its keys from numbers; a gap in the numbering would show a key.
describe("calculator method keys", () => {
  it("numbers each part of each method from 1 without a gap", () => {
    for (const catalog of [catalogEn, catalogPtBR]) {
      const parts = new Map<string, number[]>();
      for (const key of Object.keys(catalog)) {
        const m =
          /^calc\.([a-z-]+)\.(step|formula|assumption|limit)(\d+)$/.exec(key);
        if (m === null) continue;
        const name = `${m[1] ?? ""}.${m[2] ?? ""}`;
        parts.set(name, [...(parts.get(name) ?? []), Number(m[3])]);
      }
      for (const [name, numbers] of parts) {
        const sorted = [...numbers].sort((a, b) => a - b);
        expect(sorted, name).toEqual(sorted.map((_, i) => i + 1));
      }
    }
  });
});
