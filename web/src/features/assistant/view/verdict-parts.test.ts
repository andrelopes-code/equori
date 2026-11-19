import { describe, expect, it } from "vitest";

import { verdictParts } from "@/features/assistant/view/verdict-parts";

describe("verdictParts", () => {
  it("splits the rendered verdict into text and figures", () => {
    const rendered =
      "\u0001name\u0002 leva \u0001share\u0002 dos \u0001total\u0002 gastos.";

    expect(
      verdictParts(rendered, {
        name: "Moradia",
        share: "39%",
        total: "R$ 8.191,05",
      }),
    ).toEqual([
      { text: "Moradia", strong: true },
      { text: " leva ", strong: false },
      { text: "39%", strong: true },
      { text: " dos ", strong: false },
      { text: "R$ 8.191,05", strong: true },
      { text: " gastos.", strong: false },
    ]);
  });

  it("returns the text whole when it holds no figure", () => {
    expect(verdictParts("Nada.", {})).toEqual([
      { text: "Nada.", strong: false },
    ]);
  });
});
