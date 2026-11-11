import { describe, expect, it } from "vitest";

import {
  axisLabel,
  axisSpanDays,
  showMarkers,
} from "@/features/instruments/price-axis";

describe("axisSpanDays", () => {
  it("counts the days between the first and the last price", () => {
    expect(axisSpanDays([{ date: "2026-10-01" }, { date: "2026-10-31" }])).toBe(
      30,
    );
  });

  it("is zero without two prices", () => {
    expect(axisSpanDays([])).toBe(0);
    expect(axisSpanDays([{ date: "2026-10-01" }])).toBe(0);
  });
});

// A223 RM6
describe("axisLabel", () => {
  const march = Date.UTC(2024, 2, 12);

  it("writes the day and the month up to 100 days", () => {
    expect(axisLabel(march, "en", 90)).toBe("Mar 12");
    expect(axisLabel(march, "pt-BR", 90)).toBe("12 mar");
  });

  it("writes the month and the year above 100 days", () => {
    expect(axisLabel(march, "en", 366)).toBe("Mar 2024");
    expect(axisLabel(march, "pt-BR", 1827)).toBe("mar. de 2024");
  });
});

// A223 RM7
describe("showMarkers", () => {
  it("marks up to 60 prices", () => {
    expect(showMarkers(60)).toBe(true);
    expect(showMarkers(61)).toBe(false);
  });
});
