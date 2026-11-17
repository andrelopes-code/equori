import type { components } from "@/api/schema.gen";
import { measureOf } from "@/features/planning/income-split/bucket-draft";
import type { BucketMeasure } from "@/features/planning/income-split/bucket-draft";

type Version = components["schemas"]["BudgetBucketVersion"];
type Bucket = components["schemas"]["BudgetBucket"];

export type VersionChange =
  | { kind: "share"; id: string; name: string; before: number; after: number }
  | { kind: "renamed"; id: string; before: string; after: string }
  | {
      kind: "measure";
      id: string;
      name: string;
      before: BucketMeasure;
      after: BucketMeasure;
    }
  | { kind: "added"; id: string; name: string; share: number }
  | { kind: "removed"; id: string; name: string }
  // Bucket names; undefined is outside the split or following the parent.
  | {
      kind: "moved";
      categoryId: string;
      before: string | undefined;
      after: string | undefined;
    }
  | { kind: "ended" }
  | { kind: "started" };

// What next changes against prev, the version before it; buckets match by id (A241).
export function versionChanges(
  prev: Version | undefined,
  next: Version,
): VersionChange[] {
  if (next.buckets.length === 0) return [{ kind: "ended" }];
  if (prev === undefined || prev.buckets.length === 0)
    return [{ kind: "started" }];

  const before = new Map(prev.buckets.map((b) => [b.id, b]));
  const kept = new Set(next.buckets.map((b) => b.id));
  const changes = next.buckets.flatMap((b) =>
    bucketChanges(before.get(b.id), b),
  );
  for (const b of prev.buckets)
    if (!kept.has(b.id))
      changes.push({ kind: "removed", id: b.id, name: b.name });
  return [...changes, ...movedChanges(prev.buckets, next.buckets)];
}

function bucketChanges(
  before: Bucket | undefined,
  after: Bucket,
): VersionChange[] {
  if (before === undefined)
    return [
      { kind: "added", id: after.id, name: after.name, share: after.share_bp },
    ];
  const changes: VersionChange[] = [];
  if (before.name !== after.name)
    changes.push({
      kind: "renamed",
      id: after.id,
      before: before.name,
      after: after.name,
    });
  if (before.share_bp !== after.share_bp)
    changes.push({
      kind: "share",
      id: after.id,
      name: after.name,
      before: before.share_bp,
      after: after.share_bp,
    });
  if (measureOf(before) !== measureOf(after))
    changes.push({
      kind: "measure",
      id: after.id,
      name: after.name,
      before: measureOf(before),
      after: measureOf(after),
    });
  return changes;
}

function movedChanges(
  prev: readonly Bucket[],
  next: readonly Bucket[],
): VersionChange[] {
  const placement = (buckets: readonly Bucket[]) =>
    new Map(buckets.flatMap((b) => b.category_ids.map((c) => [c, b])));
  const was = placement(prev);
  const now = placement(next);
  return [...new Set([...was.keys(), ...now.keys()])]
    .sort()
    .filter((c) => was.get(c)?.id !== now.get(c)?.id)
    .map((c) => ({
      kind: "moved",
      categoryId: c,
      before: was.get(c)?.name,
      after: now.get(c)?.name,
    }));
}
