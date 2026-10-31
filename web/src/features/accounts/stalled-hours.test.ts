import { describe, expect, it } from "vitest";

import { stalledHours } from "@/features/accounts/stalled-hours";

const now = new Date("2026-11-12T12:00:00Z");

describe("stalledHours", () => {
  it.each([
    {
      last_item_update_at: "2026-11-09T11:00:00Z",
      last_synced_at: "2026-11-12T12:00:00Z",
      want: 73,
    },
    {
      last_item_update_at: "2026-11-12T12:00:00Z",
      last_synced_at: "2026-11-09T10:30:00Z",
      want: 73,
    },
    { want: 0 },
  ])("$want hours", ({ want, ...connection }) => {
    expect(stalledHours(connection, now)).toBe(want);
  });
});
