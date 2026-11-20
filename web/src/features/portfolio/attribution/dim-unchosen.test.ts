import { describe, expect, it } from "vitest";

import { dimUnchosen } from "@/features/portfolio/attribution/dim-unchosen";

describe("dimUnchosen", () => {
  it("fades every bar but the chosen year's and leaves other series alone", () => {
    const option = {
      series: [
        {
          type: "bar",
          data: [1, { value: 2, itemStyle: { color: "red" } }, 3],
        },
        { type: "line", data: [4, 5, 6] },
      ],
    };

    expect(dimUnchosen(option, 1)).toEqual({
      series: [
        {
          type: "bar",
          data: [
            { value: 1, itemStyle: { opacity: 0.4 } },
            { value: 2, itemStyle: { color: "red" } },
            { value: 3, itemStyle: { opacity: 0.4 } },
          ],
        },
        { type: "line", data: [4, 5, 6] },
      ],
    });
  });

  it("keeps an option without series", () => {
    expect(dimUnchosen({ grid: {} }, 0)).toEqual({ grid: {} });
  });
});
