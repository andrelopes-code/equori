import { describe, expect, it } from "vitest";

import { correlationReading } from "@/features/portfolio/risk/correlation-reading";

describe("correlationReading", () => {
  it("RK9: reads the correlation by its usual bounds", () => {
    expect(
      [-5000, -3000, -2999, 700, 2999, 3000, 6999, 7000, 9826].map(
        correlationReading,
      ),
    ).toEqual([
      "opposite",
      "opposite",
      "independent",
      "independent",
      "independent",
      "partly",
      "partly",
      "together",
      "together",
    ]);
  });
});
