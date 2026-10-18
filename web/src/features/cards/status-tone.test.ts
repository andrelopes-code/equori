import { describe, expect, it } from "vitest";

import { statusTone } from "@/features/cards/status-tone";

describe("statusTone", () => {
  it.each([
    ["open", "neutral"],
    ["closed", "info"],
    ["partially_paid", "warning"],
    ["overdue", "danger"],
    ["paid", "success"],
    ["financed", "neutral"],
  ] as const)("%s is %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});
