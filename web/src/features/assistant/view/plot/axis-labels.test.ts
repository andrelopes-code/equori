import { describe, expect, it } from "vitest";

import { axisLabels } from "@/features/assistant/view/plot/axis-labels";

describe("axisLabels", () => {
  it("writes the months of one year by their short name", () => {
    const rows = [[{ month: "2026-01" }], [{ month: "2026-10" }]];

    expect(axisLabels(rows, 0, [["x"], ["y"]], "pt-BR")).toEqual([
      "jan.",
      "out.",
    ]);
  });

  it("adds the year when the months span two", () => {
    const rows = [[{ month: "2025-12" }], [{ month: "2026-01" }]];

    expect(axisLabels(rows, 0, [["x"], ["y"]], "pt-BR")).toEqual([
      "dez-2025",
      "jan-2026",
    ]);
  });

  it("writes days of one year as day and month", () => {
    const rows = [[{ date: "2026-10-16" }]];

    expect(axisLabels(rows, 0, [["x"]], "en")).toEqual(["Oct 16"]);
  });

  it("keeps the written label of a name", () => {
    const rows = [[{ text: "assistantView.chart.rest", count: 3 }]];

    expect(axisLabels(rows, 0, [["Outros 3"]], "pt-BR")).toEqual(["Outros 3"]);
  });
});
