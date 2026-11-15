import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  defaultMarks,
  sheetModel,
  sheetSummary,
  timeLeft,
} from "@/features/assistant/proposal/sheet-model";
import type { SheetRow } from "@/features/assistant/proposal/sheet-model";

type Proposal = components["schemas"]["AssistantProposal"];

describe("sheetModel", () => {
  it("splits open and decided", () => {
    const p1 = p("p1", "pending");
    const p2 = p("p2", "executed");
    const p3 = p("p3", "waiting", { waiting_for: ["p1"] });
    const p4 = p("p4", "failed");

    const model = sheetModel([p1, p2, p3, p4]);

    expect(model.rows).toEqual([{ proposal: p1, dependents: [p3] }]);
    expect(model.results).toEqual([p2, p4]);
    expect(model.deadline).toBe(p1);
  });

  it("keeps a proposal decided in the session as a row, out of the deadline", () => {
    const p1 = p("p1", "executed");
    const p3 = p("p3", "executed", { waiting_for: ["p1"] });
    const p4 = p("p4", "failed");

    const model = sheetModel([p1, p3, p4], new Set(["p1", "p3"]));

    expect(model.rows).toEqual([{ proposal: p1, dependents: [p3] }]);
    expect(model.results).toEqual([p4]);
    expect(model.deadline).toBeUndefined();
  });

  it("draws an orphan waiting proposal as a row", () => {
    const p5 = p("p5", "waiting", { waiting_for: ["x"] });

    const model = sheetModel([p5]);

    expect(model.rows).toEqual([{ proposal: p5, dependents: [] }]);
    expect(model.results).toEqual([]);
  });

  it("takes the earliest expiry as the deadline", () => {
    const p1 = p("p1", "pending");
    const p6 = p("p6", "pending", { expires_at: "2026-11-15T10:20:00Z" });

    expect(sheetModel([p1, p6]).deadline).toBe(p6);
  });

  it("has no deadline without an open proposal", () => {
    const model = sheetModel([p("p2", "executed")]);

    expect(model.rows).toEqual([]);
    expect(model.deadline).toBeUndefined();
  });
});

describe("defaultMarks", () => {
  it("leaves a destructive proposal unmarked", () => {
    const marks = defaultMarks([
      p("p1", "pending"),
      p("p7", "pending", { destructive: true }),
      p("p2", "executed"),
    ]);

    expect(marks).toEqual({ p1: true, p7: false });
  });
});

describe("sheetSummary", () => {
  const rows: SheetRow[] = [
    { proposal: p("p1", "pending"), dependents: [] },
    { proposal: p("p7", "pending", { destructive: true }), dependents: [] },
  ];

  it.each([
    {
      name: "counts marks and irreversible",
      marks: { p1: true, p7: true },
      want: { marked: 2, total: 2, irreversible: 1, left: 0 },
    },
    {
      name: "counts what stays",
      marks: { p1: true, p7: false },
      want: { marked: 1, total: 2, irreversible: 0, left: 1 },
    },
  ])("$name", ({ marks, want }) => {
    expect(sheetSummary(rows, marks)).toEqual(want);
  });
});

describe("timeLeft", () => {
  it.each([
    { name: "at the start", now: "2026-11-15T10:00:00Z", want: 1 },
    { name: "in the middle", now: "2026-11-15T10:15:00Z", want: 0.5 },
    { name: "past the expiry", now: "2026-11-15T10:45:00Z", want: 0 },
  ])("$name", ({ now, want }) => {
    expect(timeLeft(p("p1", "pending"), Date.parse(now))).toBe(want);
  });
});

interface Extra {
  waiting_for?: string[];
  expires_at?: string;
  destructive?: boolean;
}

function p(
  id: string,
  status: Proposal["status"],
  extra: Extra = {},
): Proposal {
  return {
    id,
    tool: "record_transaction",
    status,
    suggested: false,
    waiting_for: extra.waiting_for ?? [],
    preview: {
      action: "record_transaction",
      changes: [],
      ...(extra.destructive === undefined
        ? {}
        : { destructive: extra.destructive }),
    },
    created_at: "2026-11-15T10:00:00Z",
    expires_at: extra.expires_at ?? "2026-11-15T10:30:00Z",
  };
}
