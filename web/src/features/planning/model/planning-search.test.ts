import { describe, expect, it } from "vitest";

import { validateScheduleFormSearch } from "@/features/planning/model/planning-search";

const id = "a0000000-0000-4000-8000-000000000001";
const goal = "a0000000-0000-4000-8000-000000000002";

describe("validateScheduleFormSearch", () => {
  it("keeps the schedule the form continues and nothing else", () => {
    expect(
      validateScheduleFormSearch({ from: id, kind: "savings", amount: 5 }),
    ).toEqual({ from: id });
  });

  it("keeps the fields of a saving for a goal", () => {
    expect(
      validateScheduleFormSearch({
        kind: "savings",
        counterpart: id,
        amount: "50000",
        goal,
        description: "Trip",
      }),
    ).toEqual({
      kind: "savings",
      counterpart: id,
      amount: 50000,
      goal,
      description: "Trip",
    });
  });

  it("drops what it cannot read", () => {
    expect(
      validateScheduleFormSearch({
        kind: "bill",
        counterpart: "x",
        amount: -1,
        goal: 3,
        description: "",
      }),
    ).toEqual({});
  });
});
