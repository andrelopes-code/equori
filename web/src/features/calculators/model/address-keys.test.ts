import { describe, expect, it } from "vitest";

import table from "@/features/calculators/model/address-keys.json";
import { writtenIds } from "@/features/calculators/model/calculators";

interface Folder {
  addressKeys: readonly string[];
}

// One module per calculator folder.
const folders = import.meta.glob<Folder>("../*/address-keys.ts", {
  eager: true,
});

describe("address keys", () => {
  it.each(writtenIds)("%s declares the keys of its row of the table", (id) => {
    const folder = folders[`../${folderOf(id)}/address-keys.ts`];

    expect(folder).toBeDefined();
    expect([...(folder?.addressKeys ?? [])].sort()).toEqual(
      Object.keys(table[id]).sort(),
    );
  });

  it("holds a row for every written calculator and no other", () => {
    expect(Object.keys(table).sort()).toEqual([...writtenIds].sort());
  });
});

function folderOf(id: string): string {
  return id === "indexer-comparison" ? id : `${id}-calculator`;
}
