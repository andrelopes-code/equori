import { describe, expect, it } from "vitest";

import { forecastDayMoves } from "@/features/reports/forecast-day-moves";

describe("forecast day moves", () => {
  it("lists the events of the day, the overdue ones on the day after today", () => {
    const events = [
      event("2026-11-03", "Gym", -9000),
      event("2026-11-06", "Phone", -9990),
      event("2026-11-06", "Pharmacy (estimated)", -3000),
      event("2026-11-20", "Rent", -200000),
    ];

    const first = forecastDayMoves(events, "2026-11-06", "2026-11-05");
    const later = forecastDayMoves(events, "2026-11-20", "2026-11-05");
    const none = forecastDayMoves(events, "2026-11-07", "2026-11-05");

    expect(first).toEqual([
      { description: "Gym", amount: -9000 },
      { description: "Phone", amount: -9990 },
      { description: "Pharmacy (estimated)", amount: -3000 },
    ]);
    expect(later).toEqual([{ description: "Rent", amount: -200000 }]);
    expect(none).toEqual([]);
  });
});

function event(date: string, description: string, amount: number) {
  return { date, occurrenceID: "", description, kind: undefined, amount };
}
