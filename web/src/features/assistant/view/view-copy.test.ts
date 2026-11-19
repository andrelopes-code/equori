import { describe, expect, it } from "vitest";

import { viewCopy } from "@/features/assistant/view/view-copy";

describe("viewCopy", () => {
  it("writes the title, period, verdict and one line per row", () => {
    expect(
      viewCopy({
        title: "Onde foi o dinheiro",
        window: "outubro de 2026",
        verdict: "Moradia leva 39% dos R$ 8.191,05.",
        head: ["Categoria", "Total", "%"],
        rows: [
          ["Moradia", "R$ 3.200,00", "39%"],
          ["Mercado", "R$ 1.497,00", "18%"],
        ],
      }),
    ).toBe(
      [
        "Onde foi o dinheiro · outubro de 2026",
        "Moradia leva 39% dos R$ 8.191,05.",
        "",
        "Categoria\tTotal\t%",
        "Moradia\tR$ 3.200,00\t39%",
        "Mercado\tR$ 1.497,00\t18%",
      ].join("\n"),
    );
  });

  it("leaves out an empty period", () => {
    expect(
      viewCopy({ title: "T", window: "", verdict: "V", head: [], rows: [] }),
    ).toBe("T\nV");
  });
});
