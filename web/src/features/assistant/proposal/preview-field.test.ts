import { describe, expect, it } from "vitest";

import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";

const preview = {
  action: "record_transaction",
  changes: [
    { field: "amount", after: { text: "1" } },
    { field: "account", after: { text: "2" } },
    { field: "amount", after: { text: "3" } },
  ],
};

describe("preview-field", () => {
  it("returns the first change of a field", () => {
    expect(changeOf(preview, "amount")?.after?.text).toBe("1");
  });

  it("returns undefined for a field the preview does not name", () => {
    expect(changeOf(preview, "tags")).toBeUndefined();
  });

  it("keeps the changes outside the drawn fields in order", () => {
    expect(changesWithout(preview, ["amount"]).map((c) => c.field)).toEqual([
      "account",
    ]);
  });
});
