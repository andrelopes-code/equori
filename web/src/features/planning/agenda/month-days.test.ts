import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { monthDays } from "@/features/planning/agenda/month-days";
import { agenda } from "@/features/planning/model/agenda";
import type { AgendaRow } from "@/features/planning/model/agenda";
import * as fixtures from "@/testing/planning-api";

type Occurrence = components["schemas"]["Occurrence"];
type Schedule = components["schemas"]["Schedule"];

// The fixtures type their enums as strings.
const schedules = fixtures.schedules as unknown as Schedule[];
const month = [
  fixtures.rentOctober,
  fixtures.streaming,
  fixtures.salary,
] as Occurrence[];
const overdue = [fixtures.rentSeptember, fixtures.rentOctober] as Occurrence[];

function rows(): AgendaRow[] {
  const view = agenda(month, overdue, schedules, {});
  return [...view.overdue, ...view.days.flatMap((d) => d.rows)];
}

describe("monthDays", () => {
  it("fills whole weeks from the locale's first day and marks each day by direction and state", () => {
    const days = monthDays(rows(), "2026-10", "BRL", 0);

    expect(days).toHaveLength(35);
    expect(days[0]).toMatchObject({ date: "2026-09-27", inMonth: false });
    expect(days[34]).toMatchObject({ date: "2026-10-31", inMonth: true });
    expect(days.find((d) => d.date === "2026-10-05")).toMatchObject({
      marks: [{ direction: "out", pending: true }],
      net: { amount: -210000, currency: "BRL" },
    });
    expect(days.find((d) => d.date === "2026-10-12")).toMatchObject({
      marks: [{ direction: "out", pending: false }],
      net: { amount: -3990, currency: "BRL" },
    });
    expect(days.find((d) => d.date === "2026-10-20")).toMatchObject({
      marks: [{ direction: "in", pending: true }],
      net: { amount: 500000, currency: "BRL" },
    });
    expect(days.find((d) => d.date === "2026-10-06")).toMatchObject({
      marks: [],
      net: undefined,
    });
  });

  it("starts the week on Monday when the locale does", () => {
    const days = monthDays(rows(), "2026-10", "BRL", 1);

    expect(days[0]?.date).toBe("2026-09-28");
    expect(days.at(-1)?.date).toBe("2026-11-01");
  });

  it("marks a skipped occurrence nowhere and leaves another currency out of the net", () => {
    const usd: Occurrence = {
      ...(fixtures.salary as Occurrence),
      id: "f1000000-0000-4000-8000-0000000000aa",
      expected_amount: { amount: 2000, currency: "USD" },
    };
    const skipped: Occurrence = {
      ...(fixtures.streaming as Occurrence),
      state: "skipped",
    };
    const view = agenda([usd, skipped], [], schedules, {});
    const all = view.days.flatMap((d) => d.rows);

    const days = monthDays(all, "2026-10", "BRL", 0);

    expect(days.find((d) => d.date === "2026-10-12")).toMatchObject({
      marks: [],
      net: undefined,
    });
    expect(days.find((d) => d.date === "2026-10-20")).toMatchObject({
      marks: [{ direction: "in", pending: true }],
      net: undefined,
    });
  });
});
