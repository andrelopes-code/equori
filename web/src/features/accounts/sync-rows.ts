import type { components } from "@/api/schema.gen";
import { syncCounts } from "@/features/accounts/sync-counts";

type ImportBatch = components["schemas"]["ImportBatch"];
type SyncRun = components["schemas"]["SyncRun"];

export interface SyncRow {
  key: string;
  startedAt: string;
  // The batch that changed something; absent on the one row of a sync that changed nothing.
  batch?: ImportBatch;
}

// The rows a sync adds to the table of syncs: one for each account it changed, or one for the
// whole sync when it changed none.
export function syncRows(run: SyncRun): SyncRow[] {
  const changed = run.batches.filter((b) => syncCounts(b.counts).length > 0);

  if (changed.length === 0) {
    return [{ key: run.sync_id, startedAt: run.started_at }];
  }

  return changed.map((batch) => ({
    key: batch.id,
    startedAt: run.started_at,
    batch,
  }));
}
