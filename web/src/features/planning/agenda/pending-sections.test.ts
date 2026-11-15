import { describe, expect, it } from "vitest";

import { pendingSections } from "@/features/planning/agenda/pending-sections";
import type { AgendaRow } from "@/features/planning/model/agenda";

const row = (id: string) => ({ occurrence: { id } }) as AgendaRow;
const labels = { overdue: "Overdue", week: "Until Oct 24", later: "Rest" };

describe("pendingSections", () => {
  it("labels each group and drops the empty ones", () => {
    const got = pendingSections(
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
    ]);
  });

  it("returns nothing when nothing is pending", () => {
    expect(
      pendingSections(
        { overdue: [], week: [], later: [], done: [row("d")] },
        labels,
      ),
    ).toEqual([]);
  });
});
