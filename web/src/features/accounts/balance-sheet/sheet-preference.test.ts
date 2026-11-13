import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readSheetPreference,
  writeSheetPreference,
} from "@/features/accounts/balance-sheet/sheet-preference";

beforeEach(() => {
  localStorage.clear();
});

describe("sheet preference", () => {
  it("is the grouping by type and the order by balance when nothing was kept", () => {
    expect(readSheetPreference()).toEqual({ group: "kind", order: "balance" });
  });

  it("reads what was written", () => {
    writeSheetPreference({ group: "institution", order: "attention" });

    expect(readSheetPreference()).toEqual({
      group: "institution",
      order: "attention",
    });
  });

  it.each([
    ["not JSON", "{"],
    ["not an object", "[]"],
    ["unknown values", '{"group":"bank","order":"size"}'],
  ])("falls back to the defaults on %s", (_name, raw) => {
    localStorage.setItem("equori.accounts.sheet", raw);

    expect(readSheetPreference()).toEqual({ group: "kind", order: "balance" });
  });

  it("keeps the valid half of a half-valid value", () => {
    localStorage.setItem(
      "equori.accounts.sheet",
      '{"group":"none","order":"size"}',
    );

    expect(readSheetPreference()).toEqual({ group: "none", order: "balance" });
  });

  it("keeps the choice for the visit when the browser refuses storage", () => {
    const refuse = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    try {
      expect(() => {
        writeSheetPreference({ group: "none", order: "name" });
      }).not.toThrow();
    } finally {
      refuse.mockRestore();
    }
  });
});
