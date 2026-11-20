import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { ProblemError } from "@/api/problem";
import { undoState } from "@/features/assistant/undo/undo-state";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

const t = ((key: keyof typeof catalogEn) => catalogEn[key]) as TFunction;

const executed: Proposal = {
  id: "p1",
  tool: "record_transaction",
  status: "executed",
  suggested: false,
  waiting_for: [],
  undoable: true,
  preview: { action: "record_transaction", changes: [] },
  created_at: "2026-11-20T10:00:00Z",
  expires_at: "2026-11-20T10:15:00Z",
};

// An older answer, stored before V19, carries no undoable.
const older: Proposal = { ...executed };
delete older.undoable;

describe("undoState", () => {
  it.each<[string, Proposal, Proposal | undefined, unknown, string]>([
    ["undoable", executed, undefined, null, "ready"],
    [
      "without inverse",
      { ...executed, undoable: false },
      undefined,
      null,
      "none",
    ],
    ["undoable left out", older, undefined, null, "none"],
    [
      "undone before",
      { ...executed, undoable: false, undone_by: "u1" },
      undefined,
      null,
      "done",
    ],
    [
      "undone now",
      executed,
      { ...executed, id: "u1", status: "executed" },
      null,
      "done",
    ],
    [
      "inverse failed",
      executed,
      { ...executed, id: "u1", status: "failed" },
      null,
      "ready",
    ],
  ])("%s", (_, proposal, answer, error, kind) => {
    expect(undoState(proposal, answer, error, t).kind).toBe(kind);
  });

  it("keeps the reason of a refused request", () => {
    const error = new ProblemError({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      code: "proposal_undone",
      detail: "the proposal was already undone",
    });

    const state = undoState(executed, undefined, error, t);

    expect(state.kind).toBe("ready");
    expect(state.kind === "ready" && state.failure).toMatch(/^Not undone\. ./);
  });
});
