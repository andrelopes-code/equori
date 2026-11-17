import { describe, expect, it } from "vitest";

import {
  fromChoices,
  fromLabelKey,
  lastMonthOf,
  nextFrom,
  periodKey,
  versionAt,
  versionRecordAt,
} from "@/features/planning/income-split/bucket-versions";

const bucket = {
  id: "b1",
  name: "Needs",
  share_bp: 10000,
  takes_savings: false,
  takes_goals: false,
  at_least: false,
  category_ids: [],
};
const version = (from: string, withBuckets = true) => ({
  from,
  buckets: withBuckets ? [bucket] : [],
});

describe("versionAt", () => {
  it("reads the last version at or before the month, else the first", () => {
    const versions = [version("2026-09"), version("2026-11")];

    expect(versionAt(versions, "2026-10")?.from).toBe("2026-09");
    expect(versionAt(versions, "2026-11")?.from).toBe("2026-11");
    expect(versionAt(versions, "2026-06")?.from).toBe("2026-09");
  });

  it("returns undefined without versions or when the version holds no bucket", () => {
    expect(versionAt([], "2026-11")).toBeUndefined();
    expect(
      versionAt([version("2026-09"), version("2026-11", false)], "2026-12"),
    ).toBeUndefined();
    expect(
      versionRecordAt(
        [version("2026-09"), version("2026-11", false)],
        "2026-12",
      )?.from,
    ).toBe("2026-11");
    expect(versionRecordAt([], "2026-11")).toBeUndefined();
  });
});

describe("nextFrom", () => {
  it("returns the start after the version of the month", () => {
    const versions = [version("2026-09"), version("2026-12")];

    expect(nextFrom(versions, "2026-10")).toBe("2026-12");
    expect(nextFrom(versions, "2026-06")).toBe("2026-12");
    expect(nextFrom(versions, "2026-12")).toBeUndefined();
  });
});

describe("fromChoices", () => {
  const cases = [
    { versions: [], shown: "2026-11", today: "2026-11", want: [] },
    {
      versions: ["2026-09"],
      shown: "2026-11",
      today: "2026-11",
      want: ["2026-09/version/true", "2026-11/month/false"],
    },
    {
      versions: ["2026-09"],
      shown: "2026-10",
      today: "2026-11",
      want: [
        "2026-09/version/true",
        "2026-10/month/false",
        "2026-11/month/false",
      ],
    },
    {
      versions: ["2026-09", "2026-11"],
      shown: "2026-11",
      today: "2026-11",
      want: ["2026-11/version/false"],
    },
    {
      versions: ["2026-09", "2026-11"],
      shown: "2026-06",
      today: "2026-11",
      want: ["2026-09/version/true", "2026-06/month/false"],
    },
  ];

  it.each(cases)(
    "lists $want for $versions shown $shown",
    ({ versions, shown, today, want }) => {
      const got = fromChoices(
        versions.map((v) => version(v)),
        shown,
        today,
      ).map((c) => `${c.from}/${c.kind}/${String(c.first)}`);

      expect(got).toEqual(want);
    },
  );
});

describe("lastMonthOf", () => {
  const versions = [version("2026-09"), version("2026-12")];

  it("returns the month before the next start", () => {
    expect(lastMonthOf(versions, "2026-10")).toBe("2026-11");
    expect(lastMonthOf(versions, "2026-09")).toBe("2026-11");
    expect(lastMonthOf(versions, "2026-12")).toBeUndefined();
  });

  it("crosses a year", () => {
    expect(lastMonthOf([version("2027-01")], "2026-10")).toBe("2026-12");
  });
});

describe("fromLabelKey and periodKey", () => {
  const first = { from: "2026-09", kind: "version", first: true } as const;
  const later = { from: "2026-11", kind: "version", first: false } as const;
  const month = { from: "2026-10", kind: "month", first: false } as const;

  it("names the label of each kind of choice", () => {
    expect(fromLabelKey(first)).toBe("buckets.from.start");
    expect(fromLabelKey(later)).toBe("buckets.from.version");
    expect(fromLabelKey(month)).toBe("buckets.from.month");
  });

  it("names the period line of a choice, open or closed", () => {
    expect(periodKey(first, false)).toBe("buckets.from.startOpen");
    expect(periodKey(first, true)).toBe("buckets.from.startClosed");
    expect(periodKey(later, false)).toBe("buckets.from.open");
    expect(periodKey(month, true)).toBe("buckets.from.closed");
  });
});
