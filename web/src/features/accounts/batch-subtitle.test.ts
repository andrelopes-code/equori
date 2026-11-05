import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import { batchSubtitle } from "@/features/accounts/batch-subtitle";

type ImportBatch = components["schemas"]["ImportBatch"];

const t: TFunction = (key, vars = {}) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name]));

const withoutPeriod = {
  id: "b1",
  account_id: "a1",
  source: "ofx",
  file_name: "setembro.ofx",
  started_at: "2026-10-01T12:00:00Z",
} as ImportBatch;

const fileBatch: ImportBatch = {
  ...withoutPeriod,
  period_from: "2026-09-01",
  period_to: "2026-09-30",
};

describe("batchSubtitle", () => {
  it.each([
    {
      name: "file batch with a period",
      batch: fileBatch,
      want: "Checking · 09/01/2026 to 09/30/2026 · imported on 10/01/2026",
    },
    {
      name: "batch without a period",
      batch: withoutPeriod,
      want: "Checking · imported on 10/01/2026",
    },
  ])("$name", ({ batch, want }) => {
    expect(batchSubtitle(batch, "Checking", "en-US", t)).toBe(want);
  });

  it("omits an unknown account name", () => {
    expect(batchSubtitle(fileBatch, undefined, "en-US", t)).toBe(
      "09/01/2026 to 09/30/2026 · imported on 10/01/2026",
    );
  });
});
