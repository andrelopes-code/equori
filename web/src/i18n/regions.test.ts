import { describe, expect, it } from "vitest";

import { regionChoicesFor, regions } from "@/i18n/regions";

describe("regionChoicesFor", () => {
  it("names every region in English, sorted by name", () => {
    const choices = regionChoicesFor("en");
    const labels = choices.map((c) => c.label);

    expect(choices).toHaveLength(regions.length);
    expect(choices).toContainEqual({ value: "BR", label: "Brazil" });
    expect(labels.indexOf("Brazil")).toBeLessThan(labels.indexOf("Portugal"));
  });

  it("names the regions in the language of the tag", () => {
    expect(regionChoicesFor("pt-BR")).toContainEqual({
      value: "BR",
      label: "Brasil",
    });
  });
});
