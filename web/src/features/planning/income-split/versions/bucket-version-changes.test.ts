import { describe, expect, it } from "vitest";

import { versionChanges } from "@/features/planning/income-split/versions/bucket-version-changes";

const bucket = (
  id: string,
  name: string,
  share_bp: number,
  category_ids: string[] = [],
  at_least = false,
) => ({
  id,
  name,
  share_bp,
  takes_savings: false,
  takes_goals: false,
  at_least,
  category_ids,
});
const version = (from: string, buckets: ReturnType<typeof bucket>[]) => ({
  from,
  buckets,
});

describe("versionChanges", () => {
  it("lists what a version changed against the one before", () => {
    const prev = version("2026-09", [
      bucket("a", "A", 5000, ["c1"]),
      bucket("b", "B", 5000, ["c2"]),
    ]);
    const next = version("2026-10", [
      bucket("a", "Fixed", 6000, ["c1", "c2"]),
      bucket("c", "C", 4000),
    ]);

    expect(versionChanges(prev, next)).toEqual([
      { kind: "renamed", id: "a", before: "A", after: "Fixed" },
      { kind: "share", id: "a", name: "Fixed", before: 5000, after: 6000 },
      { kind: "added", id: "c", name: "C", share: 4000 },
      { kind: "removed", id: "b", name: "B" },
      { kind: "moved", categoryId: "c2", before: "B", after: "Fixed" },
    ]);
  });

  it("states the measure of a bucket that counts differently", () => {
    const prev = version("2026-09", [bucket("a", "A", 10000)]);
    const next = version("2026-10", [bucket("a", "A", 10000, [], true)]);

    expect(versionChanges(prev, next)).toEqual([
      {
        kind: "measure",
        id: "a",
        name: "A",
        before: "ceiling",
        after: "floor",
      },
    ]);
  });

  it("states a category that left the split as moved to outside", () => {
    const prev = version("2026-09", [bucket("a", "A", 10000, ["c1"])]);
    const next = version("2026-10", [bucket("a", "A", 10000)]);

    expect(versionChanges(prev, next)).toEqual([
      { kind: "moved", categoryId: "c1", before: "A", after: undefined },
    ]);
  });

  it("returns started when no bucket came before", () => {
    const next = version("2026-09", [bucket("a", "A", 10000)]);

    expect(versionChanges(undefined, next)).toEqual([{ kind: "started" }]);
    expect(versionChanges(version("2026-08", []), next)).toEqual([
      { kind: "started" },
    ]);
  });

  it("returns ended for a version without buckets", () => {
    const prev = version("2026-09", [bucket("a", "A", 10000)]);

    expect(versionChanges(prev, version("2026-10", []))).toEqual([
      { kind: "ended" },
    ]);
  });

  it("returns nothing when nothing changed", () => {
    const prev = version("2026-09", [bucket("a", "A", 10000, ["c1"])]);
    const next = version("2026-10", [bucket("a", "A", 10000, ["c1"])]);

    expect(versionChanges(prev, next)).toEqual([]);
  });
});
