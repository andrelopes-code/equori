import { describe, expect, it } from "vitest";

import { upcomingWindow } from "@/features/overview/upcoming";

const occ = (id: string, expected_on: string, state: string) => ({
  id,
  expected_on,
  state: state as "expected" | "overdue" | "realized" | "skipped",
});

describe("upcomingWindow", () => {
  it("keeps overdue occurrences and the open ones of the next 7 days, by date", () => {
    const rows = upcomingWindow(
      [
        occ("future", "2026-10-25", "expected"),
        occ("last", "2026-10-24", "expected"),
        occ("today", "2026-10-17", "expected"),
        occ("late", "2026-09-05", "overdue"),
        occ("done", "2026-10-18", "realized"),
        occ("skipped", "2026-10-19", "skipped"),
      ],
      "2026-10-17",
    );
    expect(rows.map((r) => r.id)).toEqual(["late", "today", "last"]);
  });
});
