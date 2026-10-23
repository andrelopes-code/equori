import { describe, expect, it } from "vitest";

import type { ModelUse, UsageRow } from "@/features/setup/api";
import { mergeUsageRows, usageStatus } from "@/features/setup/usage-rows";

const row = (over: Partial<UsageRow> = {}): UsageRow => ({
  provider_id: "aistudio",
  provider_name: "aistudio",
  preset: "gemini",
  instance: true,
  model: "m",
  today_requests: 0,
  today_errors: 0,
  today_tokens: 0,
  period_requests: 0,
  period_tokens: 0,
  period_days: 30,
  ...over,
});

const use = (targets: [string, string, string][]): ModelUse => ({
  id: "assistant.chat",
  needs: ["tools"],
  sends_financial_data: true,
  default: true,
  targets: targets.map(([provider_id, provider_name, model]) => ({
    provider_id,
    provider_name,
    preset: "groq",
    notice: "provider_terms",
    model,
    capabilities: ["tools"],
  })),
});

describe("usage rows", () => {
  it("adds every chain target without usage as a zero row, once", () => {
    const merged = mergeUsageRows(
      [row({ model: "a", today_requests: 3 })],
      [
        use([
          ["aistudio", "aistudio", "a"],
          ["p1", "Groq", "b"],
        ]),
        use([["p1", "Groq", "b"]]),
      ],
      new Set(["aistudio"]),
    );
    expect(
      merged.map((r) => [r.provider_id, r.model, r.today_requests, r.instance]),
    ).toEqual([
      ["aistudio", "a", 3, true],
      ["p1", "b", 0, false],
    ]);
  });

  it("states the strongest condition of a row", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    expect(usageStatus(row(), now)).toBeNull();
    expect(
      usageStatus(row({ today_requests: 79, requests_per_day: 100 }), now),
    ).toBeNull();
    expect(
      usageStatus(row({ today_requests: 80, requests_per_day: 100 }), now),
    ).toBe("near");
    expect(
      usageStatus(row({ today_tokens: 1000, tokens_per_day: 1000 }), now),
    ).toBe("reached");
    expect(
      usageStatus(row({ cooling_until: "2026-10-23T13:00:00Z" }), now),
    ).toBe("cooling");
    expect(
      usageStatus(row({ cooling_until: "2026-10-23T11:00:00Z" }), now),
    ).toBeNull();
    expect(
      usageStatus(
        row({
          today_requests: 100,
          requests_per_day: 100,
          cooling_until: "2026-10-23T13:00:00Z",
        }),
        now,
      ),
    ).toBe("reached");
  });
});
