import { describe, expect, it } from "vitest";

import { timeZoneChoices } from "@/features/setup/time-zone-choices";

describe("timeZoneChoices", () => {
  it("starts with the default and lists every supported zone", () => {
    const choices = timeZoneChoices("Region default (America/Sao_Paulo)", null);

    expect(choices[0]).toEqual({
      value: "",
      label: "Region default (America/Sao_Paulo)",
    });
    expect(choices).toHaveLength(1 + Intl.supportedValuesOf("timeZone").length);
    expect(choices).toContainEqual({
      value: "America/Sao_Paulo",
      label: "America/Sao Paulo",
    });
  });

  it("lists a supported current zone once", () => {
    const choices = timeZoneChoices("d", "Asia/Tokyo");

    expect(choices.filter((c) => c.value === "Asia/Tokyo")).toHaveLength(1);
  });

  it("appends a current zone the runtime does not list", () => {
    const choices = timeZoneChoices("d", "Etc/GMT+3");

    expect(choices[choices.length - 1]).toEqual({
      value: "Etc/GMT+3",
      label: "Etc/GMT+3",
    });
  });
});
