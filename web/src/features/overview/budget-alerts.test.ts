import { describe, expect, it } from "vitest";

import { budgetAlerts } from "@/features/overview/budget-alerts";

const money = (amount: number) => ({ amount, currency: "BRL" });
const row = (id: string, planned: number, carried: number, spent: number) => ({
  id,
  name: id,
  progress: {
    planned: money(planned),
    carried: money(carried),
    spent: money(spent),
    available: money(planned + carried - spent),
  },
});

describe("budgetAlerts", () => {
  it("keeps the overspent and the near-limit budgets, overspent first", () => {
    const alerts = budgetAlerts([
      row("within", 10000, 0, 8949),
      row("near", 10000, 0, 9000),
      row("over", 10000, 0, 10001),
      row("rollover", 10000, 5000, 14000),
      row("full", 0, 0, 5),
    ]);
    expect(alerts.map((a) => [a.id, a.state, a.share])).toEqual([
      ["full", "over", 100],
      ["over", "over", 100],
      ["rollover", "near", 93],
      ["near", "near", 90],
    ]);
  });
});
