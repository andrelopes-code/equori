import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { regionName } from "@/ui/region/region-name";

const t = (key: keyof typeof catalogEn) => catalogEn[key];

describe("regionName", () => {
  it("names the global region and the euro area from the catalog", () => {
    expect(regionName("global", t, "en-US")).toBe("Global");
    expect(regionName("EU", t, "en-US")).toBe("Euro area");
  });

  it("names any other region in the language of the tag", () => {
    expect(regionName("BR", t, "en-US")).toBe("Brazil");
    expect(regionName("BR", t, "pt-BR")).toBe("Brasil");
  });
});
