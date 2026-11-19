import { describe, expect, it } from "vitest";

import table from "@/features/calculators/model/address-keys.json";
import { writtenIds } from "@/features/calculators/model/calculators";

interface Folder {
  addressKeys: readonly string[];
  choices: Record<string, readonly string[]>;
}

interface Row {
  kind: string;
  values?: string[];
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

  it.each(writtenIds)(
    "%s reads each choice with the values of its row of the table",
    (id) => {
      const row: Record<string, Row> = table[id];
      const want = Object.fromEntries(
        Object.entries(row)
          .filter(([, key]) => key.kind === "choice")
          .map(([name, key]) => [name, key.values]),
      );

      expect(
        folders[`../${folderOf(id)}/address-keys.ts`]?.choices ?? {},
      ).toEqual(want);
    },
  );

  it("holds a row for every written calculator and no other", () => {
    expect(Object.keys(table).sort()).toEqual([...writtenIds].sort());
  });
});

function folderOf(id: string): string {
  return id === "indexer-comparison" ? id : `${id}-calculator`;
}
