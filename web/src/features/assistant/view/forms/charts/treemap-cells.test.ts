import { describe, expect, it } from "vitest";

import { cellLabel } from "@/features/assistant/view/forms/charts/treemap-cells";

describe("cellLabel", () => {
  it("writes name, value and share in a large cell", () => {
    expect(cellLabel(38, 100)).toBe("full");
  });

  it("writes the share alone in a medium cell", () => {
    expect(cellLabel(13, 20)).toBe("share");
  });

  it("leaves a small cell to its tooltip", () => {
    expect(cellLabel(10, 30)).toBe("none");
  });
});
