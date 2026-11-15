import { describe, expect, it } from "vitest";

import { agendaSections } from "@/features/planning/agenda/agenda-sections";
import type { AgendaRow } from "@/features/planning/model/agenda";

const row = (id: string) => ({ occurrence: { id } }) as AgendaRow;
const labels = {
  overdue: "Overdue",
  week: "Until Oct 24",
  later: "Rest",
  done: "Already happened",
};

describe("agendaSections", () => {
  it("labels each group, puts what happened last and drops the empty ones", () => {
    const got = agendaSections(
      {
        overdue: [row("a")],
        week: [],
        later: [row("b"), row("c")],
        done: [row("d")],
      },
      labels,
    );

    expect(
      got.map((g) => [g.key, g.label, g.rows.map((r) => r.occurrence.id)]),
    ).toEqual([
      ["overdue", "Overdue", ["a"]],
      ["later", "Rest", ["b", "c"]],
      ["done", "Already happened", ["d"]],
    ]);
  });

  it("returns nothing when the month holds no occurrence", () => {
    expect(
      agendaSections({ overdue: [], week: [], later: [], done: [] }, labels),
    ).toEqual([]);
  });
});
