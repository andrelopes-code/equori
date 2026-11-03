import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { syncRows } from "@/features/accounts/sync-rows";

type ImportBatch = components["schemas"]["ImportBatch"];
type SyncRun = components["schemas"]["SyncRun"];

function batch(id: string, created: number): ImportBatch {
  return {
    id,
    account_id: `account-${id}`,
    source: "aggregator",
    counts: {
      received: 0,
      ignored: 0,
      matched: 0,
      created,
      needs_review: 0,
      discarded: 0,
      updated: 0,
      withdrawn: 0,
      re_identified: 0,
    },
    balance: { status: "none" },
    started_at: "2026-11-01T12:53:00Z",
  };
}

function run(batches: ImportBatch[]): SyncRun {
  return {
    sync_id: "s1",
    started_at: "2026-11-01T12:53:00Z",
    batches,
    records: [],
  };
}

describe("syncRows", () => {
  it("keeps one row for each account that changed", () => {
    const rows = syncRows(run([batch("a", 1), batch("b", 0), batch("c", 2)]));

    expect(rows.map((r) => r.key)).toEqual(["a", "c"]);
    expect(rows.map((r) => r.batch?.id)).toEqual(["a", "c"]);
  });

  it("keeps one row without a batch when nothing changed", () => {
    const rows = syncRows(run([batch("a", 0), batch("b", 0)]));

    expect(rows).toEqual([{ key: "s1", startedAt: "2026-11-01T12:53:00Z" }]);
  });

  it("keeps one row without a batch for a sync with no batches", () => {
    expect(syncRows(run([]))).toHaveLength(1);
  });
});
