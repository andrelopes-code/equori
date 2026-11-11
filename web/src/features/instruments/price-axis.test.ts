import { describe, expect, it } from "vitest";

import {
  axisLabel,
  axisTicks,
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

describe("axisTicks", () => {
  const day = 86_400_000;
  const at = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

  it("places a month of days on the Mondays", () => {
    expect(axisTicks(at(2026, 10, 1), at(2026, 10, 31))).toEqual([
      at(2026, 10, 5),
      at(2026, 10, 12),
      at(2026, 10, 19),
      at(2026, 10, 26),
    ]);
  });

  it("places three months every second Monday, evenly", () => {
    const ticks = axisTicks(at(2026, 8, 13), at(2026, 11, 10));

    expect(ticks.length).toBeGreaterThanOrEqual(5);
    expect(ticks.length).toBeLessThanOrEqual(7);
    expect(ticks.every((t) => new Date(t).getUTCDay() === 1)).toBe(true);
    expect(
      ticks.slice(1).every((t, i) => t - (ticks[i] ?? 0) === 14 * day),
    ).toBe(true);
    expect(ticks[0]).toBeGreaterThanOrEqual(at(2026, 8, 13));
    expect(ticks.at(-1)).toBeLessThanOrEqual(at(2026, 11, 10));
  });

  it("places five years on the first of January", () => {
    expect(axisTicks(at(2021, 11, 11), at(2026, 11, 10))).toEqual([
      at(2022, 1, 1),
      at(2023, 1, 1),
      at(2024, 1, 1),
      at(2025, 1, 1),
      at(2026, 1, 1),
    ]);
  });

  it("places a year on the first of every second month from January", () => {
    expect(axisTicks(at(2025, 11, 12), at(2026, 11, 10))).toEqual([
      at(2026, 1, 1),
      at(2026, 3, 1),
      at(2026, 5, 1),
      at(2026, 7, 1),
      at(2026, 9, 1),
      at(2026, 11, 1),
    ]);
  });

  it("places no tick on a single day", () => {
    expect(axisTicks(at(2026, 10, 1), at(2026, 10, 1))).toEqual([]);
  });
});
