import { describe, expect, it } from "vitest";

import { syncIntervalChoices } from "@/features/setup/sync-interval-choices";

describe("syncIntervalChoices", () => {
  it("lists the presets in minutes below an hour and in hours from it", () => {
    const choices = syncIntervalChoices("en", null);

    expect(choices.map((c) => c.value)).toEqual([
      "15",
      "30",
      "60",
      "120",
      "360",
      "720",
      "1440",
    ]);
    expect(choices.map((c) => c.label)).toEqual([
      "15 minutes",
      "30 minutes",
      "1 hour",
      "2 hours",
      "6 hours",
      "12 hours",
      "24 hours",
    ]);
  });

  it("writes the labels in the locale", () => {
    expect(syncIntervalChoices("pt-BR", null)[2]?.label).toBe("1 hora");
  });

  it("appends a current value that is not a preset, in minutes", () => {
    const choices = syncIntervalChoices("en", 90);

    expect(choices).toHaveLength(8);
    expect(choices[7]).toEqual({ value: "90", label: "90 minutes" });
  });

  it("appends nothing for a current value that is a preset", () => {
    expect(syncIntervalChoices("en", 60)).toHaveLength(7);
  });
});
